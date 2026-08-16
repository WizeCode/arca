import { MedicalRecordService } from './medical_record.service';
import {
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    RoleAccess,
    StatusAtendimento,
    StatusListaEspera,
    StatusProntuario,
    TipoAtendimento,
    TipoProntuario,
} from 'src/common/enums/status.enum';
import { TokenDto } from 'src/common/dto/token.dto';
import { UUID } from 'node:crypto';

function makeUser(access: RoleAccess, sub = 'uuid-user'): TokenDto {
    return { sub: sub as UUID, name: 'Test User', email: 'test@test.com', access, iat: 0, exp: 0, aud: '', iss: '' };
}

function makeAtendimento(overrides: object = {}) {
    return {
        id_Atendimento: 'atd-uuid' as UUID,
        id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
        id_Status: StatusAtendimento.ATIVO,
        id_Estagiario_Executor: 'uuid-est',
        id_Supervisor_Executor: 'uuid-sup',
        id_Lista: 'lista-uuid',
        ListaEspera: { id_Status: StatusListaEspera.EM_TRIAGEM },
        ...overrides,
    };
}

function makeProntuario(overrides: object = {}) {
    return {
        id_Registro: 'pron-uuid' as UUID,
        id_Atendimento: 'atd-uuid' as UUID,
        id_Tipo: TipoProntuario.TRIAGEM,
        id_Status: StatusProntuario.EM_APROVACAO,
        conteudo: 'encrypted-content',
        dataEmissao: new Date(),
        atendimento: {
            id_Lista: 'lista-uuid',
            id_Supervisor_Executor: 'uuid-sup',
            id_Estagiario_Executor: 'uuid-est',
            id_Atendimento: 'atd-uuid',
        },
        ...overrides,
    };
}

const mockPrisma = {
    atendimento: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    prontuario: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    listaEspera: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
    },
    $transaction: jest.fn(),
};

const mockPdfService = {
    generatePdfFromTemplate: jest.fn(),
};

const mockCryptoService = {
    encrypt: jest.fn().mockReturnValue('encrypted-content'),
    decrypt: jest.fn(),
    decryptConteudo: jest.fn().mockImplementation((c) => c),
};

