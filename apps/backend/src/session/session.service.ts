import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { TokenDto } from 'src/common/dto/token.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UUID } from 'node:crypto';
import { CryptoService } from 'src/crypto/crypto.service';
import {
    RoleAccess,
    StatusAtendimento,
    StatusListaEspera,
    StatusProntuario,
    TipoAtendimento,
    TipoProntuario,
} from 'src/common/enums/status.enum';
import { paginate, PaginationDto } from 'src/common/dto/pagination.dto';

const SESSION_LIST_INCLUDE = {
    ListaEspera: {
        select: {
            id_Lista: true,
            nomeRegistro: true,
            nomeSocial: true,
            telefonePessoal: true,
        },
    },
    estagiarioExecutor: {
        select: { id_User: true, nome: true, email: true },
    },
    supervisorExecutor: {
        select: { id_User: true, nome: true, email: true },
    },
    status: {
        select: { id_Status: true, nome: true },
    },
    Prontuario: {
        select: {
            id_Registro: true,
            id_Status: true,
            id_Tipo: true,
            dataEmissao: true,
        },
    },
} satisfies Prisma.AtendimentoInclude;

const SESSION_INCLUDE = {
    ListaEspera: {
        select: {
            id_Lista: true,
            nomeRegistro: true,
            nomeSocial: true,
            telefonePessoal: true,
        },
    },
    estagiarioExecutor: {
        select: { id_User: true, nome: true, email: true },
    },
    supervisorExecutor: {
        select: { id_User: true, nome: true, email: true },
    },
    status: {
        select: { id_Status: true, nome: true },
    },
    Prontuario: {
        select: {
            id_Registro: true,
            id_Status: true,
            id_Tipo: true,
            dataEmissao: true,
            conteudo: true,
        },
    },
} satisfies Prisma.AtendimentoInclude;

type SessionWithRelations = Prisma.AtendimentoGetPayload<{ include: typeof SESSION_INCLUDE }>;

@Injectable()
export class SessionService {
    constructor(
        private prisma: PrismaService,
        private cryptoService: CryptoService,
    ) {}

    /**
     * Descriptografa o conteudo de um prontuário.
     * Aceita string cifrada (novo formato) ou objeto JSON legado.
     */
    /** Recebe um atendimento do Prisma e descriptografa o conteudo de cada prontuário. */
    private decryptSession(session: SessionWithRelations) {
        if (!session?.Prontuario) return session;
        return {
            ...session,
            Prontuario: session.Prontuario.map((p) => ({
                ...p,
                conteudo: this.cryptoService.decryptConteudo(p.conteudo),
            })),
        };
    }

    private get includeRelations() {
        return SESSION_INCLUDE;
    }

