import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { CreateTriagemProntuarioDto } from './dto/create-triagem-medical_record.dto';
import { CreateEvolucaoProntuarioDto } from './dto/create-evolucao-medical_record.dto';
import { TokenDto } from 'src/common/dto/token.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UUID } from 'node:crypto';
import { ConteudoTriagemDto } from './dto/conteudo-triagem.dto';
import { ConteudoEvolucaoDto } from './dto/conteudo-evolucao.dto';
import type { ConteudoRelatorioAltaDto } from './dto/conteudo-relatorio-alta.dto';
import { CreateEncaminhamentoDto } from './dto/create-encaminhamento.dto';
import { CreateAltaDto } from './dto/create-alta.dtos';
import { PdfService } from 'src/pdf/pdf.service';
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
import { Response } from 'express';

interface ConteudoEncaminhamento {
    instituicaoEncaminhada: string;
    motivoEncaminhamento: string;
}

@Injectable()
export class MedicalRecordService {
    private readonly logger = new Logger(MedicalRecordService.name);

    constructor(
        private prisma: PrismaService,
        private pdfService: PdfService,
        private cryptoService: CryptoService,
    ) {}

    private encrypt(data: object): string {
        return this.cryptoService.encrypt(data);
    }

    /**
     * Descriptografa o campo conteudo vindo do banco.
     * Aceita tanto string cifrada (novo formato) quanto objetos JSON
     * já parseados pelo Prisma (registros antigos ainda em JSON).
     */

    async createTriagem(createTriagemProntuarioDto: CreateTriagemProntuarioDto, user: TokenDto) {
        const atendimento = await this.prisma.atendimento.findFirst({
            where: { id_Atendimento: createTriagemProntuarioDto.id_Sessao },
            include: {
                ListaEspera: true,
            },
        });
        if (!atendimento) throw new NotFoundException('Atendimento não encontrado.');
        if (atendimento?.id_Tipo_Atendimento !== TipoAtendimento.TRIAGEM)
            throw new BadRequestException('Atendimento não é de triagem.');
        if (atendimento.id_Status !== StatusAtendimento.ATIVO)
            throw new BadRequestException('Atendimento não está ativo ou já foi concluido.');
        if (atendimento.ListaEspera?.id_Status !== StatusListaEspera.EM_TRIAGEM)
            throw new BadRequestException(
                'Paciente ja possuí triagem concluída ou em andamento. Não é possível criar outra triagem.',
            );
        if (!atendimento.id_Estagiario_Executor || !atendimento.id_Supervisor_Executor) {
            throw new InternalServerErrorException('Estagiário ou supervisor não atribuídos para este atendimento.');
        }

        if (user.access > RoleAccess.SECRETARIO) {
            const isEstagiarioResponsavel = atendimento.id_Estagiario_Executor === user.sub;
            const isSupervisorResponsavel = atendimento.id_Supervisor_Executor === user.sub;
            if (!isEstagiarioResponsavel && !isSupervisorResponsavel)
                throw new ForbiddenException(
                    'Você não tem permissão para criar um relatório de triagem para este atendimento.',
                );
        }

        try {
            const [relatorioTriagem] = await this.prisma.$transaction([
                this.prisma.prontuario.create({
                    data: {
                        id_Atendimento: createTriagemProntuarioDto.id_Sessao,

                        conteudo: this.encrypt(createTriagemProntuarioDto.conteudo),

                        id_Status: StatusProntuario.EM_APROVACAO,
                        id_Tipo: TipoProntuario.TRIAGEM,
                    },
                }),

                this.prisma.atendimento.update({
                    where: { id_Atendimento: createTriagemProntuarioDto.id_Sessao },
                    data: {
                        id_Status: StatusAtendimento.EM_ANDAMENTO,
                    },
                }),
            ]);

            return relatorioTriagem;
        } catch (error) {
            this.logger.error('Falha ao salvar triagem', error instanceof Error ? error.stack : error);
            throw new InternalServerErrorException(
                'Erro no banco de dados. Falha ao salvar a triagem. Tente novamente.',
            );
        }
    }

