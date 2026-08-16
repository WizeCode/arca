import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum MotivoAltaEnum {
    OBJETIVOS_ATINGIDOS = 'OBJETIVOS_ATINGIDOS',
    ABANDONO = 'ABANDONO',
    ENCAMINHAMENTO_EXTERNO = 'ENCAMINHAMENTO_EXTERNO',
    SOLICITACAO_PACIENTE = 'SOLICITACAO_PACIENTE',
    OUTRO = 'OUTRO',
}

export class ConteudoRelatorioAltaDto {
    @ApiProperty({
        enum: MotivoAltaEnum,
        example: MotivoAltaEnum.OBJETIVOS_ATINGIDOS,
        description: 'Motivo da alta terapêutica',
    })
    @IsNotEmpty({ message: 'O motivo da alta é obrigatório.' })
    @IsEnum(MotivoAltaEnum)
    motivoAlta: MotivoAltaEnum;

    @ApiProperty({
        example: 'O processo terapêutico durou 8 meses com foco em TCC para ansiedade.',
        description: 'Resumo do processo terapêutico realizado',
    })
    @IsNotEmpty({ message: 'O resumo do processo terapêutico não pode estar vazio.' })
    @IsString()
    resumoProcessoTerapeutico: string;

    @ApiProperty({
        example: 'Redução significativa dos episódios de ansiedade e melhora na qualidade do sono.',
        description: 'Resultados alcançados ao longo do processo',
    })
    @IsNotEmpty({ message: 'É necessário descrever os resultados alcançados.' })
    @IsString()
    resultadosAlcancados: string;

    @ApiPropertyOptional({
        example: 'F41.1 - Transtorno de ansiedade generalizada',
        description: 'Diagnóstico final (CID-10 ou DSM-5)',
    })
    @IsOptional()
    @IsString()
    diagnosticoFinal?: string;

    @ApiPropertyOptional({
        example: 'Manter práticas de mindfulness e retornar se necessário.',
        description: 'Recomendações para o período pós-alta',
    })
    @IsOptional()
    @IsString()
    recomendacoesPosAlta?: string;
}