    async create(session: CreateSessionDto) {
        const paciente = await this.prisma.listaEspera.findUnique({
            where: { id_Lista: session.id_Lista },
        });
        if (!paciente) {
            throw new BadRequestException('Paciente não encontrado.');
        }

        const statusFinais = [
            StatusListaEspera.RECEBEU_ALTA,
            StatusListaEspera.ENCAMINHADO,
            StatusListaEspera.DESATIVADO,
        ];
        if (statusFinais.includes(paciente.id_Status)) {
            throw new BadRequestException('Paciente está com um status final e não pode ter novas sessões agendadas.');
        }

        if (
            session.id_Tipo_Atendimento !== TipoAtendimento.TRIAGEM &&
            session.id_Tipo_Atendimento !== TipoAtendimento.PSICOTERAPIA
        ) {
            throw new BadRequestException('Tipo de atendimento inválido.');
        }

        if (session.id_Tipo_Atendimento === TipoAtendimento.TRIAGEM) {
            // 1 = Triagem
            if (paciente.id_Status !== StatusListaEspera.EM_ESPERA) {
                throw new BadRequestException(
                    'Este paciente não está "Em Espera". Não é possível agendar uma nova triagem.',
                );
            }
        } else if (session.id_Tipo_Atendimento === TipoAtendimento.PSICOTERAPIA) {
            // 2 = Psicoterapia

            const statusPermitidos = [StatusListaEspera.TRIAGEM_APROVADA, StatusListaEspera.EM_PSICOTERAPIA];

            if (!statusPermitidos.includes(paciente.id_Status)) {
                if (paciente.id_Status === StatusListaEspera.EM_ESPERA) {
                    throw new BadRequestException(
                        'Paciente precisa passar pela triagem antes de agendar uma sessão de psicoterapia.',
                    );
                }
                if (paciente.id_Status === StatusListaEspera.EM_TRIAGEM) {
                    throw new BadRequestException(
                        'Paciente está em triagem. A triagem precisa ser aprovada antes de agendar uma sessão de psicoterapia.',
                    );
                }

                throw new BadRequestException('Paciente não está apto para agendar uma sessão de psicoterapia.');
            }
        }

        const estagiario = await this.prisma.usuario.findUnique({
            where: { id_User: session.id_Estagiario_Executor },
        });

        if (!estagiario) {
            throw new BadRequestException('Estagiário não encontrado.');
        } else if (estagiario.roleId !== RoleAccess.ESTAGIARIO) {
            throw new BadRequestException('O usuário designado como estagiário não possui o papel de estagiário.');
        } else if (!estagiario.isActive) {
            throw new BadRequestException('O estagiário designado está desativado.');
        }

        const supervisor = await this.prisma.usuario.findUnique({
            where: { id_User: session.id_Supervisor_Executor },
        });
        if (!supervisor) {
            throw new BadRequestException('Supervisor não encontrado.');
        } else if (supervisor.roleId !== RoleAccess.SUPERVISOR) {
            throw new BadRequestException('O usuário designado como supervisor não possui o papel de supervisor.');
        } else if (!supervisor.isActive) {
            throw new BadRequestException('O supervisor designado está desativado.');
        }

        if (session.dataHoraInicio >= session.dataHoraFim) {
            throw new BadRequestException('O horário de início deve ser anterior ao horário de término.');
        }

        const now = new Date();
        if (session.dataHoraInicio < now || session.dataHoraFim < now) {
            throw new BadRequestException('O horário de início e término não podem ser em datas passadas.');
        }

        // Verifica se o estagiário já possui uma sessão no mesmo horário
        const overlappingSession = await this.prisma.atendimento.findFirst({
            where: {
                id_Estagiario_Executor: session.id_Estagiario_Executor,
                id_Status: StatusAtendimento.ATIVO,
                OR: [
                    {
                        dataHoraInicio: {
                            lte: session.dataHoraInicio,
                        },
                        dataHoraFim: {
                            gte: session.dataHoraInicio,
                        },
                    },
                    {
                        dataHoraInicio: {
                            lte: session.dataHoraFim,
                        },
                        dataHoraFim: {
                            gte: session.dataHoraFim,
                        },
                    },
                    {
                        dataHoraInicio: {
                            gte: session.dataHoraInicio,
                        },
                        dataHoraFim: {
                            lte: session.dataHoraFim,
                        },
                    },
                ],
            },
        });

        if (overlappingSession) {
            throw new BadRequestException('O estagiário já possui uma sessão agendada nesse horário.');
        }

        let updateListaEsperaPromise: Prisma.PrismaPromise<unknown> | null = null;

        if (session.id_Tipo_Atendimento === TipoAtendimento.TRIAGEM) {
            updateListaEsperaPromise = this.prisma.listaEspera.update({
                where: { id_Lista: session.id_Lista },
                data: { id_Status: StatusListaEspera.EM_TRIAGEM },
            });
        } else if (
            session.id_Tipo_Atendimento === TipoAtendimento.PSICOTERAPIA &&
            paciente.id_Status === StatusListaEspera.TRIAGEM_APROVADA
        ) {
            updateListaEsperaPromise = this.prisma.listaEspera.update({
                where: { id_Lista: session.id_Lista },
                data: { id_Status: StatusListaEspera.EM_PSICOTERAPIA },
            });
        }

        const queries: Prisma.PrismaPromise<unknown>[] = [
            // 1. Cria a sessão
            this.prisma.atendimento.create({
                data: {
                    dataHoraInicio: session.dataHoraInicio,
                    dataHoraFim: session.dataHoraFim,
                    id_Tipo_Atendimento: session.id_Tipo_Atendimento,
                    id_Lista: session.id_Lista,
                    id_Estagiario_Executor: session.id_Estagiario_Executor,
                    id_Supervisor_Executor: session.id_Supervisor_Executor,
                    observacoes: session.observacoes,
                },
            }),
        ];

        // 2. Adiciona a atualização de status (se houver)
        if (updateListaEsperaPromise) {
            queries.push(updateListaEsperaPromise);
        }

        // Executa as queries em transação
        const [createdSession] = await this.prisma.$transaction(queries);

        return createdSession;
    }