    async putTriagem(id: UUID, conteudoTriagemDto: ConteudoTriagemDto, user: TokenDto) {
        const prontuario = await this.prisma.prontuario.findUnique({
            where: { id_Registro: id },
            include: {
                atendimento: {
                    select: {
                        id_Lista: true,
                        id_Supervisor_Executor: true,
                        id_Estagiario_Executor: true,
                    },
                },
            },
        });

        if (!prontuario) throw new NotFoundException('Registro não encontrado.');
        if (prontuario.id_Tipo !== TipoProntuario.TRIAGEM) throw new BadRequestException('Registro não é de triagem.');
        if (prontuario.id_Status !== StatusProntuario.EM_APROVACAO)
            throw new BadRequestException('Triagem já foi aprovada, não é possível alterar os dados.');

        if (!prontuario.atendimento?.id_Supervisor_Executor)
            throw new InternalServerErrorException('Dados do atendimento inválidos.');

        if (user.access === RoleAccess.SUPERVISOR && user.sub !== prontuario.atendimento.id_Supervisor_Executor)
            throw new ForbiddenException('Apenas o supervisor responsável pode editar essa triagem.');

        if (user.access === RoleAccess.ESTAGIARIO && user.sub !== prontuario.atendimento.id_Estagiario_Executor)
            throw new ForbiddenException('Apenas o estagiario responsável pode editar essa triagem.');

        return await this.prisma.prontuario.update({
            where: { id_Registro: id },
            data: {
                conteudo: this.encrypt(conteudoTriagemDto),
            },
        });
    }

    async approveTriagem(id: UUID, createEncaminhamentoDto: CreateEncaminhamentoDto, user: TokenDto) {
        const prontuario = await this.prisma.prontuario.findUnique({
            where: { id_Registro: id },
            include: {
                atendimento: {
                    select: {
                        id_Lista: true,
                        id_Supervisor_Executor: true,
                        id_Atendimento: true,
                    },
                },
            },
        });

        if (!prontuario) throw new NotFoundException('Registro não encontrado.');
        if (prontuario.id_Tipo !== TipoProntuario.TRIAGEM) throw new BadRequestException('Registro não é de triagem.');
        if (prontuario.id_Status !== StatusProntuario.EM_APROVACAO)
            throw new BadRequestException('Triagem já foi aprovada.');
        if (!prontuario.atendimento?.id_Supervisor_Executor)
            throw new InternalServerErrorException('Dados do atendimento inválidos.');
        if (user.access === RoleAccess.SUPERVISOR && user.sub !== prontuario.atendimento.id_Supervisor_Executor)
            throw new ForbiddenException('Apenas o supervisor responsável pode aprovar esta triagem.');

        const transactionPromises: Prisma.PrismaPromise<unknown>[] = [];

        transactionPromises.push(
            this.prisma.prontuario.update({
                where: { id_Registro: id },
                data: {
                    id_Status: StatusProntuario.APROVADO,
                },
            }),
        );

        transactionPromises.push(
            this.prisma.atendimento.update({
                where: { id_Atendimento: prontuario.id_Atendimento },
                data: {
                    id_Status: StatusAtendimento.CONCLUIDO,
                },
            }),
        );

        if (createEncaminhamentoDto.encaminhado) {
            const { instituicaoEncaminhada, motivoEncaminhamento } = createEncaminhamentoDto;
            if (!instituicaoEncaminhada || instituicaoEncaminhada.trim() === '') {
                throw new BadRequestException(
                    'O campo instituicaoEncaminhada é obrigatório quando "encaminhado" é verdadeiro.',
                );
            }
            if (!motivoEncaminhamento || motivoEncaminhamento.trim() === '') {
                throw new BadRequestException(
                    'O campo motivoEncaminhamento é obrigatório quando "encaminhado" é verdadeiro.',
                );
            }

            transactionPromises.push(
                this.prisma.listaEspera.update({
                    where: { id_Lista: prontuario.atendimento.id_Lista },
                    data: {
                        id_Status: StatusListaEspera.ENCAMINHADO,
                    },
                }),
            );

            transactionPromises.push(
                this.prisma.prontuario.create({
                    data: {
                        id_Atendimento: prontuario.id_Atendimento,
                        conteudo: this.encrypt({ instituicaoEncaminhada, motivoEncaminhamento }),
                        id_Status: StatusProntuario.APROVADO,
                        id_Tipo: TipoProntuario.ENCAMINHAMENTO,
                    },
                }),
            );
        } else {
            transactionPromises.push(
                this.prisma.listaEspera.update({
                    where: { id_Lista: prontuario.atendimento.id_Lista },
                    data: {
                        id_Status: StatusListaEspera.TRIAGEM_APROVADA,
                    },
                }),
            );
        }

        try {
            await this.prisma.$transaction(transactionPromises);

            return createEncaminhamentoDto.encaminhado
                ? 'Paciente encaminhado com sucesso.'
                : 'Triagem aprovada com sucesso.';
        } catch (error) {
            this.logger.error('Falha ao aprovar triagem', error instanceof Error ? error.stack : error);
            throw new InternalServerErrorException(
                'Erro no banco de dados. Falha ao aprovar a triagem. Tente novamente.',
            );
        }
    }

