import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { AuditModule } from './audit/audit.module';
import { SessionModule } from './session/session.module';
import { MedicalRecordModule } from './medical_record/medical_record.module';
import { PdfModule } from './pdf/pdf.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
        }),
        ThrottlerModule.forRoot([
            {
                ttl: 60_000,
                limit: 10,
            },
        ]),
        AuditModule,
        AuthModule,
        UsersModule,
        WaitlistModule,
        SessionModule,
        MedicalRecordModule,
        PdfModule,
    ],
    controllers: [AppController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
