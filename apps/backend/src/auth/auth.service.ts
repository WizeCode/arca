import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UUID } from 'node:crypto';
import { HashingServiceProtocol } from './hash/hashing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import jwtConfig from './config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { ValidatedUserDto } from './dto/validated-user.dto';

interface LoginLookupRow {
    id_user: string;
    nome: string;
    email: string;
    senha_hash: string;
    role_id: number;
    id_clinica: UUID;
}

@Injectable()
export class AuthService {
    constructor(
        private hashingService: HashingServiceProtocol,
        private prisma: PrismaService,

        @Inject(jwtConfig.KEY)
        private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
        private readonly jwtService: JwtService,
    ) {}

    async validateUser(body: LoginDto): Promise<ValidatedUserDto> {
        const rows = await this.prisma.$queryRaw<LoginLookupRow[]>`
            SELECT * FROM buscar_usuario_login(${body.email})
        `;
        const user = rows[0];

        if (!user) {
            throw new UnauthorizedException('Senha ou e-mail inválido.');
        }

        const isPasswordValid = await this.hashingService.compare(body.password, user.senha_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Senha ou e-mail inválido.');
        }

        return {
            id_User: user.id_user,
            nome: user.nome,
            email: user.email,
            roleId: user.role_id,
            id_Clinica: user.id_clinica,
        };
    }

    async login(user: ValidatedUserDto): Promise<AuthenticatedUserDto> {
        const token = await this.jwtService.signAsync(
            {
                sub: user.id_User,
                name: user.nome,
                email: user.email,
                access: user.roleId,
                clinicaId: user.id_Clinica,
            },
            {
                secret: this.jwtConfiguration.secret,
                expiresIn: this.jwtConfiguration.jwtTtl,
                audience: this.jwtConfiguration.audience,
                issuer: this.jwtConfiguration.issuer,
            },
        );

        return { token };
    }
}
