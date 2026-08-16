// src/audit/audit.module.ts
import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaModule } from 'src/prisma/prisma.module'; // Importe o PrismaModule
import { AuditController } from './audit.controller';

@Module({
    imports: [PrismaModule],
    providers: [AuditService],
    exports: [AuditService],
    controllers: [AuditController],
})
export class AuditModule {}
