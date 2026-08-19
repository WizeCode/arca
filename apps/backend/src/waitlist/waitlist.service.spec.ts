import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { WaitlistService } from './waitlist.service';
import { TENANT_PRISMA } from 'src/prisma/prisma.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatusListaEspera } from 'src/common/enums/status.enum';
import { UUID } from 'node:crypto';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';

describe('WaitlistService', () => {
    let service: WaitlistService;

    const mockClinica = { id_Clinica: 'clinica-uuid', isActive: true };

    const mockPrisma = {
        clinica: {
            findFirstOrThrow: jest.fn(),
        },
        listaEspera: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
    };

    const mockCls = { set: jest.fn(), get: jest.fn() };

    beforeEach(async () => {
        jest.clearAllMocks();
        mockPrisma.clinica.findFirstOrThrow.mockResolvedValue(mockClinica);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WaitlistService,
                {
                    provide: TENANT_PRISMA,
                    useValue: mockPrisma,
                },
                {
                    provide: ClsService,
                    useValue: mockCls,
                },
            ],
        }).compile();

        service = module.get<WaitlistService>(WaitlistService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('Waitlist CRUD', () => {
        describe('create', () => {
            it('should create a new entry', async () => {
                const body = {
                    nomeRegistro: 'Pedro Silva',
                    nomeSocial: undefined,
                    dataNascimento: '2000-05-15',
                    CPF: '123.456.789-00',
                    telefonePessoal: '(34) 99999-0000',
                    contatoEmergencia: '(34) 98888-0000',
                    enderecoRua: 'Rua das Flores',
                    enderecoNumero: '123',
                    enderecoBairro: 'Centro',
                    enderecoCidade: 'Uberaba',
                    enderecoEstado: 'MG',
                    enderecoCEP: '38000-000',
                    id_Genero: 1,
                    id_Etnia: 1,
                    id_Escolaridade: 1,
                } as CreateWaitlistDto;

                mockPrisma.listaEspera.findFirst.mockResolvedValue(undefined);
                mockPrisma.listaEspera.create.mockResolvedValue(body);
                const result = await service.create(body);
                expect(result).toEqual(body);
            });

            it('should throw BadRequestException when already have the same CPF of another ACTIVE patient', async () => {
                const body = {
                    nomeRegistro: 'Pedro Silva',
                    nomeSocial: undefined,
                    dataNascimento: '2000-05-15',
                    CPF: '123.456.789-00',
                    telefonePessoal: '(34) 99999-0000',
                    contatoEmergencia: '(34) 98888-0000',
                    enderecoRua: 'Rua das Flores',
                    enderecoNumero: '123',
                    enderecoBairro: 'Centro',
                    enderecoCidade: 'Uberaba',
                    enderecoEstado: 'MG',
                    enderecoCEP: '38000-000',
                    id_Genero: 1,
                    id_Etnia: 1,
                    id_Escolaridade: 1,
                } as CreateWaitlistDto;

                mockPrisma.listaEspera.findFirst.mockResolvedValue({
                    id_Lista: 'uuid-existente',
                    CPF: '123.456.789-00',
                });
                await expect(service.create(body)).rejects.toThrow(BadRequestException);
            });
        });

        describe('read', () => {
            describe('findAll', () => {
                it('should return paginated waitlist', async () => {
                    const pagination = { page: 1, limit: 20 };
                    const patients = [{ id_Lista: 'uuid-1' }];

                    mockPrisma.listaEspera.findMany.mockResolvedValue(patients);
                    mockPrisma.listaEspera.count.mockResolvedValue(1);

                    const result = await service.findAll(pagination);
                    expect(result).toEqual({
                        data: patients,
                        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
                    });
                });
            });

            describe('findOne', () => {
                it('should return a patient with their position in the waitlist', async () => {
                    const patient = {
                        id_Lista: 'uuid-1',
                        createdAt: new Date(),
                        id_Status: StatusListaEspera.EM_ESPERA,
                    };

                    mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                    mockPrisma.listaEspera.count.mockResolvedValue(2);

                    const result = await service.findOne('uuid-1' as UUID);
                    expect(result).toEqual({
                        ...patient,
                        posicaoNaLista: 3,
                        situacao: 'Ativo',
                    });
                });

                it('should throw NotFoundException when patient is not found', async () => {
                    mockPrisma.listaEspera.findUnique.mockResolvedValue(undefined);

                    await expect(service.findOne('uuid-1' as UUID)).rejects.toThrow(NotFoundException);
                });
            });

            describe('findPublicPosition', () => {
                it('should return public position of a patient', async () => {
                    const patient = {
                        id_Lista: 'uuid-1',
                        nomeRegistro: 'Pedro Silva',
                        nomeSocial: null,
                        createdAt: new Date(),
                        id_Status: StatusListaEspera.EM_ESPERA,
                    };

                    mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                    mockPrisma.listaEspera.count.mockResolvedValue(0);

                    const result = await service.findPublicPosition('uuid-1' as UUID);
                    expect(result).toEqual({
                        ...patient,
                        posicaoNaLista: 1,
                        situacao: 'Ativo',
                    });
                });

                it('should throw NotFoundException when patient is not found', async () => {
                    mockPrisma.listaEspera.findUnique.mockResolvedValue(undefined);

                    await expect(service.findPublicPosition('uuid-1' as UUID)).rejects.toThrow(NotFoundException);
                });
            });

            describe('findPositions', () => {
                it('should return queue size and last update', async () => {
                    const entries = [{ createdAt: new Date('2025-01-10') }, { createdAt: new Date('2025-01-05') }];

                    mockPrisma.listaEspera.findMany.mockResolvedValue(entries);

                    const result = await service.findPositions();
                    expect(result).toEqual({
                        qntFila: 2,
                        ultimaAtualizacao: entries[0].createdAt.toISOString(),
                    });
                });

                it('should return empty queue when there are no patients', async () => {
                    mockPrisma.listaEspera.findMany.mockResolvedValue([]);

                    const result = await service.findPositions();
                    expect(result.qntFila).toBe(0);
                });
            });
        });

        describe('update', () => {
            it('should update a patient', async () => {
                const patient = { id_Lista: 'uuid-1', nomeRegistro: 'Pedro Silva' };
                const dataToUpdate = { nomeRegistro: 'Pedro Atualizado' };
                const patientUpdated = { ...patient, ...dataToUpdate };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.listaEspera.update.mockResolvedValue(patientUpdated);

                const result = await service.update('uuid-1' as UUID, dataToUpdate);
                expect(result).toEqual(patientUpdated);
            });

            it('should throw NotFoundException when patient is not found', async () => {
                mockPrisma.listaEspera.findUnique.mockResolvedValue(undefined);

                await expect(service.update('uuid-1' as UUID, {})).rejects.toThrow(NotFoundException);
            });
        });

        describe('remove', () => {
            it('should deactivate a patient', async () => {
                const patient = { id_Lista: 'uuid-1', id_Status: StatusListaEspera.EM_ESPERA };
                const deactivated = { ...patient, id_Status: StatusListaEspera.DESATIVADO };

                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);
                mockPrisma.listaEspera.update.mockResolvedValue(deactivated);

                const result = await service.remove('uuid-1' as UUID);
                expect(result).toEqual(deactivated);
            });

            it('should throw NotFoundException when patient is not found', async () => {
                mockPrisma.listaEspera.findUnique.mockResolvedValue(undefined);

                await expect(service.remove('uuid-1' as UUID)).rejects.toThrow(NotFoundException);
            });

            it('should throw BadRequestException when patient is already deactivated', async () => {
                const patient = { id_Lista: 'uuid-1', id_Status: StatusListaEspera.DESATIVADO };
                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);

                await expect(service.remove('uuid-1' as UUID)).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException when patient already received discharge', async () => {
                const patient = { id_Lista: 'uuid-1', id_Status: StatusListaEspera.RECEBEU_ALTA };
                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);

                await expect(service.remove('uuid-1' as UUID)).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException when patient is in psicotherapy', async () => {
                const patient = { id_Lista: 'uuid-1', id_Status: StatusListaEspera.EM_PSICOTERAPIA };
                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);

                await expect(service.remove('uuid-1' as UUID)).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException when patient has approved triage', async () => {
                const patient = { id_Lista: 'uuid-1', id_Status: StatusListaEspera.TRIAGEM_APROVADA };
                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);

                await expect(service.remove('uuid-1' as UUID)).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException when patient is in triage', async () => {
                const patient = { id_Lista: 'uuid-1', id_Status: StatusListaEspera.EM_TRIAGEM };
                mockPrisma.listaEspera.findUnique.mockResolvedValue(patient);

                await expect(service.remove('uuid-1' as UUID)).rejects.toThrow(BadRequestException);
            });
        });
    });
});
