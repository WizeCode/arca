import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
    // eslint-disable-next-line no-var -- Jest só compartilha estado entre globalSetup e
    // globalTeardown (mesmo processo Node) via globalThis; var é exigido para module augmentation.
    var __ARCA_PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

const execFileAsync = promisify(execFile);

const BACKEND_ROOT = path.resolve(__dirname, '..');

const POSTGRES_IMAGE = 'pgvector/pgvector:pg18';
const DATABASE_NAME = 'arca_e2e';
const ROOT_USERNAME = 'arca_root';
const ROOT_PASSWORD = 'arca_root_e2e_password';
const APP_PASSWORD = 'arca_app_e2e_password';
const AUTH_PASSWORD = 'arca_auth_e2e_password';

function resolveHost(container: StartedPostgreSqlContainer): string {
    const host = container.getHost();
    // No Windows, Docker Desktop publica a porta do container só em 127.0.0.1;
    // "localhost" resolve para ::1 (IPv6) primeiro, que não é alcançável — a
    // engine do Prisma falha com P1001 ("Can't reach database server"). Forçar
    // IPv4 evita isso (confirmado: 3/3 falhas com "localhost", 3/3 sucessos
    // com 127.0.0.1 contra o mesmo container).
    return host === 'localhost' ? '127.0.0.1' : host;
}

function buildConnectionUri(container: StartedPostgreSqlContainer, username: string, password: string): string {
    return `postgresql://${username}:${password}@${resolveHost(container)}:${container.getPort()}/${container.getDatabase()}`;
}

async function createApplicationRoles(container: StartedPostgreSqlContainer): Promise<void> {
    // arca_app e arca_auth são roles do cluster Postgres, não do schema da aplicação
    // (docs/ARQUITETURA.md, "Roles de banco de dados") — a migração
    // grant_arca_app_privileges assume que já existem antes de rodar, então
    // precisam ser criadas aqui, antes de `prisma migrate deploy`.
    const createRolesSql = [
        `CREATE ROLE arca_app WITH LOGIN PASSWORD '${APP_PASSWORD}';`,
        `CREATE ROLE arca_auth WITH LOGIN PASSWORD '${AUTH_PASSWORD}';`,
    ].join(' ');

    const result = await container.exec([
        'psql',
        '-U',
        container.getUsername(),
        '-d',
        container.getDatabase(),
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        createRolesSql,
    ]);

    if (result.exitCode !== 0) {
        throw new Error(`Falha ao criar as roles arca_app/arca_auth no container Postgres:\n${result.output}`);
    }
}

function resolvePrismaCli(): string {
    // Invocar o script do CLI direto via `node` (em vez de `npx prisma`) evita
    // depender de `npx.cmd` no Windows: `execFile` sem `shell: true` não consegue
    // rodar arquivos .cmd (EINVAL), e `shell: true` traz um alerta de depreciação
    // do Node sobre args não escapados — desnecessário já que args aqui é sempre
    // string literal fixa, nunca dado externo.
    return require.resolve('prisma/build/index.js', { paths: [BACKEND_ROOT] });
}

async function runPrismaCommand(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
    try {
        await execFileAsync(process.execPath, [resolvePrismaCli(), ...args], {
            cwd: BACKEND_ROOT,
            env: { ...process.env, ...env },
            maxBuffer: 1024 * 1024 * 20,
        });
    } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; message: string };
        throw new Error(
            `\`prisma ${args.join(' ')}\` falhou durante o setup do testcontainers.\n` +
                `stdout:\n${execError.stdout ?? ''}\nstderr:\n${execError.stderr ?? execError.message}`,
        );
    }
}

export default async function globalSetup(): Promise<void> {
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
        .withDatabase(DATABASE_NAME)
        .withUsername(ROOT_USERNAME)
        .withPassword(ROOT_PASSWORD)
        .start();

    await createApplicationRoles(container);

    const rootUrl = buildConnectionUri(container, ROOT_USERNAME, ROOT_PASSWORD);
    const appUrl = buildConnectionUri(container, 'arca_app', APP_PASSWORD);

    // DIRECT_URL (role dona do schema) roda as migrações reais, incluindo RLS
    // e as funções SECURITY DEFINER — sem isso, `GRANT ... TO arca_app` e
    // `ALTER ROLE arca_auth ...` falhariam (migração grant_arca_app_privileges).
    await runPrismaCommand(['migrate', 'deploy'], { DATABASE_URL: appUrl, DIRECT_URL: rootUrl });

    // Seed roda com a role root (superuser), não arca_app: prisma/seed.ts usa um
    // PrismaClient cru sem a tenant extension, então nenhuma sessão tem
    // app.current_clinica_id setado — com FORCE ROW LEVEL SECURITY em USUARIOS,
    // a role arca_app teria o primeiro `usuario.create()` bloqueado pela policy
    // tenant_isolation. A role root faz bypass de RLS por ser superuser.
    // Decisão confirmada com o usuário: isso destrava só o teste; o mesmo
    // problema existe hoje em qualquer provisionamento real de ambiente novo,
    // e fica para uma tarefa separada.
    await runPrismaCommand(['db', 'seed'], { DATABASE_URL: rootUrl, DIRECT_URL: rootUrl });

    process.env.DATABASE_URL = appUrl;
    process.env.DIRECT_URL = rootUrl;

    globalThis.__ARCA_PG_CONTAINER__ = container;
}