    async createEvolucao(createEvolucaoProntuarioDto: CreateEvolucaoProntuarioDto, user: TokenDto) {
        const atendimento = await this.prisma.atendimento.findFirst({
            where: { id_Atendimento: createEvolucaoProntuarioDto.id_Sessao },
            include: {
                ListaEspera: true,
            },
        });
        if (!atendimento) throw new NotFoundException('Atendimento não encontrado.');
        if (atendimento?.id_Tipo_Atendimento !== TipoAtendimento.PSICOTERAPIA)
            throw new BadRequestException('Atendimento não é de psicoterapia');
        if (atendimento.id_Status !== StatusAtendimento.ATIVO)
            throw new BadRequestException('Atendimento não está ativo ou já foi concluido.');

        const status = atendimento.ListaEspera?.id_Status;
        if (status !== StatusListaEspera.TRIAGEM_APROVADA && status !== StatusListaEspera.EM_PSICOTERAPIA)
            throw new BadRequestException(
                'Paciente não possuí triagem aprovada. Não é possível criar um registro de psicoterapia.',
            );
        if (!atendimento.id_Estagiario_Executor || !atendimento.id_Supervisor_Executor) {
            throw new InternalServerErrorException('Estagiário ou supervisor não atribuídos para este atendimento.');
        }

        if (user.access > RoleAccess.SECRETARIO) {
            const isEstagiario = atendimento.id_Estagiario_Executor === user.sub;
            const isSupervisor = atendimento.id_Supervisor_Executor === user.sub;
            if (!isEstagiario && !isSupervisor)
                throw new ForbiddenException(
                    'Você não tem permissão para criar um relatório de psicoterapia para este atendimento.',
                );
        }

        try {
            const [relatorioEvolucao] = await this.prisma.$transaction([
                this.prisma.prontuario.create({
                    data: {
                        id_Atendimento: createEvolucaoProntuarioDto.id_Sessao,

                        conteudo: this.encrypt(createEvolucaoProntuarioDto.conteudo),

                        id_Status: StatusProntuario.EM_APROVACAO,
                        id_Tipo: TipoProntuario.PSICOTERAPIA,
                    },
                }),

                this.prisma.atendimento.update({
                    where: { id_Atendimento: createEvolucaoProntuarioDto.id_Sessao },
                    data: {
                        id_Status: StatusAtendimento.EM_ANDAMENTO,
                    },
                }),
            ]);

            return relatorioEvolucao;
        } catch (error) {
            this.logger.error(
                'Falha ao salvar relatório de psicoterapia',
                error instanceof Error ? error.stack : error,
            );
            throw new InternalServerErrorException(
                'Erro no banco de dados. Falha ao salvar o relatorio de psicoterapia. Tente novamente.',
            );
        }
    }

