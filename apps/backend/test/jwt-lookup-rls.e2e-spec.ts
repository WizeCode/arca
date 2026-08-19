import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * ADR 0001, seção 5 — jwt.strategy.ts#validate busca o Usuario por id_User
 * para descobrir a clínica atual e comparar com o clinicaId do token, antes
 * de qualquer app.current_clinica_id estar setado nessa conexão (é essa
 * busca que estabeleceria esse valor). Este teste roda contra o Postgres
 * real (não mocka o Prisma) pelo mesmo motivo de login-lookup-rls.e2e-spec:
 * o bug só existe na interação entre a policy de RLS e a role de conexão da
 * aplicação.
 */
describe('JWT lookup vs. Row-Level Security (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let tenantPrisma: TenantPrismaClient;
    let cls: ClsService<TenantClsStore>;

    let seededAdminId: string;
    let seededAdminClinicaId: string;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);
        tenantPrisma = app.get(TENANT_PRISMA);
        cls = app.get(ClsService);

        const clinicaPadrao = await prisma.clinica.findFirstOrThrow({ where: { slug: 'clinica-padrao' } });
        seededAdminClinicaId = clinicaPadrao.id_Clinica;

        await cls.runWith({ clinicaId: seededAdminClinicaId as UUID }, async () => {
            const admin = await tenantPrisma.usuario.findFirstOrThrow({ where: { email: 'admin@arca.com' } });
            seededAdminId = admin.id_User;
        });
    });

    afterAll(async () => {
        await app.close();
    });

    it('finds the seeded admin via buscar_usuario_por_id with no app.current_clinica_id set on the connection', async () => {
        const rows = await prisma.$queryRaw<{ id_user: string; is_active: boolean; id_clinica: string }[]>`
            SELECT * FROM buscar_usuario_por_id(${seededAdminId}::uuid)
        `;

        expect(rows).toHaveLength(1);
        expect(rows[0].is_active).toBe(true);
        expect(rows[0].id_clinica).toBe(seededAdminClinicaId);
    });

    it('returns no rows from buscar_usuario_por_id for a non-existent id_User', async () => {
        const rows = await prisma.$queryRaw<unknown[]>`
            SELECT * FROM buscar_usuario_por_id(${'00000000-0000-0000-0000-000000000000'}::uuid)
        `;

        expect(rows).toHaveLength(0);
    });

    it('still blocks a direct, unmediated SELECT on USUARIOS with no app.current_clinica_id set', async () => {
        const rows = await prisma.$queryRaw<unknown[]>`
            SELECT "ID_User" FROM "USUARIOS" WHERE "ID_User" = ${seededAdminId}::uuid
        `;

        expect(rows).toHaveLength(0);
    });

    it('still blocks a direct SELECT on another tenant-scoped table (LISTA_ESPERA) with no app.current_clinica_id set', async () => {
        const rows = await prisma.$queryRaw<{ c: number }[]>`
            SELECT count(*)::int AS c FROM "LISTA_ESPERA"
        `;

        expect(rows[0].c).toBe(0);
    });

    it('arca_auth no longer has a blanket RLS bypass (scoped instead via the auth_lookup policy)', async () => {
        const rows = await prisma.$queryRaw<{ rolbypassrls: boolean }[]>`
            SELECT rolbypassrls FROM pg_roles WHERE rolname = 'arca_auth'
        `;

        expect(rows[0].rolbypassrls).toBe(false);
    });
});
