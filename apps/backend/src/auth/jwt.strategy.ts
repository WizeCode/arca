import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenDto } from 'src/common/dto/token.dto';
import type { TenantClsStore } from 'src/prisma/tenant.extension';
import jwtConfig from './config/jwt.config';
import { ConfigType } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cls: ClsService<TenantClsStore>,
        @Inject(jwtConfig.KEY)
        private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    ) {
        if (!jwtConfiguration.secret) {
            throw new Error('JWT secret is not defined');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtConfiguration.secret,
        });
    }

    async validate(payload: TokenDto) {
        const user = await this.prisma.usuario.findUnique({
            where: { id_User: payload.sub },
        });

        if (!user?.isActive) {
            throw new UnauthorizedException();
        }

        if (user.id_Clinica !== payload.clinicaId) {
            throw new UnauthorizedException();
        }

        this.cls.set('clinicaId', user.id_Clinica);

        return {
            ...payload,
        };
    }
}