    async putEvolucao(id: UUID, conteudoEvolucaoDto: ConteudoEvolucaoDto, user: TokenDto) {
        const prontuario = await this.prisma.prontuario.findUnique({
            where: { id_Registro: id },
            include: {
                atendimento: {
                    select: {
                        id_Lista: true,
                        id_Supervisor_Executor: true,
                        id_Estagiario_Executor: true,
                    },
                },
            },
        });

        if (!prontuario) throw new NotFoundException('Registro não encontrado.');
        if (prontuario.id_Tipo !== TipoProntuario.PSICOTERAPIA)
            throw new BadRequestException('Registro não é de evolução/psicoterapia.');
        if (prontuario.id_Status !== StatusProntuario.EM_APROVACAO)
            throw new BadRequestException('Registro de evolução já foi aprovado, não é possível alterar os dados.');

        if (!prontuario.atendimento?.id_Supervisor_Executor)
            throw new InternalServerErrorException('Dados do atendimento inválidos.');

        if (user.access === RoleAccess.SUPERVISOR && user.sub !== prontuario.atendimento.id_Supervisor_Executor)
            throw new ForbiddenException('Apenas o supervisor responsável pode editar esse registro de evolução.');

        if (user.access === RoleAccess.ESTAGIARIO && user.sub !== prontuario.atendimento.id_Estagiario_Executor)
            throw new ForbiddenException('Apenas o estagiario responsável pode editar esse registro de evolução.');

        return await this.prisma.prontuario.update({
            where: { id_Registro: id },
            data: {
                conteudo: this.encrypt(conteudoEvolucaoDto),
            },
        });
    }

    async approveEvolucao(id: UUID, createAltaDto: CreateAltaDto, user: TokenDto) {
        const prontuario = await this.prisma.prontuario.findUnique({
            where: { id_Registro: id },
            include: {
                atendimento: {
                    select: {
                        id_Lista: true,
                        id_Supervisor_Executor: true,
                        id_Atendimento: true,
                    },
                },
            },
        });

        if (!prontuario) throw new NotFoundException('Registro não encontrado.');
        if (prontuario.id_Tipo !== TipoProntuario.PSICOTERAPIA)
            throw new BadRequestException('Registro não é de registro em psicoterapia.');
        if (prontuario.id_Status !== StatusProntuario.EM_APROVACAO)
            throw new BadRequestException('Registro de psicoterapia já foi aprovado.');
        if (!prontuario.atendimento?.id_Supervisor_Executor)
            throw new InternalServerErrorException('Dados do atendimento inválidos.');
        if (user.access === RoleAccess.SUPERVISOR && user.sub !== prontuario.atendimento.id_Supervisor_Executor)
            throw new ForbiddenException('Apenas o supervisor responsável pode aprovar este registro de psicoterapia.');

        const transactionPromises: Prisma.PrismaPromise<unknown>[] = [];
        let altaCriada = false;
        let encaminhamentoCriado = false;

        transactionPromises.push(
            this.prisma.prontuario.update({
                where: { id_Registro: id },
                data: {
                    id_Status: StatusProntuario.APROVADO,
                },
            }),
        );

        transactionPromises.push(
            this.prisma.atendimento.update({
                where: { id_Atendimento: prontuario.id_Atendimento },
                data: {
                    id_Status: StatusAtendimento.CONCLUIDO,
                },
            }),
        );

        if (createAltaDto.recebeuAlta) {
            const { finalidade } = createAltaDto;
            if (!finalidade || finalidade.trim() === '') {
                throw new BadRequestException('O campo finalidade é obrigatório quando "recebeuAlta" é verdadeiro.');
            }

            transactionPromises.push(
                this.prisma.prontuario.create({
                    data: {
                        id_Atendimento: prontuario.id_Atendimento,
                        conteudo: this.encrypt({ finalidade }),
                        id_Status: StatusProntuario.APROVADO,
                        id_Tipo: TipoProntuario.ALTA,
                    },
                }),
            );

            altaCriada = true;
            transactionPromises.push(
                this.prisma.listaEspera.update({
                    where: { id_Lista: prontuario.atendimento.id_Lista },
                    data: {
                        id_Status: StatusListaEspera.RECEBEU_ALTA,
                    },
                }),
            );
        }

        if (createAltaDto.encaminhado) {
            const { instituicaoEncaminhada, motivoEncaminhamento } = createAltaDto;
            if (!instituicaoEncaminhada || instituicaoEncaminhada.trim() === '') {
                throw new BadRequestException(
                    'O campo instituicaoEncaminhada é obrigatório quando "encaminhado" é verdadeiro.',
                );
            }
            if (!motivoEncaminhamento || motivoEncaminhamento.trim() === '') {
                throw new BadRequestException(
                    'O campo motivoEncaminhamento é obrigatório quando "encaminhado" é verdadeiro.',
                );
            }

            transactionPromises.push(
                this.prisma.prontuario.create({
                    data: {
                        id_Atendimento: prontuario.id_Atendimento,
                        conteudo: this.encrypt({ instituicaoEncaminhada, motivoEncaminhamento }),
                        id_Status: StatusProntuario.APROVADO,
                        id_Tipo: TipoProntuario.ENCAMINHAMENTO,
                    },
                }),
            );
            encaminhamentoCriado = true;
        }

        try {
            await this.prisma.$transaction(transactionPromises);

            if (altaCriada && encaminhamentoCriado) {
                return 'Evolução aprovada. Alta e Encaminhamento gerados com sucesso.';
            } else if (altaCriada) {
                return 'Evolução aprovada. Relatório de Alta gerado com sucesso.';
            } else if (encaminhamentoCriado) {
                return 'Evolução aprovada. Encaminhamento gerado com sucesso.';
            } else {
                return 'Evolução aprovada com sucesso.';
            }
        } catch (error) {
            this.logger.error('Falha ao aprovar evolução', error instanceof Error ? error.stack : error);
            throw new InternalServerErrorException(
                'Erro no banco de dados. Falha ao aprovar a evolução. Tente novamente.',
            );
        }
    }

