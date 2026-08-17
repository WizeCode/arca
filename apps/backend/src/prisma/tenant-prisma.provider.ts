import { Provider } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import { tenantExtension, TenantClsStore } from './tenant.extension';

export const TENANT_PRISMA = Symbol('TENANT_PRISMA');

function tenantPrismaFactory(prisma: PrismaService, cls: ClsService<TenantClsStore>) {
    return tenantExtension(prisma, cls);
}

export type TenantPrismaClient = ReturnType<typeof tenantPrismaFactory>;

export const tenantPrismaProvider: Provider = {
    provide: TENANT_PRISMA,
    useFactory: tenantPrismaFactory,
    inject: [PrismaService, ClsService],
};