describe('MedicalRecordService', () => {
    let service: MedicalRecordService;

    beforeEach(() => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        jest.clearAllMocks();
        mockCryptoService.encrypt.mockReturnValue('encrypted-content');
        mockCryptoService.decryptConteudo.mockImplementation((c: unknown) => c);
        service = new MedicalRecordService(mockPrisma as any, mockPdfService, mockCryptoService as any);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('Medical Record CRUD', () => {
        describe('create', () => {
            describe('createTriagem', () => {
                const dto = { id_Sessao: 'atd-uuid' as UUID, conteudo: { queixaPrincipal: 'teste' } as any };

                it('should throw NotFoundException when atendimento does not exist', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(null);

                    await expect(service.createTriagem(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        NotFoundException,
                    );
                });

                it('should throw BadRequestException when atendimento is not triagem type', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(
                        makeAtendimento({ id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA }),
                    );

                    await expect(service.createTriagem(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should throw BadRequestException when atendimento is not active', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(
                        makeAtendimento({ id_Status: StatusAtendimento.CONCLUIDO }),
                    );

                    await expect(service.createTriagem(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should throw BadRequestException when patient is not in triagem status', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(
                        makeAtendimento({ ListaEspera: { id_Status: StatusListaEspera.EM_ESPERA } }),
                    );

                    await expect(service.createTriagem(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should throw InternalServerErrorException when atendimento has no estagiario or supervisor', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(
                        makeAtendimento({ id_Estagiario_Executor: null, id_Supervisor_Executor: null }),
                    );

                    await expect(service.createTriagem(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        InternalServerErrorException,
                    );
                });

                it('should throw ForbiddenException when supervisor is not responsible for the atendimento', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(makeAtendimento());
                    const outroSupervisor = makeUser(RoleAccess.SUPERVISOR, 'uuid-outro-supervisor');

                    await expect(service.createTriagem(dto, outroSupervisor)).rejects.toThrow(ForbiddenException);
                });

                it('should throw ForbiddenException when estagiario is not responsible for the atendimento', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(makeAtendimento());
                    const outroEstagiario = makeUser(RoleAccess.ESTAGIARIO, 'uuid-outro-estagiario');

                    await expect(service.createTriagem(dto, outroEstagiario)).rejects.toThrow(ForbiddenException);
                });

                it('should create triagem and return the prontuario', async () => {
                    const createdProntuario = makeProntuario();
                    mockPrisma.atendimento.findFirst.mockResolvedValue(makeAtendimento());
                    mockPrisma.$transaction.mockResolvedValue([createdProntuario, {}]);

                    const result = await service.createTriagem(dto, makeUser(RoleAccess.ADMIN));

                    expect(mockCryptoService.encrypt).toHaveBeenCalledWith(dto.conteudo);
                    expect(mockPrisma.$transaction).toHaveBeenCalled();
                    expect(result).toBe(createdProntuario);
                });

                it('should throw InternalServerErrorException when transaction fails', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(makeAtendimento());
                    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

                    await expect(service.createTriagem(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        InternalServerErrorException,
                    );
                });
            });

            describe('createEvolucao', () => {
                const dto = { id_Sessao: 'atd-uuid' as UUID, conteudo: { relatoSessao: 'teste' } as any };

                it('should throw NotFoundException when atendimento does not exist', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(null);

                    await expect(service.createEvolucao(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        NotFoundException,
                    );
                });

                it('should throw BadRequestException when atendimento is not psicoterapia type', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(
                        makeAtendimento({
                            id_Tipo_Atendimento: TipoAtendimento.TRIAGEM,
                            ListaEspera: { id_Status: StatusListaEspera.TRIAGEM_APROVADA },
                        }),
                    );

                    await expect(service.createEvolucao(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should throw BadRequestException when patient does not have approved triagem', async () => {
                    mockPrisma.atendimento.findFirst.mockResolvedValue(
                        makeAtendimento({
                            id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA,
                            ListaEspera: { id_Status: StatusListaEspera.EM_TRIAGEM },
                        }),
                    );

                    await expect(service.createEvolucao(dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should create evolucao and return the prontuario', async () => {
                    const createdProntuario = makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA });
                    mockPrisma.atendimento.findFirst.mockResolvedValue(
                        makeAtendimento({
                            id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA,
                            ListaEspera: { id_Status: StatusListaEspera.TRIAGEM_APROVADA },
                        }),
                    );
                    mockPrisma.$transaction.mockResolvedValue([createdProntuario, {}]);

                    const result = await service.createEvolucao(dto, makeUser(RoleAccess.ADMIN));

                    expect(result).toBe(createdProntuario);
                });
            });
        });

        describe('read', () => {
            describe('findAll', () => {
                const pagination = { page: 1, limit: 10 };

                it('should return empty paginated result for roles above ESTAGIARIO (invalid access)', async () => {
                    const result = await service.findAll(makeUser(5 as RoleAccess), pagination);

                    expect(result.data).toHaveLength(0);
                    expect(result.meta.total).toBe(0);
                });

                it('should filter by supervisor when user is supervisor', async () => {
                    mockPrisma.listaEspera.findMany.mockResolvedValue([]);
                    mockPrisma.listaEspera.count.mockResolvedValue(0);

                    await service.findAll(makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'), pagination);

                    expect(mockPrisma.listaEspera.findMany).toHaveBeenCalledWith(
                        expect.objectContaining({
                            where: expect.objectContaining({
                                Atendimento: expect.objectContaining({
                                    some: expect.objectContaining({ id_Supervisor_Executor: 'uuid-sup' }),
                                }),
                            }),
                        }),
                    );
                });

                it('should return paginated data for admin', async () => {
                    const fakeData = [{ id_Lista: 'uuid-1', nomeRegistro: 'Paciente' }];
                    mockPrisma.listaEspera.findMany.mockResolvedValue(fakeData);
                    mockPrisma.listaEspera.count.mockResolvedValue(1);

                    const result = await service.findAll(makeUser(RoleAccess.ADMIN), pagination);

                    expect(result.data).toHaveLength(1);
                    expect(result.meta.total).toBe(1);
                });
            });

            describe('findOne', () => {
                const id = 'lista-uuid' as UUID;

                it('should throw NotFoundException when patient is not found', async () => {
                    mockPrisma.listaEspera.findFirst.mockResolvedValue(null);

                    await expect(service.findOne(id, makeUser(RoleAccess.ADMIN))).rejects.toThrow(NotFoundException);
                });

                it('should throw NotFoundException for roles above ESTAGIARIO (invalid access)', async () => {
                    await expect(service.findOne(id, makeUser(5 as RoleAccess))).rejects.toThrow(NotFoundException);
                });

                it('should return patient with decrypted prontuario content', async () => {
                    const fakePaciente = {
                        id_Lista: id,
                        nomeRegistro: 'Paciente Teste',
                        Atendimento: [
                            {
                                dataHoraInicio: new Date(),
                                supervisorExecutor: { nome: 'Sup', CRP: '12345' },
                                estagiarioExecutor: { nome: 'Est' },
                                Prontuario: [
                                    {
                                        id_Registro: 'pron-uuid',
                                        conteudo: 'encrypted',
                                        dataEmissao: new Date(),
                                        id_Status: 1,
                                        id_Tipo: 1,
                                        ultimaAtualizacao: new Date(),
                                        status: { nome: 'Em aprovação' },
                                        TipoProntuario: { nome: 'Triagem' },
                                    },
                                ],
                            },
                        ],
                    };
                    mockPrisma.listaEspera.findFirst.mockResolvedValue(fakePaciente);

                    const result = await service.findOne(id, makeUser(RoleAccess.ADMIN));

                    expect(mockCryptoService.decryptConteudo).toHaveBeenCalledWith('encrypted');
                    expect(result.nomeRegistro).toBe('Paciente Teste');
                });
            });
        });

        describe('update', () => {
            describe('putTriagem', () => {
                const id = 'pron-uuid' as UUID;
                const dto = { queixaPrincipal: 'updated' } as any;

                it('should throw NotFoundException when prontuario does not exist', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(null);

                    await expect(service.putTriagem(id, dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        NotFoundException,
                    );
                });

                it('should throw BadRequestException when prontuario is not triagem type', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(
                        makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA }),
                    );

                    await expect(service.putTriagem(id, dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should throw BadRequestException when triagem is already approved', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(
                        makeProntuario({ id_Status: StatusProntuario.APROVADO }),
                    );

                    await expect(service.putTriagem(id, dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should throw ForbiddenException when supervisor is not responsible', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(makeProntuario());
                    const outroSupervisor = makeUser(RoleAccess.SUPERVISOR, 'uuid-outro');

                    await expect(service.putTriagem(id, dto, outroSupervisor)).rejects.toThrow(ForbiddenException);
                });

                it('should throw ForbiddenException when estagiario is not responsible', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(makeProntuario());
                    const outroEstagiario = makeUser(RoleAccess.ESTAGIARIO, 'uuid-outro');

                    await expect(service.putTriagem(id, dto, outroEstagiario)).rejects.toThrow(ForbiddenException);
                });

                it('should update and return the prontuario', async () => {
                    const updatedProntuario = makeProntuario();
                    mockPrisma.prontuario.findUnique.mockResolvedValue(makeProntuario());
                    mockPrisma.prontuario.update.mockResolvedValue(updatedProntuario);

                    const result = await service.putTriagem(id, dto, makeUser(RoleAccess.ADMIN));

                    expect(mockCryptoService.encrypt).toHaveBeenCalledWith(dto);
                    expect(result).toBe(updatedProntuario);
                });
            });

            describe('putEvolucao', () => {
                const id = 'pron-uuid' as UUID;
                const dto = { relatoSessao: 'updated' } as any;

                it('should throw NotFoundException when prontuario does not exist', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(null);

                    await expect(service.putEvolucao(id, dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        NotFoundException,
                    );
                });

                it('should throw BadRequestException when prontuario is not psicoterapia type', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(
                        makeProntuario({ id_Tipo: TipoProntuario.TRIAGEM }),
                    );

                    await expect(service.putEvolucao(id, dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should throw BadRequestException when evolucao is already approved', async () => {
                    mockPrisma.prontuario.findUnique.mockResolvedValue(
                        makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA, id_Status: StatusProntuario.APROVADO }),
                    );

                    await expect(service.putEvolucao(id, dto, makeUser(RoleAccess.ADMIN))).rejects.toThrow(
                        BadRequestException,
                    );
                });

                it('should update and return the evolucao', async () => {
                    const updated = makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA });
                    mockPrisma.prontuario.findUnique.mockResolvedValue(
                        makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA }),
                    );
                    mockPrisma.prontuario.update.mockResolvedValue(updated);

                    const result = await service.putEvolucao(id, dto, makeUser(RoleAccess.ADMIN));

                    expect(result).toBe(updated);
                });
            });
        });
    });

    describe('Medical Record extra', () => {
        describe('approveTriagem', () => {
            const id = 'pron-uuid' as UUID;

            it('should throw NotFoundException when prontuario does not exist', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(null);

                await expect(
                    service.approveTriagem(id, { encaminhado: false }, makeUser(RoleAccess.SUPERVISOR, 'uuid-sup')),
                ).rejects.toThrow(NotFoundException);
            });

            it('should throw ForbiddenException when supervisor is not responsible', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(makeProntuario());

                await expect(
                    service.approveTriagem(id, { encaminhado: false }, makeUser(RoleAccess.SUPERVISOR, 'uuid-outro')),
                ).rejects.toThrow(ForbiddenException);
            });

            it('should throw BadRequestException when encaminhado is true but instituicaoEncaminhada is missing', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(makeProntuario());

                await expect(
                    service.approveTriagem(
                        id,
                        { encaminhado: true, motivoEncaminhamento: 'Motivo' },
                        makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                    ),
                ).rejects.toThrow(BadRequestException);
            });

            it('should approve triagem without encaminhamento', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(makeProntuario());
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.approveTriagem(
                    id,
                    { encaminhado: false },
                    makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                );

                expect(result).toBe('Triagem aprovada com sucesso.');
            });

            it('should approve triagem and create encaminhamento', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(makeProntuario());
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.approveTriagem(
                    id,
                    { encaminhado: true, instituicaoEncaminhada: 'Hospital X', motivoEncaminhamento: 'Motivo Y' },
                    makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                );

                expect(result).toBe('Paciente encaminhado com sucesso.');
            });
        });

        describe('approveEvolucao', () => {
            const id = 'pron-uuid' as UUID;

            it('should throw NotFoundException when prontuario does not exist', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(null);

                await expect(
                    service.approveEvolucao(
                        id,
                        { recebeuAlta: false, encaminhado: false },
                        makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                    ),
                ).rejects.toThrow(NotFoundException);
            });

            it('should throw ForbiddenException when supervisor is not responsible', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(
                    makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA }),
                );

                await expect(
                    service.approveEvolucao(
                        id,
                        { recebeuAlta: false, encaminhado: false },
                        makeUser(RoleAccess.SUPERVISOR, 'uuid-outro'),
                    ),
                ).rejects.toThrow(ForbiddenException);
            });

            it('should approve evolucao without alta or encaminhamento', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(
                    makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA }),
                );
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.approveEvolucao(
                    id,
                    { recebeuAlta: false, encaminhado: false },
                    makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                );

                expect(result).toBe('Evolução aprovada com sucesso.');
            });

            it('should approve evolucao with alta', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(
                    makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA }),
                );
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.approveEvolucao(
                    id,
                    { recebeuAlta: true, finalidade: 'Alta terapêutica', encaminhado: false },
                    makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                );

                expect(result).toBe('Evolução aprovada. Relatório de Alta gerado com sucesso.');
            });

            it('should approve evolucao with encaminhamento', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(
                    makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA }),
                );
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.approveEvolucao(
                    id,
                    {
                        recebeuAlta: false,
                        encaminhado: true,
                        instituicaoEncaminhada: 'Hospital X',
                        motivoEncaminhamento: 'Motivo Y',
                    },
                    makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                );

                expect(result).toBe('Evolução aprovada. Encaminhamento gerado com sucesso.');
            });

            it('should approve evolucao with both alta and encaminhamento', async () => {
                mockPrisma.prontuario.findUnique.mockResolvedValue(
                    makeProntuario({ id_Tipo: TipoProntuario.PSICOTERAPIA }),
                );
                mockPrisma.$transaction.mockResolvedValue([]);

                const result = await service.approveEvolucao(
                    id,
                    {
                        recebeuAlta: true,
                        finalidade: 'Fim',
                        encaminhado: true,
                        instituicaoEncaminhada: 'Hospital X',
                        motivoEncaminhamento: 'Motivo',
                    },
                    makeUser(RoleAccess.SUPERVISOR, 'uuid-sup'),
                );

                expect(result).toBe('Evolução aprovada. Alta e Encaminhamento gerados com sucesso.');
            });
        });
    });
});
