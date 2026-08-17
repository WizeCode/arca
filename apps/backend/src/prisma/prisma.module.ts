import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { tenantPrismaProvider } from './tenant-prisma.provider';

@Module({
    providers: [PrismaService, tenantPrismaProvider],
    exports: [PrismaService, tenantPrismaProvider],
})
export class PrismaModule {}