    async generatePdf(id: UUID, user: TokenDto, res: Response) {
        const paciente = await this.findOne(id, user);

        const dataForPdf = {
            paciente: {
                nome: paciente.nomeRegistro,
                nomeSocial: paciente.nomeSocial,
                cpf: paciente.CPF || 'N/A',
                dataNascimento: new Date(paciente.dataNascimento).toLocaleDateString('pt-BR'),
                status: paciente.Status.nome,
            },
            atendimentos: paciente.Atendimento.map((atd) => ({
                data: new Date(atd.dataHoraInicio).toLocaleDateString('pt-BR'),
                supervisor: atd.supervisorExecutor?.nome || 'N/A',
                estagiario: atd.estagiarioExecutor?.nome || 'N/A',
                supervisorCRP: atd.supervisorExecutor?.CRP ?? 'N/A',
                prontuarios: atd.Prontuario.map((p) => {
                    return {
                        id_Registro: p.id_Registro,
                        conteudo: p.conteudo,
                        dataEmissao: new Date(p.dataEmissao).toLocaleDateString('pt-BR'),
                        id_Status: p.id_Status,
                        id_Tipo: p.id_Tipo,
                        tipo: p.TipoProntuario.nome,
                        status: p.status.nome,
                    };
                }),
            })),
        };

        const pdfBuffer = await this.pdfService.generatePdfFromTemplate('prontuario', dataForPdf);

        if (!pdfBuffer) throw new InternalServerErrorException('Erro ao gerar o PDF.');

        const filename = `prontuario-arca-${paciente.nomeRegistro.replace(/\s+/g, '_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        res.send(pdfBuffer);
    }

    async generateAltaPdf(id: UUID, user: TokenDto, res: Response) {
        const paciente = await this.findOne(id, user);

        const atdComAlta = paciente.Atendimento.find((atd) =>
            atd.Prontuario.some((p) => p.id_Tipo === TipoProntuario.ALTA),
        );

        if (!atdComAlta) {
            throw new NotFoundException('Registro de Alta não encontrado para este paciente.');
        }

        const altaRecord = atdComAlta.Prontuario.find((p) => p.id_Tipo === TipoProntuario.ALTA)!;
        const supervisorNome = atdComAlta.supervisorExecutor?.nome ?? 'N/A';
        const supervisorCRP = atdComAlta.supervisorExecutor?.CRP ?? 'N/A';

        const datasAtendimento = paciente.Atendimento.map((atd) => new Date(atd.dataHoraInicio).getTime());
        const dataInicio = new Date(Math.min(...datasAtendimento)).toLocaleDateString('pt-BR');
        const dataFim = new Date(Math.max(...datasAtendimento)).toLocaleDateString('pt-BR');

        const dataForPdf = {
            pacienteNome: paciente.nomeRegistro,
            cpf: paciente.CPF || 'N/A',
            supervisorNome: supervisorNome,
            supervisorCRP: supervisorCRP,

            solicitanteNome: 'O próprio paciente',
            finalidade: 'Comprovação de acompanhamento psicológico',

            dataInicio: dataInicio,
            dataFim: dataFim,
            motivoAlta: (altaRecord.conteudo as unknown as ConteudoRelatorioAltaDto).motivoAlta,
            dataAlta: new Date(altaRecord.dataEmissao).toLocaleDateString('pt-BR'),
            dataDocumento: new Date().toLocaleDateString('pt-BR'),
        };

        const pdfBuffer = await this.pdfService.generatePdfFromTemplate('alta', dataForPdf);

        if (!pdfBuffer) throw new InternalServerErrorException('Erro ao gerar o PDF.');

        const filename = `alta-arca-${paciente.nomeRegistro.replace(/\s+/g, '_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        res.send(pdfBuffer);
    }

    async generateEncaminhamentoPdf(id: UUID, user: TokenDto, res: Response) {
        // Buscar o prontuário específico de encaminhamento pelo ID do registro
        const encaminhamentoRecord = await this.prisma.prontuario.findUnique({
            where: { id_Registro: id },
            include: {
                TipoProntuario: true,
                atendimento: {
                    include: {
                        ListaEspera: true,
                        supervisorExecutor: true,
                    },
                },
            },
        });

        if (!encaminhamentoRecord) {
            throw new NotFoundException('Registro de Encaminhamento não encontrado.');
        }

        if (encaminhamentoRecord.id_Tipo !== TipoProntuario.ENCAMINHAMENTO) {
            throw new BadRequestException('O registro fornecido não é do tipo Encaminhamento.');
        }

        if (user.access === RoleAccess.SUPERVISOR) {
            if (encaminhamentoRecord.atendimento.id_Supervisor_Executor !== user.sub) {
                throw new ForbiddenException('Você não tem permissão para acessar este registro.');
            }
        }

        if (user.access === RoleAccess.ESTAGIARIO) {
            if (encaminhamentoRecord.atendimento.id_Estagiario_Executor !== user.sub) {
                throw new ForbiddenException('Você não tem permissão para acessar este registro.');
            }
        }

        const paciente = encaminhamentoRecord.atendimento.ListaEspera;
        const supervisorNome = encaminhamentoRecord.atendimento.supervisorExecutor?.nome || 'N/A';
        const supervisorCRP = encaminhamentoRecord.atendimento.supervisorExecutor?.CRP ?? 'N/A';

        const pacienteCompleto = await this.prisma.listaEspera.findUnique({
            where: { id_Lista: paciente.id_Lista },
            include: {
                Atendimento: {
                    include: {
                        Prontuario: {
                            where: { id_Tipo: TipoProntuario.TRIAGEM },
                        },
                    },
                },
            },
        });

        if (!pacienteCompleto) {
            throw new NotFoundException('Paciente não encontrado.');
        }

        const atdComTriagem = pacienteCompleto.Atendimento.find((atd) => atd.Prontuario.length > 0);

        if (!atdComTriagem) {
            throw new NotFoundException('Registro de Triagem não encontrado. Não é possível gerar o encaminhamento.');
        }

        const triagemRecord = atdComTriagem.Prontuario[0];

        const conteudoEncaminhamento = encaminhamentoRecord.conteudo as unknown as ConteudoEncaminhamento;

        const dataForPdf = {
            pacienteNome: paciente.nomeRegistro,
            cpf: paciente.CPF || 'N/A',
            supervisorNome: supervisorNome,
            supervisorCRP: supervisorCRP,

            instituicaoNome: conteudoEncaminhamento.instituicaoEncaminhada,
            motivoEncaminhamento: conteudoEncaminhamento.motivoEncaminhamento,

            dataInicioTriagem: new Date(triagemRecord.dataEmissao).toLocaleDateString('pt-BR'),
            dataFimTriagem: new Date(triagemRecord.dataEmissao).toLocaleDateString('pt-BR'),

            dataDocumento: new Date().toLocaleDateString('pt-BR'),
        };

        const pdfBuffer = await this.pdfService.generatePdfFromTemplate('encaminhamento', dataForPdf);

        if (!pdfBuffer) throw new InternalServerErrorException('Erro ao gerar o PDF de encaminhamento.');

        const filename = `declaracao-encaminhamento-${paciente.nomeRegistro.replace(/\s+/g, '_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        res.send(pdfBuffer);
    }

    async findAll(user: TokenDto, pagination: PaginationDto) {
        const { page, limit } = pagination;
        const skip = (page - 1) * limit;

        if (user.access > RoleAccess.ESTAGIARIO) {
            return paginate([], 0, page, limit);
        }

        const whereCondition: Prisma.ListaEsperaWhereInput = {
            Atendimento: {
                some: {
                    Prontuario: { some: {} },
                    ...(user.access === RoleAccess.SUPERVISOR && { id_Supervisor_Executor: user.sub }),
                    ...(user.access === RoleAccess.ESTAGIARIO && { id_Estagiario_Executor: user.sub }),
                },
            },
        };

        const atendimentosWhere: Prisma.AtendimentoWhereInput = {
            Prontuario: { some: {} },
            ...(user.access === RoleAccess.SUPERVISOR && { id_Supervisor_Executor: user.sub }),
            ...(user.access === RoleAccess.ESTAGIARIO && { id_Estagiario_Executor: user.sub }),
        };

        const [data, total] = await Promise.all([
            this.prisma.listaEspera.findMany({
                where: whereCondition,
                skip,
                take: limit,
                select: {
                    id_Lista: true,
                    nomeRegistro: true,
                    nomeSocial: true,
                    id_Status: true,
                    Status: { select: { nome: true } },
                    Atendimento: {
                        where: atendimentosWhere,
                        select: {
                            Prontuario: {
                                select: {
                                    id_Registro: true,
                                    dataEmissao: true,
                                    id_Status: true,
                                    id_Tipo: true,
                                    ultimaAtualizacao: true,
                                },
                                orderBy: { dataEmissao: 'asc' },
                            },
                        },
                    },
                },
                orderBy: { nomeRegistro: 'asc' },
            }),
            this.prisma.listaEspera.count({ where: whereCondition }),
        ]);

        return paginate(data, total, page, limit);
    }

    async findOne(id: UUID, user: TokenDto) {
        const whereCondition: Prisma.ListaEsperaWhereInput = {
            id_Lista: id,
            Atendimento: {
                some: {
                    Prontuario: {
                        some: {},
                    },
                },
            },
        };

        const includeAtendimentosWhere: Prisma.AtendimentoWhereInput = {
            Prontuario: {
                some: {},
            },
        };

        if (user.access === RoleAccess.SUPERVISOR) {
            if (whereCondition.Atendimento?.some) {
                whereCondition.Atendimento.some.id_Supervisor_Executor = user.sub;
            }

            includeAtendimentosWhere.id_Supervisor_Executor = user.sub;
        } else if (user.access === RoleAccess.ESTAGIARIO) {
            if (whereCondition.Atendimento?.some) {
                whereCondition.Atendimento.some.id_Estagiario_Executor = user.sub;
            }

            includeAtendimentosWhere.id_Estagiario_Executor = user.sub;
        } else if (user.access > RoleAccess.ESTAGIARIO) {
            throw new NotFoundException(`Paciente com ID ${id} não encontrado.`);
        }

        const paciente = await this.prisma.listaEspera.findFirst({
            where: whereCondition,
            select: {
                id_Lista: true,
                nomeRegistro: true,
                nomeSocial: true,
                id_Status: true,
                Status: {
                    select: { nome: true },
                },
                CPF: true,
                telefonePessoal: true,
                dataNascimento: true,

                Atendimento: {
                    where: includeAtendimentosWhere,
                    select: {
                        dataHoraInicio: true,
                        supervisorExecutor: { select: { nome: true, CRP: true } },
                        estagiarioExecutor: { select: { nome: true } },
                        Prontuario: {
                            select: {
                                id_Registro: true,
                                conteudo: true,
                                dataEmissao: true,
                                id_Status: true,
                                id_Tipo: true,
                                ultimaAtualizacao: true,
                                status: { select: { nome: true } },
                                TipoProntuario: { select: { nome: true } },
                            },
                            orderBy: { dataEmissao: 'asc' },
                        },
                    },
                    orderBy: [{ dataHoraInicio: 'asc' }],
                },
            },
        });

        if (!paciente) {
            throw new NotFoundException(`Paciente com ID ${id} não encontrado.`);
        }

        return {
            ...paciente,
            Atendimento: paciente.Atendimento.map((atd) => ({
                ...atd,
                Prontuario: atd.Prontuario.map((p) => ({
                    ...p,
                    conteudo: this.cryptoService.decryptConteudo(p.conteudo),
                })),
            })),
        };
    }
}
