import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoService } from 'src/crypto/crypto.service';
import {
    RoleAccess,
    StatusAtendimento,
    StatusListaEspera,
    TipoProntuario,
    TipoAtendimento,
} from 'src/common/enums/status.enum';
import { CreateSessionDto } from './dto/create-session.dto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TokenDto } from 'src/common/dto/token.dto';
import { UUID } from 'node:crypto';
import { UpdateSessionDto } from './dto/update-session.dto';

describe('SessionService', () => {
    let service: SessionService;

    const mockPrisma = {
        listaEspera: {
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
        },
        atendimento: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        usuario: { findUnique: jest.fn() },
        prontuario: { findFirst: jest.fn() },
        $transaction: jest.fn(),
    };

    const mockCrypto = { decryptConteudo: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SessionService,
                {
                    provide: CryptoService,
                    useValue: mockCrypto,
                },
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<SessionService>(SessionService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('Sessions CRUD', () => {
        describe('create', () => {
            describe('screening', () => {
                it('should create a new screening session', async () => {
                    const sessionToBeCreated = {
                        dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                        dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                        id_Lista: 'uuid_list',
                        id_Estagiario_Executor: 'uuid_intern',
                        id_Supervisor_Executor: 'uuid_supervisor',
                        id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                    };

                    const patient = {
                        id_Lista: 'uuid_list',
                        id_Status: StatusListaEspera.EM_ESPERA,
                    };

                    const intern = {
                        roleId: RoleAccess.ESTAGIARIO,
                        isActive: true,
                    };

                    const supervisor = {
                        roleId: RoleAccess.SUPERVISOR,
                        isActive: true,
                    };

                    const sessionCriada = { id_Atendimento: 'uuid-session' };

                    mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                    mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                    mockPrisma.usuario.findUnique.mockResolvedValueOnce(supervisor);
                    mockPrisma.atendimento.findFirst.mockResolvedValue(undefined);
                    mockPrisma.$transaction.mockResolvedValue([sessionCriada]);

                    const result = await service.create(sessionToBeCreated as CreateSessionDto);
                    expect(result).toEqual(sessionCriada);
                });

                it('should throw BadRequestException when patient is not with status = "EM_ESPERA"', async () => {
                    const sessionToBeCreated = {
                        dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                        dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                        id_Lista: 'uuid_list',
                        id_Estagiario_Executor: 'uuid_intern',
                        id_Supervisor_Executor: 'uuid_supervisor',
                        id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                    };

                    const patient = {
                        id_Lista: 'uuid_list',
                        id_Status: StatusListaEspera.EM_TRIAGEM,
                    };

                    mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                    await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                        BadRequestException,
                    );
                });
            });

            describe('psicotherapy', () => {
                it('should create a new psicotherapy session', async () => {
                    const sessionToBeCreated = {
                        dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                        dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                        id_Lista: 'uuid_list',
                        id_Estagiario_Executor: 'uuid_intern',
                        id_Supervisor_Executor: 'uuid_supervisor',
                        id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA,
                    };

                    const patient = {
                        id_Lista: 'uuid_list',
                        id_Status: StatusListaEspera.TRIAGEM_APROVADA,
                    };

                    const intern = {
                        roleId: RoleAccess.ESTAGIARIO,
                        isActive: true,
                    };

                    const supervisor = {
                        roleId: RoleAccess.SUPERVISOR,
                        isActive: true,
                    };

                    const sessionCriada = { id_Atendimento: 'uuid-session' };

                    mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                    mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                    mockPrisma.usuario.findUnique.mockResolvedValueOnce(supervisor);
                    mockPrisma.atendimento.findFirst.mockResolvedValue(undefined);
                    mockPrisma.$transaction.mockResolvedValue([sessionCriada]);

                    const result = await service.create(sessionToBeCreated as CreateSessionDto);
                    expect(result).toEqual(sessionCriada);
                });

                it('should throw BadRequestException when patient is not with propper status', async () => {
                    const sessionToBeCreated = {
                        dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                        dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                        id_Lista: 'uuid_list',
                        id_Estagiario_Executor: 'uuid_intern',
                        id_Supervisor_Executor: 'uuid_supervisor',
                        id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA,
                    };

                    const patient = {
                        id_Lista: 'uuid_list',
                        id_Status: StatusListaEspera.EM_ESPERA,
                    };

                    mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                    await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                        BadRequestException,
                    );
                });
            });

            it('should throw BadRequestException when patient is not found', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(undefined);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when patient is with final status', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.RECEBEU_ALTA,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when session type is wrong', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: 3,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_TRIAGEM,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when intern is not found', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(undefined);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when supervisor is not found', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(undefined);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when intern already has a session at the same time (overlap)', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const supervisor = {
                    roleId: RoleAccess.SUPERVISOR,
                    isActive: true,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(supervisor);
                mockPrisma.atendimento.findFirst.mockResolvedValue({ id_Atendimento: 'uuid-conflict' });

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when start date is beyond the final date', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 4 * 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const supervisor = {
                    roleId: RoleAccess.SUPERVISOR,
                    isActive: true,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(supervisor);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when date is from the past', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() - 2 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const supervisor = {
                    roleId: RoleAccess.SUPERVISOR,
                    isActive: true,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(supervisor);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when intern is not active', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: false,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when intern is not with intern role', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.SUPERVISOR,
                    isActive: true,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when supervisor is not active', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const supervisor = {
                    roleId: RoleAccess.SUPERVISOR,
                    isActive: false,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(supervisor);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw BadRequestException when supervisor is not with supervisor role', async () => {
                const sessionToBeCreated = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    id_Lista: 'uuid_list',
                    id_Estagiario_Executor: 'uuid_intern',
                    id_Supervisor_Executor: 'uuid_supervisor',
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                };

                const patient = {
                    id_Lista: 'uuid_list',
                    id_Status: StatusListaEspera.EM_ESPERA,
                };

                const intern = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const supervisor = {
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(intern);
                mockPrisma.usuario.findUnique.mockResolvedValueOnce(supervisor);

                await expect(service.create(sessionToBeCreated as CreateSessionDto)).rejects.toThrow(
                    BadRequestException,
                );
            });
        });

        describe('read', () => {
            describe('findAll', () => {
                it('should return all sessions for admin/secretario', async () => {
                    const user = { sub: 'uuid-admin', access: RoleAccess.ADMIN } as unknown as TokenDto;
                    const pagination = { page: 1, limit: 20 };
                    const sessions = [{ id_Atendimento: 'uuid-1' }];

                    mockPrisma.atendimento.findMany.mockResolvedValue(sessions);
                    mockPrisma.atendimento.count.mockResolvedValue(1);

                    const result = await service.findAll(user, pagination);

                    expect(mockPrisma.atendimento.findMany).toHaveBeenCalledWith(
                        expect.objectContaining({ where: {} }),
                    );
                    expect(result).toEqual({
                        data: sessions,
                        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
                    });
                });

                it('should filter by supervisor when user is supervisor', async () => {
                    const user = { sub: 'uuid-supervisor', access: RoleAccess.SUPERVISOR } as unknown as TokenDto;
                    const pagination = { page: 1, limit: 20 };

                    mockPrisma.atendimento.findMany.mockResolvedValue([]);
                    mockPrisma.atendimento.count.mockResolvedValue(0);

                    await service.findAll(user, pagination);

                    expect(mockPrisma.atendimento.findMany).toHaveBeenCalledWith(
                        expect.objectContaining({ where: { id_Supervisor_Executor: 'uuid-supervisor' } }),
                    );
                });

                it('should filter by intern when user is intern', async () => {
                    const user = { sub: 'uuid-intern', access: RoleAccess.ESTAGIARIO } as unknown as TokenDto;
                    const pagination = { page: 1, limit: 20 };

                    mockPrisma.atendimento.findMany.mockResolvedValue([]);
                    mockPrisma.atendimento.count.mockResolvedValue(0);

                    await service.findAll(user, pagination);

                    expect(mockPrisma.atendimento.findMany).toHaveBeenCalledWith(
                        expect.objectContaining({ where: { id_Estagiario_Executor: 'uuid-intern' } }),
                    );
                });
            });

            describe('findOne', () => {
                it('should return a session with decrypted prontuarios', async () => {
                    const user = { sub: 'uuid-admin', access: RoleAccess.ADMIN } as unknown as TokenDto;
                    const id = 'uuid-session' as UUID;

                    const session = {
                        id_Atendimento: id,
                        id_Supervisor_Executor: 'uuid-supervisor',
                        id_Estagiario_Executor: 'uuid-intern',
                        Prontuario: [{ id_Registro: 'uuid-pront', conteudo: 'encrypted-content' }],
                    };

                    mockPrisma.atendimento.findUnique.mockResolvedValue(session);
                    mockCrypto.decryptConteudo.mockReturnValue('decrypted-content');

                    const result = await service.findOne(id, user);
                    expect(result).toEqual({
                        ...session,
                        Prontuario: [{ id_Registro: 'uuid-pront', conteudo: 'decrypted-content' }],
                    });
                });

                it('should throw NotFoundException when session is not found', async () => {
                    const user = { sub: 'uuid-admin', access: RoleAccess.ADMIN } as unknown as TokenDto;
                    const id = 'uuid-session' as UUID;

                    mockPrisma.atendimento.findUnique.mockResolvedValue(undefined);

                    await expect(service.findOne(id, user)).rejects.toThrow(NotFoundException);
                });

                it('should throw ForbiddenException when supervisor tries to access a session that is not theirs', async () => {
                    const user = { sub: 'uuid-supervisor', access: RoleAccess.SUPERVISOR } as unknown as TokenDto;
                    const id = 'uuid-session' as UUID;

                    const session = {
                        id_Atendimento: id,
                        id_Supervisor_Executor: 'uuid-other-supervisor',
                        id_Estagiario_Executor: 'uuid-intern',
                        Prontuario: [],
                    };

                    mockPrisma.atendimento.findUnique.mockResolvedValue(session);

                    await expect(service.findOne(id, user)).rejects.toThrow(ForbiddenException);
                });
            });

            describe('findAllWithNoSessions', () => {
                it('should return all patients with no session appointed', async () => {
                    const patients = [
                        {
                            id_Lista: 'uuid-1',
                            Status: 'Triagem Aprovada',
                        },
                        {
                            id_Lista: 'uuid-2',
                            Status: 'Em Psicoterapia',
                        },
                    ];
                    mockPrisma.listaEspera.findMany.mockResolvedValue(patients);
                    const result = await service.findAllWithNoSession();
                    expect(result).toEqual(patients);
                });
            });
        });

        describe('update', () => {
            it('should update a session', async () => {
                const sessionToBeUpdated = {
                    id_Atendimento: 'uuid_session',
                };

                const data = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                } as UpdateSessionDto;

                const sessionUpdated = {
                    id_Atendimento: 'uuid_session',
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                };

                mockPrisma.atendimento.findUnique.mockResolvedValue(sessionToBeUpdated);
                mockPrisma.atendimento.findFirst.mockResolvedValue(undefined);
                mockPrisma.atendimento.update.mockResolvedValue(sessionUpdated);

                const result = await service.update('uuid_session' as UUID, data);
                expect(result).toEqual(sessionUpdated);
            });

            it('should throw NotFoundException when session is not found', async () => {
                const data = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                } as UpdateSessionDto;

                mockPrisma.atendimento.findUnique.mockResolvedValue(undefined);
                await expect(service.update('uuid_session' as UUID, data)).rejects.toThrow(NotFoundException);
            });

            it('should throw BadRequestException when start date is beyond the final date', async () => {
                const sessionToBeUpdated = {
                    id_Atendimento: 'uuid_session',
                };

                const data = {
                    dataHoraInicio: new Date(Date.now() + 4 * 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                } as UpdateSessionDto;

                mockPrisma.atendimento.findUnique.mockResolvedValue(sessionToBeUpdated);
                await expect(service.update('uuid_session' as UUID, data)).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException when date is from the past', async () => {
                const sessionToBeUpdated = {
                    id_Atendimento: 'uuid_session',
                };

                const data = {
                    dataHoraInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() - 2 * 60 * 60 * 1000),
                } as UpdateSessionDto;

                mockPrisma.atendimento.findUnique.mockResolvedValue(sessionToBeUpdated);
                await expect(service.update('uuid_session' as UUID, data)).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException when intern already has a session at the same time (overlap)', async () => {
                const sessionToBeUpdated = {
                    id_Atendimento: 'uuid_session',
                };

                const data = {
                    dataHoraInicio: new Date(Date.now() + 60 * 60 * 1000),
                    dataHoraFim: new Date(Date.now() + 2 * 60 * 60 * 1000),
                } as UpdateSessionDto;

                mockPrisma.atendimento.findUnique.mockResolvedValue(sessionToBeUpdated);
                mockPrisma.atendimento.findFirst.mockResolvedValue({ id_Atendimento: 'uuid-conflict' });
                await expect(service.update('uuid_session' as UUID, data)).rejects.toThrow(BadRequestException);
            });
        });

        describe('remove', () => {
            it('should cancel a screening session', async () => {
                const session = {
                    id_Atendimento: 'uuid-session',
                    id_Status: StatusAtendimento.ATIVO,
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                    id_Lista: 'uuid-lista',
                };

                mockPrisma.atendimento.findUnique.mockResolvedValue(session);
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.remove('uuid-session' as UUID);
                expect(result).toEqual({ message: 'Sessão (uuid-session) cancelada com sucesso.' });
            });

            it('should cancel a psicotherapy session when there are no other approved records', async () => {
                const session = {
                    id_Atendimento: 'uuid-session',
                    id_Status: StatusAtendimento.ATIVO,
                    id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA,
                    id_Lista: 'uuid-lista',
                };

                mockPrisma.atendimento.findUnique.mockResolvedValue(session);
                mockPrisma.prontuario.findFirst.mockResolvedValue(undefined);
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.remove('uuid-session' as UUID);
                expect(result).toEqual({ message: 'Sessão (uuid-session) cancelada com sucesso.' });
            });

            it('should cancel a psicotherapy session when there are other approved records', async () => {
                const session = {
                    id_Atendimento: 'uuid-session',
                    id_Status: StatusAtendimento.ATIVO,
                    id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA,
                    id_Lista: 'uuid-lista',
                };

                mockPrisma.atendimento.findUnique.mockResolvedValue(session);
                mockPrisma.prontuario.findFirst.mockResolvedValue({
                    id_Registro: 'uuid-pront',
                    id_Tipo: TipoProntuario.PSICOTERAPIA,
                });
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.remove('uuid-session' as UUID);
                expect(result).toEqual({ message: 'Sessão (uuid-session) cancelada com sucesso.' });
            });

            it('should throw NotFoundException when session is not found', async () => {
                mockPrisma.atendimento.findUnique.mockResolvedValue(undefined);

                await expect(service.remove('uuid-session' as UUID)).rejects.toThrow(NotFoundException);
            });

            it('should throw BadRequestException when session is not active', async () => {
                const session = {
                    id_Atendimento: 'uuid-session',
                    id_Status: StatusAtendimento.CANCELADO,
                    id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                    id_Lista: 'uuid-lista',
                };

                mockPrisma.atendimento.findUnique.mockResolvedValue(session);

                await expect(service.remove('uuid-session' as UUID)).rejects.toThrow(BadRequestException);
            });
        });
    });
});
