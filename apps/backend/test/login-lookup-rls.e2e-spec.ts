import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup';
import { PrismaService } from 'src/prisma/prisma.service';

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

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);
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
});
