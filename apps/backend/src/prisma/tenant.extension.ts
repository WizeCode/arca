import { InternalServerErrorException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { ClsService, ClsStore } from 'nestjs-cls';
import { TENANT_SCOPED_MODELS } from './tenant-scoped-models';
import { UUID } from 'node:crypto';

export interface TenantClsStore extends ClsStore {
    clinicaId?: UUID;
    tenantTxActive?: boolean;
}

const TENANT_DATA_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);

function applyTenantFilter(
    operation: string,
    args: Record<string, unknown> | undefined,
    clinicaId: UUID,
): Record<string, unknown> {
    const scopedArgs: Record<string, unknown> = { ...(args ?? {}) };

    if (TENANT_DATA_OPERATIONS.has(operation)) {
        const data = scopedArgs.data;
        scopedArgs.data = Array.isArray(data)
            ? data.map((item: Record<string, unknown>) => ({ ...item, id_Clinica: clinicaId }))
            : { ...((data ?? {}) as Record<string, unknown>), id_Clinica: clinicaId };
        return scopedArgs;
    }

    scopedArgs.where = { ...((scopedArgs.where ?? {}) as Record<string, unknown>), id_Clinica: clinicaId };
    return scopedArgs;
}

export function tenantExtension(prisma: PrismaClient, cls: ClsService<TenantClsStore>) {
    return prisma.$extends({
        name: 'tenant-extension',
        query: {
            async $allOperations({ model, operation, args, query }) {
                if (!model || !TENANT_SCOPED_MODELS.includes(model)) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- $allOperations não é tipado por model; args/query são genéricos de propósito, ver docs do Prisma
                    return query(args);
                }

                const clinicaId = cls.get('clinicaId');
                if (!clinicaId) {
                    throw new InternalServerErrorException(
                        `Tentativa de operação em ${model} sem clinicaId no contexto de tenant`,
                    );
                }

                const scopedArgs = applyTenantFilter(operation, args as Record<string, unknown>, clinicaId);

                if (cls.get('tenantTxActive')) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- $allOperations não é tipado por model; args/query são genéricos de propósito, ver docs do Prisma
                    return query(scopedArgs);
                }

                const [, result] = await prisma.$transaction([
                    prisma.$executeRaw`SELECT set_config('app.current_clinica_id', ${clinicaId}, true)`,
                    query(scopedArgs),
                ]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- $allOperations não é tipado por model; args/query são genéricos de propósito, ver docs do Prisma
                return result;
            },
        },
        client: {
            async $tenantTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
                const clinicaId = cls.get('clinicaId');
                if (!clinicaId) {
                    throw new InternalServerErrorException(
                        'Não é possível abrir uma transação de tenant sem clinicaId no contexto',
                    );
                }

                return prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.current_clinica_id', ${clinicaId}, true)`;
                    cls.set('tenantTxActive', true);
                    try {
                        return await fn(tx);
                    } finally {
                        cls.set('tenantTxActive', false);
                    }
                });
            },
        },
    });
}
