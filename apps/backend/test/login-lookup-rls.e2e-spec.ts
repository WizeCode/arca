import { INestApplication } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { UUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { createTestApp } from './setup';
import { PrismaService } from 'src/prisma/prisma.service';
import { TENANT_PRISMA, TenantPrismaClient } from 'src/prisma/prisma.module';
import type { TenantClsStore } from 'src/prisma/tenant.extension';
import { RoleAccess } from 'src/common/enums/status.enum';

/**
 * ADR 0001, seção 5 — auth.service.ts#validateUser busca o Usuario por e-mail
 * antes de saber a clínica (é essa busca que descobre a clínica), então não
 * há app.current_clinica_id setado nessa conexão. Este teste roda contra o
 * Postgres real (não mocka o Prisma) porque o bug só existe na interação
 * entre a policy de RLS e a role de conexão da aplicação — nenhum mock
 * reproduziria isso.
 */
describe('Login lookup vs. Row-Level Security (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let tenantPrisma: TenantPrismaClient;
    let cls: ClsService<TenantClsStore>;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);
        tenantPrisma = app.get(TENANT_PRISMA);
        cls = app.get(ClsService);
    });

    afterAll(async () => {
        await app.close();
    });

    it('finds the seeded user via buscar_usuario_login with no app.current_clinica_id set on the connection', async () => {
        const rows = await prisma.$queryRaw<{ id_user: string; email: string }[]>`
            SELECT * FROM buscar_usuario_login(${'admin@arca.com'})
        `;

        expect(rows).toHaveLength(1);
        expect(rows[0].email).toBe('admin@arca.com');
    });

    it('returns no rows from buscar_usuario_login for a non-existent email', async () => {
        const rows = await prisma.$queryRaw<unknown[]>`
            SELECT * FROM buscar_usuario_login(${'does-not-exist@arca.com'})
        `;

        expect(rows).toHaveLength(0);
    });

    it('still blocks a direct, unmediated SELECT on USUARIOS with no app.current_clinica_id set', async () => {
        const rows = await prisma.$queryRaw<unknown[]>`
            SELECT "ID_User" FROM "USUARIOS" WHERE email = ${'admin@arca.com'}
        `;

        expect(rows).toHaveLength(0);
    });

    it('still blocks a direct SELECT on another tenant-scoped table (LISTA_ESPERA) with no app.current_clinica_id set', async () => {
        const rows = await prisma.$queryRaw<{ c: number }[]>`
            SELECT count(*)::int AS c FROM "LISTA_ESPERA"
        `;

        expect(rows[0].c).toBe(0);
    });

    describe('clínica inativa bloqueia buscar_usuario_login', () => {
        const email = 'usuario-clinica-inativa-login@arca.com';
        let clinicaInativaId: UUID;

        beforeAll(async () => {
            const clinicaInativa = await prisma.clinica.create({
                data: { nome: 'Clínica Inativa (teste e2e)', slug: 'clinica-inativa-login-teste', isActive: false },
            });
            clinicaInativaId = clinicaInativa.id_Clinica as UUID;

            await cls.runWith({ clinicaId: clinicaInativaId }, async () => {
                await tenantPrisma.usuario.create({
                    data: {
                        nome: 'Usuário Clínica Inativa',
                        email,
                        senhaHash: 'hash-placeholder-teste',
                        roleId: RoleAccess.ADMIN,
                    } as Prisma.UsuarioUncheckedCreateInput,
                });
            });
        });

        afterAll(async () => {
            await cls.runWith({ clinicaId: clinicaInativaId }, async () => {
                await tenantPrisma.usuario.deleteMany({ where: { email } });
            });
            await prisma.clinica.delete({ where: { id_Clinica: clinicaInativaId } });
        });

        it('returns no rows from buscar_usuario_login for a user whose clinica is inactive', async () => {
            const rows = await prisma.$queryRaw<unknown[]>`
                SELECT * FROM buscar_usuario_login(${email})
            `;

            expect(rows).toHaveLength(0);
        });
    });
});
