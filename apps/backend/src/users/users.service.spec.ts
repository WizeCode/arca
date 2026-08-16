import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { HashingServiceProtocol } from 'src/auth/hash/hashing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID, UUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TokenDto } from 'src/common/dto/token.dto';
import { RoleAccess } from 'src/common/enums/status.enum';

describe('UserService', () => {
    let service: UsersService;

    const mockPrisma = {
        usuario: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };
    const mockHashing = { hash: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: HashingServiceProtocol,
                    useValue: mockHashing,
                },
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('User CRUD', () => {
        describe('create', () => {
            it('should create a new user', async () => {
                const creator = {
                    sub: randomUUID(),
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const userToBeCreated = {
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    senha: 'pwd',
                    roleId: RoleAccess.ESTAGIARIO,
                };

                const userCriado = {
                    id_User: 'uuid-novo',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.ESTAGIARIO,
                };

                mockPrisma.usuario.findFirst.mockResolvedValue(undefined);
                mockHashing.hash.mockResolvedValue('pwd-hashed');
                mockPrisma.usuario.create.mockResolvedValue(userCriado);

                const result = await service.create(userToBeCreated, creator);
                expect(result).toEqual(userCriado);
            });

            it('should throw ForbiddenException when creating a user with greater role than creator', async () => {
                const creator = {
                    sub: randomUUID(),
                    access: RoleAccess.SECRETARIO,
                } as TokenDto;

                const userToBeCreated = {
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    senha: 'pwd',
                    roleId: RoleAccess.ADMIN,
                };

                await expect(service.create(userToBeCreated, creator)).rejects.toThrow(ForbiddenException);
            });

            it('should throw BadRequestException when creating a user with an existing email', async () => {
                const creator = {
                    sub: randomUUID(),
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const userToBeCreated = {
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    senha: 'pwd',
                    roleId: RoleAccess.ESTAGIARIO,
                };

                mockPrisma.usuario.findFirst.mockResolvedValue({
                    id_User: 'uuid-existente',
                    nome: 'gustavo',
                    isActive: true,
                    roleId: RoleAccess.SECRETARIO,
                });

                await expect(service.create(userToBeCreated, creator)).rejects.toThrow(BadRequestException);
            });

            it('should throw ConflictException when creating a user with an existing email, inactive and creator can reactivate', async () => {
                const creator = {
                    sub: randomUUID(),
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const userToBeCreated = {
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    senha: 'pwd',
                    roleId: RoleAccess.ESTAGIARIO,
                };

                mockPrisma.usuario.findFirst.mockResolvedValue({
                    id_User: 'uuid-existente',
                    nome: 'gustavo',
                    isActive: false,
                    roleId: RoleAccess.SECRETARIO,
                });

                await expect(service.create(userToBeCreated, creator)).rejects.toThrow(ConflictException);
            });

            it('should throw BadRequestException when creating a user with an existing email, inactive and creator cannot reactivate', async () => {
                const creator = {
                    sub: randomUUID(),
                    access: RoleAccess.SECRETARIO,
                } as TokenDto;

                const userToBeCreated = {
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    senha: 'pwd',
                    roleId: RoleAccess.SUPERVISOR,
                };

                mockPrisma.usuario.findFirst.mockResolvedValue({
                    id_User: 'uuid-existente',
                    nome: 'gustavo',
                    isActive: false,
                    roleId: RoleAccess.ADMIN,
                });

                await expect(service.create(userToBeCreated, creator)).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException when creating a supervisor without CRP', async () => {
                const creator = {
                    sub: randomUUID(),
                    access: RoleAccess.SECRETARIO,
                } as TokenDto;

                const userToBeCreated = {
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    senha: 'pwd',
                    roleId: RoleAccess.SUPERVISOR,
                };

                mockPrisma.usuario.findFirst.mockResolvedValue(undefined);

                await expect(service.create(userToBeCreated, creator)).rejects.toThrow(BadRequestException);
            });
        });

        describe('read', () => {
            it('should return all user list', async () => {
                const creator = {
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const users = [
                    { id_User: 'uuid-1', nome: 'pedro', email: 'pedro@test.com', roleId: RoleAccess.ESTAGIARIO },
                ];

                mockPrisma.usuario.findMany.mockResolvedValue(users);
                mockPrisma.usuario.count.mockResolvedValue(1);
                const pagination = { page: 1, limit: 20 };
                const result = await service.findAll(creator, pagination);

                expect(result).toEqual({
                    data: users,
                    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
                });
            });

            it('should return a user that creator has access', async () => {
                const creator = {
                    access: RoleAccess.ADMIN,
                } as TokenDto;
                const id_choosed = randomUUID();

                const user = {
                    id_User: id_choosed,
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.ESTAGIARIO,
                };

                mockPrisma.usuario.findFirst.mockResolvedValue(user);
                const result = await service.findOne(id_choosed, creator);

                expect(result).toEqual(user);
            });

            it('should throw NotFoundException for user not found', async () => {
                const creator = {
                    access: RoleAccess.ADMIN,
                } as TokenDto;
                const id_choosed = randomUUID();

                mockPrisma.usuario.findFirst.mockResolvedValue(undefined);

                await expect(service.findOne(id_choosed, creator)).rejects.toThrow(NotFoundException);
            });
        });

        describe('update', () => {
            it('should update an user', async () => {
                const creator = {
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.ESTAGIARIO,
                };

                const dataToUpdate = {
                    email: 'pedro@wize.com',
                };

                const userAtualizado = { ...user, email: 'pedro@wize.com' };
                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                mockPrisma.usuario.findFirst.mockResolvedValue(undefined);
                mockPrisma.usuario.update.mockResolvedValue(userAtualizado);

                const result = await service.update('uuid-1' as UUID, dataToUpdate, creator);
                expect(result).toEqual(userAtualizado);
            });

            it('should throw NotFoundException when user is not found', async () => {
                const creator = {
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const dataToUpdate = {
                    email: 'pedro@wize.com',
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(undefined);
                await expect(service.update('uuid-1' as UUID, dataToUpdate, creator)).rejects.toThrow(
                    NotFoundException,
                );
            });

            it('should throw ForbiddenException when a user (supervisor or intern) try to update another with grater role than his and different account than theirs', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.SUPERVISOR,
                } as unknown as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.SECRETARIO,
                };

                const dataToUpdate = {
                    email: 'pedro@wize.com',
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                await expect(service.update('uuid-1' as UUID, dataToUpdate, creator)).rejects.toThrow(
                    ForbiddenException,
                );
            });

            it('should throw BadRequestException when a user try to update but already has an existing email', async () => {
                const creator = {
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedroBoom@wize.com',
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const userFinded = {
                    id_User: 'uuid-2',
                    nome: 'pedroFake',
                    email: 'pedro@wize.com',
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const dataToUpdate = {
                    email: 'pedro@wize.com',
                };
                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                mockPrisma.usuario.findFirst.mockResolvedValue(userFinded);

                await expect(service.update('uuid-1' as UUID, dataToUpdate, creator)).rejects.toThrow(
                    BadRequestException,
                );
            });

            it('should throw ConflictException when a user try to update another but already has an existing email and creator can reactive', async () => {
                const creator = {
                    access: RoleAccess.ADMIN,
                } as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedroBoom@wize.com',
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                const userFinded = {
                    id_User: 'uuid-2',
                    nome: 'pedroFake',
                    email: 'pedro@wize.com',
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: false,
                };

                const dataToUpdate = {
                    email: 'pedro@wize.com',
                };
                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                mockPrisma.usuario.findFirst.mockResolvedValue(userFinded);

                await expect(service.update('uuid-1' as UUID, dataToUpdate, creator)).rejects.toThrow(
                    ConflictException,
                );
            });
        });

        describe('delete', () => {
            it('should delete an user', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.ADMIN,
                } as unknown as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.ESTAGIARIO,
                    isActive: true,
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                await expect(service.remove('uuid-1' as UUID, creator)).resolves.toBeUndefined();
            });

            it('should throw ForbiddenException when user try to delete its own account', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.ADMIN,
                } as unknown as TokenDto;

                const user = {
                    id_User: 'uuid-creator',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.ADMIN,
                    isActive: true,
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                await expect(service.remove('uuid-creator' as UUID, creator)).rejects.toThrow(ForbiddenException);
            });

            it('should throw ForbiddenException when user try to delete with greater role than creator', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.SECRETARIO,
                } as unknown as TokenDto;

                const user = {
                    id_User: 'uuid-fake',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.ADMIN,
                    isActive: true,
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                await expect(service.remove('uuid-fake' as UUID, creator)).rejects.toThrow(ForbiddenException);
            });
        });
    });

    describe('User extra', () => {
        describe('reactivate', () => {
            it('should reactivate a user', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.ADMIN,
                } as unknown as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.SECRETARIO,
                    isActive: false,
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                await expect(service.reactivate('uuid-1' as UUID, creator)).resolves.toBeUndefined();
            });

            it('should throw NotFoundException when user is not found', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.ADMIN,
                } as unknown as TokenDto;

                mockPrisma.usuario.findUnique.mockResolvedValue(undefined);
                await expect(service.reactivate('uuid-1' as UUID, creator)).rejects.toThrow(NotFoundException);
            });

            it('should throw BadRequestException when user is already active', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.ADMIN,
                } as unknown as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.SECRETARIO,
                    isActive: true,
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                await expect(service.reactivate('uuid-1' as UUID, creator)).rejects.toThrow(BadRequestException);
            });

            it('should throw ForbiddenException when user try to reactivate with greater role than creator', async () => {
                const creator = {
                    sub: 'uuid-creator',
                    access: RoleAccess.SECRETARIO,
                } as unknown as TokenDto;

                const user = {
                    id_User: 'uuid-1',
                    nome: 'pedro',
                    email: 'pedro@test.com',
                    roleId: RoleAccess.ADMIN,
                    isActive: false,
                };

                mockPrisma.usuario.findUnique.mockResolvedValue(user);
                await expect(service.reactivate('uuid-1' as UUID, creator)).rejects.toThrow(ForbiddenException);
            });
        });
    });
});