    async findAll(user: TokenDto, pagination: PaginationDto) {
        const { page, limit } = pagination;
        const skip = (page - 1) * limit;

        let where: Prisma.AtendimentoWhereInput = {};

        if (user.access <= RoleAccess.SECRETARIO) {
            where = {};
        } else if (user.access === RoleAccess.SUPERVISOR) {
            where = { id_Supervisor_Executor: user.sub };
        } else if (user.access === RoleAccess.ESTAGIARIO) {
            where = { id_Estagiario_Executor: user.sub };
        } else {
            throw new ForbiddenException('Você não tem permissão para ver sessões.');
        }

        const [data, total] = await Promise.all([
            this.prisma.atendimento.findMany({
                where,
                include: SESSION_LIST_INCLUDE,
                skip,
                take: limit,
                orderBy: { dataHoraInicio: 'desc' },
            }),
            this.prisma.atendimento.count({ where }),
        ]);

        return paginate(data, total, page, limit);
    }

    async findOne(id: UUID, user: TokenDto) {
        const session = await this.prisma.atendimento.findUnique({
            where: { id_Atendimento: id },
            include: this.includeRelations,
        });

        if (!session) throw new NotFoundException('Sessão não encontrada.');

        if (user.access > RoleAccess.SECRETARIO) {
            if (user.access === RoleAccess.SUPERVISOR && session.id_Supervisor_Executor !== user.sub)
                throw new ForbiddenException('Você não tem permissão para ver essa sessão.');
            if (user.access === RoleAccess.ESTAGIARIO && session.id_Estagiario_Executor !== user.sub)
                throw new ForbiddenException('Você não tem permissão para ver essa sessão.');
        }

        return this.decryptSession(session);
    }

    async findAllWithNoSession() {
        return this.prisma.listaEspera.findMany({
            where: {
                id_Status: {
                    in: [StatusListaEspera.TRIAGEM_APROVADA, StatusListaEspera.EM_PSICOTERAPIA],
                },

                NOT: {
                    Atendimento: {
                        some: {
                            id_Tipo_Atendimento: TipoAtendimento.PSICOTERAPIA,
                            id_Status: StatusAtendimento.ATIVO,
                        },
                    },
                },
            },
            select: {
                id_Lista: true,
                nomeRegistro: true,
                nomeSocial: true,
                Status: {
                    select: { nome: true },
                },
            },
        });
    }

