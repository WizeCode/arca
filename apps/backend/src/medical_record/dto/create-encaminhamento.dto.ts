import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateEncaminhamentoDto {
    @ApiProperty({ example: false, description: 'Indica se o paciente foi encaminhado para serviço externo' })
    @IsNotEmpty({ message: 'O campo encaminhado não pode estar vazio.' })
    @IsBoolean()
    encaminhado: boolean;

    @ApiPropertyOptional({
        example: 'CAPS - Centro de Atenção Psicossocial',
        description: 'Instituição para a qual o paciente foi encaminhado (obrigatório se encaminhado=true)',
    })
    @IsOptional()
    @IsString({
        message: 'O campo instituicaoEncaminhada deve ser um texto.',
    })
    instituicaoEncaminhada?: string;

    @ApiPropertyOptional({
        example: 'Necessidade de acompanhamento psiquiátrico.',
        description: 'Motivo do encaminhamento externo',
    })
    @IsOptional()
    @IsString({
        message: 'O campo motivoEncaminhamento deve ser um texto.',
    })
    motivoEncaminhamento?: string;
}
