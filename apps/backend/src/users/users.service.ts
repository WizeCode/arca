import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { HashingServiceProtocol } from 'src/auth/hash/hashing.service';
import { UUID } from 'node:crypto';
import { TokenDto } from 'src/common/dto/token.dto';
import { paginate, PaginationDto } from 'src/common/dto/pagination.dto';
import { RoleAccess } from 'src/common/enums/status.enum';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private HashingService: HashingServiceProtocol,
    ) {}

    private canActOnUser(actorAccess: number, targetRoleId: number): boolean {
        return actorAccess < targetRoleId || (actorAccess === RoleAccess.ADMIN && targetRoleId === RoleAccess.ADMIN);
    }

    async create(createUserDto: CreateUserDto, creator: TokenDto) {
        if (createUserDto.roleId <= creator.access && !this.canActOnUser(creator.access, createUserDto.roleId)) {
            throw new ForbiddenException(
                'Você não tem permissão para criar um usuário com nível de acesso igual ou superior ao seu.',
            );
        }

        const existingUser = await this.prisma.usuario.findFirst({
            where: {
                email: createUserDto.email,
            },
        });

        if (existingUser) {
            if (existingUser.isActive) {
                throw new BadRequestException('E-mail já cadastrado.');
            }

            const canReactivate =
                creator.access < existingUser.roleId ||
                (creator.access === RoleAccess.ADMIN && existingUser.roleId === RoleAccess.ADMIN);

            if (canReactivate) {
                throw new ConflictException({
                    message: `Este e-mail pertence a um usuário desativado (${existingUser.nome}). Deseja reativar este usuário em vez de criar um novo?`,
                    userId: existingUser.id_User,
                    userName: existingUser.nome,
                });
            } else {
                throw new BadRequestException('E-mail já cadastrado.');
            }
        }

        if (createUserDto.roleId === RoleAccess.SUPERVISOR) {
            if (!createUserDto.crp) {
                throw new BadRequestException('CRP é obrigatório para psicólogos supervisores.');
            }
        }

        const passwordHash = await this.HashingService.hash(createUserDto.senha);

        return this.prisma.usuario.create({
            data: {
                nome: createUserDto.nome,
                email: createUserDto.email,
                senhaHash: passwordHash,
                roleId: createUserDto.roleId,
                CRP: createUserDto.crp ?? null,
            },
            select: {
                id_User: true,
                nome: true,
                email: true,
                senhaHash: false,
                roleId: true,
            },
        });
    }

    async findAll(creator: TokenDto, pagination: PaginationDto) {
        const { page, limit } = pagination;
        const skip = (page - 1) * limit;

        const where: Prisma.UsuarioWhereInput = {
            roleId: { gte: creator.access },
            isActive: true,
        };

        const select = {
            id_User: true,
            nome: true,
            email: true,
            senhaHash: false,
            roleId: true,
            role: {
                select: {
                    id_Role: true,
                    role: true,
                    descricao: true,
                },
            },
        };

        const [users, total] = await Promise.all([
            this.prisma.usuario.findMany({ where, select, skip, take: limit, orderBy: { nome: 'asc' } }),
            this.prisma.usuario.count({ where }),
        ]);

        return paginate(users, total, page, limit);
    }

    async findOne(id: UUID, creator: TokenDto) {
        // Lista apenas o usuário com nível de acesso menor ao do criador
        const user = await this.prisma.usuario.findFirst({
            where: {
                id_User: id,
                roleId: {
                    gte: creator.access,
                },
                isActive: true,
            },
            select: {
                id_User: true,
                nome: true,
                email: true,
                senhaHash: false,
                roleId: true,
            },
        });
        if (!user) {
            throw new NotFoundException(`Usuário não encontrado ou acesso não permitido.`);
        }

        return user;
    }

    async update(id: UUID, updateUserDto: UpdateUserDto, creator: TokenDto) {
        const user = await this.prisma.usuario.findUnique({
            where: { id_User: id },
        });

        if (!user) {
            throw new NotFoundException(`Usuário não encontrado.`);
        }

        if (creator.access > RoleAccess.SECRETARIO) {
            if (user.id_User !== creator.sub)
                throw new ForbiddenException('Você não tem permissão para editar este usuário.');
        }

        if (updateUserDto.email && updateUserDto.email !== user.email) {
            const existingUser = await this.prisma.usuario.findFirst({
                where: {
                    email: updateUserDto.email,
                    id_User: { not: id },
                },
            });

            if (existingUser) {
                if (existingUser.isActive) {
                    throw new BadRequestException('O e-mail informado já está em uso por outro usuário.');
                }

                if (this.canActOnUser(creator.access, existingUser.roleId)) {
                    throw new ConflictException({
                        message: `Este e-mail pertence a um usuário desativado (${existingUser.nome}). Deseja reativar este usuário em vez de alterar o e-mail?`,
                        userId: existingUser.id_User,
                        userName: existingUser.nome,
                    });
                } else {
                    throw new BadRequestException('O e-mail informado já está em uso por outro usuário.');
                }
            }
        }

        const dataToUpdate: Prisma.UsuarioUpdateInput = {
            nome: updateUserDto.nome,
            email: updateUserDto.email,
        };

        if (updateUserDto.crp !== undefined) {
            if (user.roleId !== RoleAccess.SUPERVISOR) {
                throw new BadRequestException(
                    'O campo CRP (Conselho Regional de Psicologia) só pode ser definido para usuários do tipo Supervisor.',
                );
            }

            dataToUpdate.CRP = updateUserDto.crp;
        }

        if (updateUserDto.senha) {
            dataToUpdate.senhaHash = await this.HashingService.hash(updateUserDto.senha);
        }

        return this.prisma.usuario.update({
            where: { id_User: id },
            data: dataToUpdate,
            select: {
                id_User: true,
                nome: true,
                email: true,
                roleId: true,
                CRP: true,
            },
        });
    }

    async remove(id: UUID, creator: TokenDto) {
        const user = await this.prisma.usuario.findUnique({
            where: { id_User: id },
        });

        if (!user) {
            throw new NotFoundException(`Usuário não encontrado.`);
        }

        if (creator.sub === user.id_User) {
            throw new ForbiddenException('Você não pode deletar sua própria conta.');
        }

        if (!this.canActOnUser(creator.access, user.roleId)) {
            throw new ForbiddenException('Você não tem permissão para desativar este usuário.');
        }

        await this.prisma.usuario.update({
            where: { id_User: id },
            data: {
                isActive: false,
            },
        });
    }

    async reactivate(id: UUID, creator: TokenDto) {
        const user = await this.prisma.usuario.findUnique({
            where: { id_User: id },
        });

        if (!user) {
            throw new NotFoundException(`Usuário não encontrado.`);
        }

        if (user.isActive) {
            throw new BadRequestException('Este usuário já está ativo.');
        }

        if (creator.access >= user.roleId && creator.access !== RoleAccess.ADMIN) {
            throw new ForbiddenException('Você não tem permissão para reativar um usuário deste nível de acesso.');
        }

        await this.prisma.usuario.update({
            where: { id_User: id },
            data: {
                isActive: true,
            },
        });
    }
}
