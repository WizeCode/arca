import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HashingModule } from 'src/auth/hash/hashing.module';

@Module({
    imports: [PrismaModule, HashingModule],
    controllers: [UsersController],
    providers: [UsersService],
})
export class UsersModule {}
