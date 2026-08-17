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

interface TenantExtensionConfig {
    query: {
        $allOperations: (args: TenantAllOperationsArgs) => Promise<unknown>;
    };
    client: {
        $tenantTransaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
    };
}

interface MockPrismaClient {
    $executeRaw: jest.Mock<unknown, unknown[]>;
    $transaction: jest.Mock<unknown, [unknown]>;
    $extends: jest.Mock<MockPrismaClient, [TenantExtensionConfig]>;
    __config?: TenantExtensionConfig;
}

function createMockClient(): MockPrismaClient {
    const $executeRaw = jest.fn(() => ({ __raw: true }));
    const $transaction = jest.fn((arg: unknown[] | ((tx: MockPrismaClient) => Promise<unknown>)) => {
        if (Array.isArray(arg)) {
            return Promise.all(arg);
        }
        return arg(client);
    });
    const $extends = jest.fn((config: TenantExtensionConfig) => {
        client.__config = config;
        return client;
    });

    const client: MockPrismaClient = { $executeRaw, $transaction, $extends };
    return client;
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

// `tenantExtension` is typed against the real generated PrismaClient / ClsService, whose full
// surface (dozens of model delegates, CLS lifecycle methods, ...) isn't worth reproducing in a
// hand-rolled mock. This is the single, explicit boundary where the partial test doubles above
// stand in for those real types.
function extend(client: MockPrismaClient, cls: ClsMock): TenantExtensionConfig {
    tenantExtension(client as unknown as PrismaClient, cls as unknown as ClsService<TenantClsStore>);
    return client.__config as TenantExtensionConfig;
}

describe('tenantExtension', () => {
    describe('$allOperations', () => {
        it('passes non-scoped models straight through without touching CLS', async () => {
            const cls = createClsMock();
            const client = createMockClient();
            const config = extend(client, cls);

            const query = jest.fn().mockResolvedValue('result');
            const result = await config.query.$allOperations({
                model: 'Role',
                operation: 'findMany',
                args: { where: { nome: 'x' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ where: { nome: 'x' } });
            expect(result).toBe('result');
            expect(cls.get).not.toHaveBeenCalled();
            expect(client.$transaction).not.toHaveBeenCalled();
        });

        it('throws InternalServerErrorException for a scoped model with no clinicaId in CLS', async () => {
            const cls = createClsMock();
            const client = createMockClient();
            const config = extend(client, cls);

            const query = jest.fn();

            await expect(
                config.query.$allOperations({
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
            const client = createMockClient();
            const config = extend(client, cls);

            const query = jest.fn().mockResolvedValue(['row']);
            const result = await config.query.$allOperations({
                model: 'Usuario',
                operation: 'findMany',
                args: { where: { nome: 'x' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ where: { nome: 'x', id_Clinica: CLINICA_ID } });
            expect(client.$executeRaw).toHaveBeenCalled();
            expect(client.$transaction).toHaveBeenCalled();
            expect(result).toEqual(['row']);
        });

        it('always overrides a caller-supplied id_Clinica in where', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const client = createMockClient();
            const config = extend(client, cls);

            const query = jest.fn().mockResolvedValue([]);
            await config.query.$allOperations({
                model: 'Usuario',
                operation: 'findMany',
                args: { where: { id_Clinica: 'attacker-clinica-id' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ where: { id_Clinica: CLINICA_ID } });
        });

        it('injects data.id_Clinica for create, overriding any caller-supplied value', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const client = createMockClient();
            const config = extend(client, cls);

            const query = jest.fn().mockResolvedValue({});
            await config.query.$allOperations({
                model: 'Usuario',
                operation: 'create',
                args: { data: { nome: 'x', id_Clinica: 'attacker-clinica-id' } },
                query,
            });

            expect(query).toHaveBeenCalledWith({ data: { nome: 'x', id_Clinica: CLINICA_ID } });
        });

        it('injects id_Clinica into every item of a createMany array, overriding caller-supplied values', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const client = createMockClient();
            const config = extend(client, cls);

            const query = jest.fn().mockResolvedValue({ count: 2 });
            await config.query.$allOperations({
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
            const client = createMockClient();
            const config = extend(client, cls);

            const query = jest.fn().mockResolvedValue([]);
            await config.query.$allOperations({
                model: 'Usuario',
                operation: 'findMany',
                args: {},
                query,
            });

            expect(client.$transaction).not.toHaveBeenCalled();
            expect(client.$executeRaw).not.toHaveBeenCalled();
            expect(query).toHaveBeenCalledWith({ where: { id_Clinica: CLINICA_ID } });
        });
    });

    describe('$tenantTransaction', () => {
        it('sets tenantTxActive around the callback and clears it after completion', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const client = createMockClient();
            const config = extend(client, cls);

            const fn = jest.fn(() => {
                expect(cls.get('tenantTxActive')).toBe(true);
                return Promise.resolve('done');
            });

            const result = await config.client.$tenantTransaction(fn);

            expect(result).toBe('done');
            expect(fn).toHaveBeenCalled();
            expect(cls.get('tenantTxActive')).toBe(false);
            expect(client.$executeRaw).toHaveBeenCalled();
        });

        it('clears tenantTxActive even when the callback throws', async () => {
            const cls = createClsMock({ clinicaId: CLINICA_ID });
            const client = createMockClient();
            const config = extend(client, cls);

            const fn = jest.fn().mockRejectedValue(new Error('boom'));

            await expect(config.client.$tenantTransaction(fn)).rejects.toThrow('boom');
            expect(cls.get('tenantTxActive')).toBe(false);
        });

        it('throws when there is no clinicaId in CLS', async () => {
            const cls = createClsMock();
            const client = createMockClient();
            const config = extend(client, cls);

            const fn = jest.fn();
            await expect(config.client.$tenantTransaction(fn)).rejects.toThrow(InternalServerErrorException);
            expect(fn).not.toHaveBeenCalled();
        });
    });
});
