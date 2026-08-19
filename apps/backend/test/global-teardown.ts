import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
    // eslint-disable-next-line no-var -- ver global-setup.ts
    var __ARCA_PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function globalTeardown(): Promise<void> {
    const container = globalThis.__ARCA_PG_CONTAINER__;
    if (!container) {
        return;
    }
    await container.stop();
}
