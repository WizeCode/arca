import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HashingServiceProtocol } from './hash/hashing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import jwtConfig from './config/jwt.config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
    let service: AuthService;
    const mockPrisma = { usuario: { findFirst: jest.fn() } };
    const mockHashing = { compare: jest.fn() };
    const mockJwtService = { signAsync: jest.fn() };

    const user = {
        id_User: 'uuid-123',
        nome: 'Pedro',
        email: 'pedro@test.com',
        senhaHash: 'hash-qualquer',
        roleId: 4,
        id_Clinica: 'uuid-clinica-123',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: HashingServiceProtocol,
                    useValue: mockHashing,
                },
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: jwtConfig.KEY,
                    useValue: {
                        secret: 'secret-teste',
                        jwtTtl: '5h',
                        audience: 'arca_api',
                        issuer: 'arca_server',
                    },
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateUser', () => {
        it('should return user data when credentials are valid', async () => {
            mockPrisma.usuario.findFirst.mockResolvedValue(user);
            mockHashing.compare.mockResolvedValue(true);

            const resultado = await service.validateUser({ email: 'pedro@test.com', password: '123456' });

            expect(resultado).toEqual({
                id_User: 'uuid-123',
                nome: 'Pedro',
                email: 'pedro@test.com',
                roleId: 4,
                id_Clinica: 'uuid-clinica-123',
            });
        });

        it('should throw UnauthorizedException when user does not exist or is inactive', async () => {
            mockPrisma.usuario.findFirst.mockResolvedValue(undefined);

            await expect(
                service.validateUser({
                    email: 'pedro@test.com',
                    password: '123456',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when password is incorrect', async () => {
            mockPrisma.usuario.findFirst.mockResolvedValue(user);
            mockHashing.compare.mockResolvedValue(false);

            await expect(
                service.validateUser({
                    email: 'pedro@test.com',
                    password: '123456',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('login', () => {
        it('should return a token and user data', async () => {
            mockJwtService.signAsync.mockResolvedValue('token-fake');

            const result = await service.login(user);
            expect(result).toEqual({
                token: 'token-fake',
            });
        });
    });
});