    async update(id: UUID, updateSessionDto: UpdateSessionDto) {
        const session = await this.prisma.atendimento.findUnique({
            where: { id_Atendimento: id },
        });

        if (!session) {
            throw new NotFoundException('Sessão não encontrada.');
        }

        if (!updateSessionDto.dataHoraInicio || !updateSessionDto.dataHoraFim) {
            throw new BadRequestException('Horário de início e término devem ser informados.');
        }

        if (updateSessionDto.dataHoraInicio >= updateSessionDto.dataHoraFim) {
            throw new BadRequestException('O horário de início deve ser anterior ao horário de término.');
        }

        const now = new Date();
        if (updateSessionDto.dataHoraInicio < now || updateSessionDto.dataHoraFim < now) {
            throw new BadRequestException('O horário de início e término não podem ser em datas passadas.');
        }

        const overlappingSession = await this.prisma.atendimento.findFirst({
            where: {
                id_Status: StatusAtendimento.ATIVO,
                id_Estagiario_Executor: session.id_Estagiario_Executor,
                NOT: {
                    id_Atendimento: id,
                },
                OR: [
                    {
                        dataHoraInicio: {
                            lte: updateSessionDto.dataHoraInicio,
                        },
                        dataHoraFim: {
                            gte: updateSessionDto.dataHoraInicio,
                        },
                    },
                    {
                        dataHoraInicio: {
                            lte: updateSessionDto.dataHoraFim,
                        },
                        dataHoraFim: {
                            gte: updateSessionDto.dataHoraFim,
                        },
                    },
                    {
                        dataHoraInicio: {
                            gte: updateSessionDto.dataHoraInicio,
                        },
                        dataHoraFim: {
                            lte: updateSessionDto.dataHoraFim,
                        },
                    },
                ],
            },
        });

        if (overlappingSession) {
            throw new BadRequestException('O estagiário já possui uma sessão agendada nesse horário.');
        }

        return this.prisma.atendimento.update({
            where: { id_Atendimento: id },
            data: {
                dataHoraInicio: updateSessionDto.dataHoraInicio,
                dataHoraFim: updateSessionDto.dataHoraFim,
                observacoes: updateSessionDto.observacoes,
            },
        });
    }

    async remove(id: UUID) {
        const session = await this.prisma.atendimento.findUnique({
            where: { id_Atendimento: id },
            include: { ListaEspera: true },
        });
        if (!session) {
            throw new NotFoundException('Sessão não encontrada.');
        }

        if (session.id_Status !== StatusAtendimento.ATIVO) {
            throw new BadRequestException('Só é possível cancelar uma sessão que esteja agendada.');
        }

        let updateListaEsperaPromise: Prisma.PrismaPromise<unknown> | null = null;
        if (session.id_Tipo_Atendimento === TipoAtendimento.TRIAGEM) {
            // Se cancelou uma triagem, paciente volta para "Em espera"
            updateListaEsperaPromise = this.prisma.listaEspera.update({
                where: { id_Lista: session.id_Lista },
                data: { id_Status: StatusListaEspera.EM_ESPERA },
            });
        } else if (session.id_Tipo_Atendimento === TipoAtendimento.PSICOTERAPIA) {
            const hasOtherPsicoterapia = await this.prisma.prontuario.findFirst({
                where: {
                    atendimento: {
                        id_Lista: session.id_Lista,
                        NOT: {
                            id_Atendimento: id,
                        },
                    },
                    id_Tipo: TipoProntuario.PSICOTERAPIA,
                    id_Status: StatusProntuario.APROVADO,
                },
            });

            if (!hasOtherPsicoterapia) {
                updateListaEsperaPromise = this.prisma.listaEspera.update({
                    where: { id_Lista: session.id_Lista },
                    data: { id_Status: StatusListaEspera.TRIAGEM_APROVADA },
                });
            }
        }

        const queries: Prisma.PrismaPromise<unknown>[] = [
            this.prisma.atendimento.update({
                where: { id_Atendimento: id },
                data: { id_Status: StatusAtendimento.CANCELADO },
            }),
        ];

        if (updateListaEsperaPromise) {
            queries.push(updateListaEsperaPromise);
        }

        await this.prisma.$transaction(queries);

        return { message: `Sessão (${id}) cancelada com sucesso.` };
    }
}
