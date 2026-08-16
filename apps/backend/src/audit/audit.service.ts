import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client'; // Importa o tipo JsonValue
import { paginate } from 'src/common/dto/pagination.dto';
import { AuditFilterDto } from './dto/audit-filter.dto';

export interface CreateAuditLogDto {
    id_Usuario_Executor: string;
    nome_Usuario_Executor: string;
    tipoAcao: string;
    entidade_Afetada?: string;
    id_Entidade_Afetada?: string;
    endereco_Ip?: string;
    detalhes?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) {}

    async create(logData: CreateAuditLogDto) {
        return await this.prisma.logAuditoria.create({
            data: logData,
        });
    }

    async findAll(filter: AuditFilterDto) {
        const { page, limit, dataInicio, dataFim, tipoAcao, entidade_Afetada } = filter;
        const skip = (page - 1) * limit;

        const where: Prisma.LogAuditoriaWhereInput = {};

        if (dataInicio || dataFim) {
            where.acessoEm = {
                ...(dataInicio && { gte: new Date(dataInicio) }),
                ...(dataFim &&
                    (() => {
                        const end = new Date(dataFim);
                        end.setUTCHours(23, 59, 59, 999);
                        return { lte: end };
                    })()),
            };
        }

        if (tipoAcao) {
            where.tipoAcao = { contains: tipoAcao, mode: 'insensitive' };
        }

        if (entidade_Afetada) {
            where.entidade_Afetada = { contains: entidade_Afetada, mode: 'insensitive' };
        }

        const [data, total] = await Promise.all([
            this.prisma.logAuditoria.findMany({
                where,
                skip,
                take: limit,
                orderBy: { acessoEm: 'desc' },
            }),
            this.prisma.logAuditoria.count({ where }),
        ]);

        return paginate(data, total, page, limit);
    }
}
