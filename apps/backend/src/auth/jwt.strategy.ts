import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenDto } from 'src/common/dto/token.dto';
import type { TenantClsStore } from 'src/prisma/tenant.extension';
import jwtConfig from './config/jwt.config';
import { ConfigType } from '@nestjs/config';

interface JwtLookupRow {
    id_user: string;
    is_active: boolean;
    id_clinica: string;
}

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
        // Busca por id_User acontece antes de sabermos a clínica atual do usuário
        // (é o que essa consulta descobre, pra comparar com o clinicaId do token),
        // então não há app.current_clinica_id para setar aqui. Mesmo problema de
        // auth.service.ts#validateUser (ver migração add_login_lookup_function) —
        // busca passa pela função SECURITY DEFINER buscar_usuario_por_id.
        const rows = await this.prisma.$queryRaw<JwtLookupRow[]>`
            SELECT * FROM buscar_usuario_por_id(${payload.sub}::uuid)
        `;
        const user = rows[0];

        if (!user?.is_active) {
            throw new UnauthorizedException();
        }

        if (user.id_clinica !== payload.clinicaId) {
            throw new UnauthorizedException();
        }

        this.cls.set('clinicaId', user.id_clinica);

        return {
            ...payload,
        };
    }
}
