import { InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import { tenantExtension, TenantClsStore } from './tenant.extension';

const CLINICA_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

interface TenantAllOperationsArgs {
    model?: string;
    operation: string;
    args: Record<string, unknown>;
    query: (args: Record<string, unknown>) => Promise<unknown>;
}

type AllOperationsFn = (args: TenantAllOperationsArgs) => Promise<unknown>;

interface TenantExtensionConfig {
    query: {
        $allOperations: AllOperationsFn;
    };
    client: {
        $tenantTransaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
    };
}

interface MockPrismaClient {
    $executeRaw: jest.Mock<unknown, unknown[]>;
    $transaction: jest.Mock<unknown, [unknown]>;
    $extends: jest.Mock<MockPrismaClient, [TenantExtensionConfig]>;
    $tenantTransaction?: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
    atendimento: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    __config?: TenantExtensionConfig;
}

/**
 * Simula a distinção real do Prisma entre o client cru e o client retornado por
 * $extends(): são objetos DIFERENTES, e apenas o extendido roteia chamadas de
 * modelo (ex: tx.atendimento.create) pelo hook $allOperations. $transaction em
 * forma de função sempre devolve como "tx" o PRÓPRIO client em que foi chamado
 * (cru permanece cru, extendido permanece extendido) — é essa propriedade que
 * o bug original (fechar sobre o `prisma` cru em vez do client extendido)
 * violava, e que o mock anterior não conseguia expor porque `$extends` só
 * mutava e devolvia o mesmo objeto.
 */
function createMockClient(): { raw: MockPrismaClient; inserted: Record<string, unknown>[] } {
    const inserted: Record<string, unknown>[] = [];
    const $executeRaw = jest.fn(() => Promise.resolve({ __raw: true }));

    function buildClient(allOperations?: AllOperationsFn): MockPrismaClient {
        const client: MockPrismaClient = {
            $executeRaw,
            atendimento: {
                create: (args: { data: Record<string, unknown> }) => {
                    if (!allOperations) {
                        const record = { ...args.data };
                        inserted.push(record);
                        return Promise.resolve(record);
                    }
                    return allOperations({
                        model: 'Atendimento',
                        operation: 'create',
                        args,
                        query: (finalArgs: Record<string, unknown>) => {
                            const data = (finalArgs as { data: Record<string, unknown> }).data;
                            const record = { ...data };
                            inserted.push(record);
                            return Promise.resolve(record);
                        },
                    });
                },
            },
            $transaction: jest.fn((arg: unknown[] | ((tx: MockPrismaClient) => Promise<unknown>)) => {
                if (Array.isArray(arg)) {
                    return Promise.all(arg);
                }
                // tx é o PRÓPRIO client (cru ou extendido) em que $transaction foi chamado.
                return arg(client);
            }),
            $extends: jest.fn((config: TenantExtensionConfig) => {
                client.__config = config;
                const extended = buildClient(config.query.$allOperations);
                extended.$tenantTransaction = config.client.$tenantTransaction.bind(extended);
                extended.__config = config;
                return extended;
            }),
        };
        return client;
    }

    return { raw: buildClient(), inserted };
}

function createClsMock(store: Record<string, unknown> = {}) {
    return {
        get: jest.fn((key: string) => store[key]),
        set: jest.fn((key: string, value: unknown) => {
            store[key] = value;
        }),
    };
}

type ClsMock = ReturnType<typeof createClsMock>;

function extend(raw: MockPrismaClient, cls: ClsMock): MockPrismaClient {
    tenantExtension(raw as unknown as PrismaClient, cls as unknown as ClsService<TenantClsStore>);
    return raw.$extends.mock.results[0].value as MockPrismaClient;
}

describe('tenantExtension', () => {
    describe('$allOperations', () => {
        it('passes non-scoped models straight through without touching CLS', async () => {
            const cls = createClsMock();
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const query = jest.fn().mockResolvedValue('result');
            const result = await extended.__config!.query.$allOperations({
                model: 'Role',
                operation: 'findMany',
                args: { where: { nome: 'x' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ where: { nome: 'x' } });
            expect(result).toBe('result');
            expect(cls.get).not.toHaveBeenCalled();
            expect(raw.$transaction).not.toHaveBeenCalled();
        });

        it('throws InternalServerErrorException for a scoped model with no clinicaId in CLS', async () => {
            const cls = createClsMock();
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const query = jest.fn();

            await expect(
                extended.__config!.query.$allOperations({
                    model: 'Usuario',
                    operation: 'findMany',
                    args: {},
                    query,
                }),
            ).rejects.toThrow(InternalServerErrorException);
            expect(query).not.toHaveBeenCalled();
        });

        it('injects where.id_Clinica for a find operation and wraps it in a set_config transaction', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const query = jest.fn().mockResolvedValue(['row']);
            const result = await extended.__config!.query.$allOperations({
                model: 'Usuario',
                operation: 'findMany',
                args: { where: { nome: 'x' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ where: { nome: 'x', id_Clinica: CLINICA_ID } });
            expect(raw.$executeRaw).toHaveBeenCalled();
            expect(raw.$transaction).toHaveBeenCalled();
            expect(result).toEqual(['row']);
        });

        it('always overrides a caller-supplied id_Clinica in where', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const query = jest.fn().mockResolvedValue([]);
            await extended.__config!.query.$allOperations({
                model: 'Usuario',
                operation: 'findMany',
                args: { where: { id_Clinica: 'attacker-clinica-id' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ where: { id_Clinica: CLINICA_ID } });
        });

        it('injects data.id_Clinica for create, overriding any caller-supplied value', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const query = jest.fn().mockResolvedValue({});
            await extended.__config!.query.$allOperations({
                model: 'Usuario',
                operation: 'create',
                args: { data: { nome: 'x', id_Clinica: 'attacker-clinica-id' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ data: { nome: 'x', id_Clinica: CLINICA_ID } });
        });

        it('injects id_Clinica into every item of a createMany array, overriding caller-supplied values', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const query = jest.fn().mockResolvedValue({ count: 2 });
            await extended.__config!.query.$allOperations({
                model: 'ListaEspera',
                operation: 'createMany',
                args: {
                    data: [{ nome: 'a' }, { nome: 'b', id_Clinica: 'attacker-clinica-id' }],
                },
                query,
            });

            expect(query).toHaveBeenCalledWith({
                data: [
                    { nome: 'a', id_Clinica: CLINICA_ID },
                    { nome: 'b', id_Clinica: CLINICA_ID },
                ],
            });
        });

        it('skips the wrapping transaction when a tenant transaction is already active', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID, tenantTxActive: true });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const query = jest.fn().mockResolvedValue([]);
            await extended.__config!.query.$allOperations({
                model: 'Usuario',
                operation: 'findMany',
                args: {},
                query,
            });

            expect(raw.$transaction).not.toHaveBeenCalled();
            expect(raw.$executeRaw).not.toHaveBeenCalled();
            expect(query).toHaveBeenCalledWith({ where: { id_Clinica: CLINICA_ID } });
        });
    });

    describe('$tenantTransaction', () => {
        it('sets tenantTxActive around the callback and clears it after completion', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const fn = jest.fn(() => {
                expect(cls.get('tenantTxActive')).toBe(true);
                return Promise.resolve('done');
            });

            const result = await extended.$tenantTransaction!(fn);

            expect(result).toBe('done');
            expect(fn).toHaveBeenCalled();
            expect(cls.get('tenantTxActive')).toBe(false);
            expect(raw.$executeRaw).toHaveBeenCalled();
        });

        it('clears tenantTxActive even when the callback throws', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const fn = jest.fn().mockRejectedValue(new Error('boom'));

            await expect(extended.$tenantTransaction!(fn)).rejects.toThrow('boom');
            expect(cls.get('tenantTxActive')).toBe(false);
        });

        it('throws when there is no clinicaId in CLS', async () => {
            const cls = createClsMock();
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            const fn = jest.fn();
            await expect(extended.$tenantTransaction!(fn)).rejects.toThrow(InternalServerErrorException);
            expect(fn).not.toHaveBeenCalled();
        });

        it('opens the transaction on the extended client, not the raw one (regression test for the raw-client bug)', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw } = createMockClient();
            const extended = extend(raw, cls);

            await extended.$tenantTransaction!(() => Promise.resolve('done'));

            expect(raw.$transaction).not.toHaveBeenCalled();
            expect(extended.$transaction).toHaveBeenCalled();
        });

        it('stamps id_Clinica on tx.model.create() calls made inside the callback, with no id_Clinica in the caller-supplied data', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const { raw, inserted } = createMockClient();
            const extended = extend(raw, cls);

            const created = await extended.$tenantTransaction!(async (tx) => {
                return (tx as MockPrismaClient).atendimento.create({ data: { titulo: 'sessao' } });
            });

            expect(created).toEqual({ titulo: 'sessao', id_Clinica: CLINICA_ID });
            expect(inserted).toEqual([{ titulo: 'sessao', id_Clinica: CLINICA_ID }]);
        });
    });
});
