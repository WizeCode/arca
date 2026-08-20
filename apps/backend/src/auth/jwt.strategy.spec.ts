import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import jwtConfig from './config/jwt.config';
import { TokenDto } from 'src/common/dto/token.dto';
import { RoleAccess } from 'src/common/enums/status.enum';

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    const mockPrisma = { $queryRaw: jest.fn() };
    const mockCls = { set: jest.fn(), get: jest.fn() };

    const payload: TokenDto = {
        sub: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Pedro',
        email: 'pedro@test.com',
        access: RoleAccess.ESTAGIARIO,
        clinicaId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        iat: 1000,
        exp: 2000,
        aud: 'arca_api',
        iss: 'arca_server',
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: ClsService,
                    useValue: mockCls,
                },
                {
                    provide: jwtConfig.KEY,
                    useValue: {
                        secret: 'secret-teste',
                        jwtTtl: 3600,
                        audience: 'arca_api',
                        issuer: 'arca_server',
                    },
                },
            ],
        }).compile();

        strategy = module.get<JwtStrategy>(JwtStrategy);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        it('returns the validated payload when the user is active and clinicaId matches the database', async () => {
            mockPrisma.$queryRaw.mockResolvedValue([
                { id_user: payload.sub, is_active: true, id_clinica: payload.clinicaId },
            ]);

            const result = await strategy.validate(payload);

            expect(result).toEqual(payload);
            expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        });

        it('sets clinicaId on the CLS context when the user is active and clinicaId matches the database', async () => {
            mockPrisma.$queryRaw.mockResolvedValue([
                { id_user: payload.sub, is_active: true, id_clinica: payload.clinicaId },
            ]);

            await strategy.validate(payload);

            expect(mockCls.set).toHaveBeenCalledWith('clinicaId', payload.clinicaId);
        });

        it('throws UnauthorizedException when the clinicaId in the token no longer matches the user (moved to another clinic)', async () => {
            mockPrisma.$queryRaw.mockResolvedValue([
                { id_user: payload.sub, is_active: true, id_clinica: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' },
            ]);

            await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
            expect(mockCls.set).not.toHaveBeenCalled();
        });

        it('throws UnauthorizedException when the user is inactive', async () => {
            mockPrisma.$queryRaw.mockResolvedValue([
                { id_user: payload.sub, is_active: false, id_clinica: payload.clinicaId },
            ]);

            await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
            expect(mockCls.set).not.toHaveBeenCalled();
        });

        it('throws UnauthorizedException when the user does not exist', async () => {
            mockPrisma.$queryRaw.mockResolvedValue([]);

            await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
            expect(mockCls.set).not.toHaveBeenCalled();
        });
    });
});
