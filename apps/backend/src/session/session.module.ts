import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CryptoModule } from 'src/crypto/crypto.module';

@Module({
    imports: [PrismaModule, CryptoModule],
    controllers: [SessionController],
    providers: [SessionService],
})
export class SessionModule {}
