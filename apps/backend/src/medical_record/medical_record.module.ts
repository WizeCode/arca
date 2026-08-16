import { Module } from '@nestjs/common';
import { MedicalRecordService } from './medical_record.service';
import { MedicalRecordController } from './medical_record.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PdfModule } from 'src/pdf/pdf.module';
import { CryptoModule } from 'src/crypto/crypto.module';

@Module({
    imports: [PrismaModule, PdfModule, CryptoModule],
    controllers: [MedicalRecordController],
    providers: [MedicalRecordService],
})
export class MedicalRecordModule {}
