import { Module } from '@nestjs/common';
import { HashingServiceProtocol } from './hashing.service';
import { BcryptService } from './bcrypt.service';

@Module({
    providers: [
        {
            provide: HashingServiceProtocol,
            useClass: BcryptService,
        },
    ],
    exports: [HashingServiceProtocol],
})
export class HashingModule {}
