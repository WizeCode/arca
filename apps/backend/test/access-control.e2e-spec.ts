import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './setup';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoService } from 'src/crypto/crypto.service';
import {
    RoleAccess,
    StatusListaEspera,
    StatusAtendimento,
    TipoAtendimento,
    StatusProntuario,
    TipoProntuario,
} from 'src/common/enums/status.enum';

describe('Access Control (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let cryptoService: CryptoService;

    let adminToken: string;
    let estagiario1Token: string;
    let estagiario2Token: string;
    let supervisor1Token: string;
    let supervisor2Token: string;

    let estagiario1: { id_User: string };
    let supervisor1: { id_User: string };
    let estagiario2: { id_User: string };
    let supervisor2: { id_User: string };

    let paciente1: { id_Lista: string };
    let paciente2: { id_Lista: string };
    let atendimento1: { id_Atendimento: string };
    let atendimento2: { id_Atendimento: string };
    let prontuario1: { id_Registro: string };
    let prontuario2: { id_Registro: string };

    beforeAll(async () => {
        app = await createTestApp();
        const server = app.getHttpServer();
        prisma = app.get(PrismaService);
        cryptoService = app.get(CryptoService);

        adminToken = (
            await request(server).post('/auth/login').send({ email: 'admin@arca.com', password: 'Admin123!' })
        ).body.token;

        estagiario2 = (
            await request(server).post('/users').set('Authorization', `Bearer ${adminToken}`).send({
                nome: 'Estagiario 2 E2E',
                email: 'estagiario2@e2e.com',
                senha: 'Est2E2E123!',
                roleId: RoleAccess.ESTAGIARIO,
            })
        ).body;

        supervisor2 = (
            await request(server).post('/users').set('Authorization', `Bearer ${adminToken}`).send({
                nome: 'Supervisor 2 E2E',
                email: 'supervisor2@e2e.com',
                senha: 'Sup2E2E123!',
                roleId: RoleAccess.SUPERVISOR,
                crp: '06/99999',
            })
        ).body;

        estagiario1 = await prisma.usuario.findFirstOrThrow({ where: { email: 'estagiario@arca.com' } });
        supervisor1 = await prisma.usuario.findFirstOrThrow({ where: { email: 'supervisor@arca.com' } });

        estagiario1Token = (
            await request(server).post('/auth/login').send({ email: 'estagiario@arca.com', password: 'Estagiario123!' })
        ).body.token;

        estagiario2Token = (
            await request(server).post('/auth/login').send({ email: 'estagiario2@e2e.com', password: 'Est2E2E123!' })
        ).body.token;

        supervisor1Token = (
            await request(server).post('/auth/login').send({ email: 'supervisor@arca.com', password: 'Supervisor123!' })
        ).body.token;

        supervisor2Token = (
            await request(server).post('/auth/login').send({ email: 'supervisor2@e2e.com', password: 'Sup2E2E123!' })
        ).body.token;

        paciente1 = await prisma.listaEspera.create({
            data: {
                nomeRegistro: 'Paciente E2E 1',
                dataNascimento: new Date('1990-01-01'),
                telefonePessoal: '34999990001',
                contatoEmergencia: '34999990002',
                CPF: '00000000001',
                enderecoRua: 'Rua E2E',
                enderecoNumero: '100',
                enderecoBairro: 'Bairro E2E',
                enderecoCidade: 'Uberaba',
                enderecoEstado: 'MG',
                enderecoCEP: '38000000',
                id_Genero: 1,
                id_Etnia: 1,
                id_Escolaridade: 1,
                id_Status: StatusListaEspera.EM_TRIAGEM,
            },
        });

        paciente2 = await prisma.listaEspera.create({
            data: {
                nomeRegistro: 'Paciente E2E 2',
                dataNascimento: new Date('1995-05-15'),
                telefonePessoal: '34999990003',
                contatoEmergencia: '34999990004',
                CPF: '00000000002',
                enderecoRua: 'Rua E2E',
                enderecoNumero: '200',
                enderecoBairro: 'Bairro E2E',
                enderecoCidade: 'Uberaba',
                enderecoEstado: 'MG',
                enderecoCEP: '38000000',
                id_Genero: 1,
                id_Etnia: 1,
                id_Escolaridade: 1,
                id_Status: StatusListaEspera.EM_TRIAGEM,
            },
        });

        atendimento1 = await prisma.atendimento.create({
            data: {
                dataHoraInicio: new Date('2025-06-01T09:00:00'),
                dataHoraFim: new Date('2025-06-01T10:00:00'),
                id_Lista: paciente1.id_Lista,
                id_Estagiario_Executor: estagiario1.id_User,
                id_Supervisor_Executor: supervisor1.id_User,
                id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                id_Status: StatusAtendimento.EM_ANDAMENTO,
            },
        });

        atendimento2 = await prisma.atendimento.create({
            data: {
                dataHoraInicio: new Date('2025-06-02T09:00:00'),
                dataHoraFim: new Date('2025-06-02T10:00:00'),
                id_Lista: paciente2.id_Lista,
                id_Estagiario_Executor: estagiario2.id_User,
                id_Supervisor_Executor: supervisor2.id_User,
                id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                id_Status: StatusAtendimento.EM_ANDAMENTO,
            },
        });

        prontuario1 = await prisma.prontuario.create({
            data: {
                id_Atendimento: atendimento1.id_Atendimento,
                conteudo: cryptoService.encrypt({ relatorioDaSessao: 'Relatorio E2E 1', presente: true }),
                id_Status: StatusProntuario.EM_APROVACAO,
                id_Tipo: TipoProntuario.TRIAGEM,
            },
        });

        prontuario2 = await prisma.prontuario.create({
            data: {
                id_Atendimento: atendimento2.id_Atendimento,
                conteudo: cryptoService.encrypt({ relatorioDaSessao: 'Relatorio E2E 2', presente: true }),
                id_Status: StatusProntuario.EM_APROVACAO,
                id_Tipo: TipoProntuario.TRIAGEM,
            },
        });
    }, 30000);

    afterAll(async () => {
        await prisma.prontuario.deleteMany({
            where: { id_Registro: { in: [prontuario1.id_Registro, prontuario2.id_Registro] } },
        });
        await prisma.atendimento.deleteMany({
            where: { id_Atendimento: { in: [atendimento1.id_Atendimento, atendimento2.id_Atendimento] } },
        });
        await prisma.listaEspera.deleteMany({
            where: { id_Lista: { in: [paciente1.id_Lista, paciente2.id_Lista] } },
        });
        await prisma.logAuditoria.deleteMany({
            where: { id_Usuario_Executor: { in: [estagiario2.id_User, supervisor2.id_User] } },
        });
        await prisma.usuario.deleteMany({
            where: { id_User: { in: [estagiario2.id_User, supervisor2.id_User] } },
        });
        await app.close();
    });

    describe('Estagiario isolation', () => {
        it('should return only own patients on GET /medical-record/prontuarios', async () => {
            const res = await request(app.getHttpServer())
                .get('/medical-record/prontuarios')
                .set('Authorization', `Bearer ${estagiario1Token}`)
                .expect(200);

            const ids = res.body.data.map((p: any) => p.id_Lista);
            expect(ids).toContain(paciente1.id_Lista);
            expect(ids).not.toContain(paciente2.id_Lista);
        });

        it('should return 404 when accessing another estagiario patient', async () => {
            await request(app.getHttpServer())
                .get(`/medical-record/prontuarios/${paciente2.id_Lista}`)
                .set('Authorization', `Bearer ${estagiario1Token}`)
                .expect(404);
        });

        it('should return 200 when accessing own patient', async () => {
            const res = await request(app.getHttpServer())
                .get(`/medical-record/prontuarios/${paciente1.id_Lista}`)
                .set('Authorization', `Bearer ${estagiario1Token}`)
                .expect(200);

            expect(res.body.nomeRegistro).toBe('Paciente E2E 1');
            expect(res.body.Atendimento).toBeDefined();
            expect(res.body.Atendimento.length).toBeGreaterThan(0);
        });

        it('should return 403 when editing another estagiario prontuario', async () => {
            await request(app.getHttpServer())
                .put(`/medical-record/triagem/${prontuario2.id_Registro}`)
                .set('Authorization', `Bearer ${estagiario1Token}`)
                .send({ relatorioDaSessao: 'Tentativa indevida', presente: true })
                .expect(403);
        });

        it('should return 200 when editing own prontuario', async () => {
            await request(app.getHttpServer())
                .put(`/medical-record/triagem/${prontuario1.id_Registro}`)
                .set('Authorization', `Bearer ${estagiario1Token}`)
                .send({ relatorioDaSessao: 'Relatorio atualizado pelo estagiario', presente: true })
                .expect(200);
        });
    });

    describe('Supervisor isolation', () => {
        it('should return only own patients on GET /medical-record/prontuarios', async () => {
            const res = await request(app.getHttpServer())
                .get('/medical-record/prontuarios')
                .set('Authorization', `Bearer ${supervisor1Token}`)
                .expect(200);

            const ids = res.body.data.map((p: any) => p.id_Lista);
            expect(ids).toContain(paciente1.id_Lista);
            expect(ids).not.toContain(paciente2.id_Lista);
        });

        it('should return 404 when accessing another supervisor patient', async () => {
            await request(app.getHttpServer())
                .get(`/medical-record/prontuarios/${paciente2.id_Lista}`)
                .set('Authorization', `Bearer ${supervisor1Token}`)
                .expect(404);
        });
    });

    describe('Admin full access', () => {
        it('should return all patients on GET /medical-record/prontuarios', async () => {
            const res = await request(app.getHttpServer())
                .get('/medical-record/prontuarios')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            const ids = res.body.data.map((p: any) => p.id_Lista);
            expect(ids).toContain(paciente1.id_Lista);
            expect(ids).toContain(paciente2.id_Lista);
        });
    });
});
