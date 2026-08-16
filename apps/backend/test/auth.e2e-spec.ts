import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './setup';

describe('Auth (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await createTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should be defined', () => {
        expect(app).toBeDefined();
    });

    it('should return 200 when successfuly login', async () => {
        const res = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: 'admin@arca.com', password: 'Admin123!' })
            .expect(200);

        expect(res.body.token).toBeDefined();
    });

    it('should return 401 when password is wrong', async () => {
        await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: 'admin@arca.com', password: 'Poop123!' })
            .expect(401);
    });

    it('should return 401 when non-existent email', async () => {
        await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: 'random@arca.com', password: 'Poop123!' })
            .expect(401);
    });

    it('should return 401 when trying to access protected route without token', async () => {
        await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('should return 200 when trying to access protected route with token', async () => {
        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: 'admin@arca.com', password: 'Admin123!' })
            .expect(200);

        await request(app.getHttpServer())
            .get('/users')
            .set('Authorization', `Bearer ${loginRes.body.token}`)
            .expect(200);
    });
});
