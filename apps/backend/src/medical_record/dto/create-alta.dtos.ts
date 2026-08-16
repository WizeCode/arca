import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { CreateEncaminhamentoDto } from './create-encaminhamento.dto';

export class CreateAltaDto extends CreateEncaminhamentoDto {
    @ApiProperty({ example: false, description: 'Indica se o paciente recebeu alta terapêutica' })
    @IsNotEmpty({ message: 'O campo recebeuAlta não pode estar vazio.' })
    @IsBoolean()
    recebeuAlta: boolean;

    @ApiPropertyOptional({
        example: 'Alta terapêutica por objetivos atingidos.',
        description: 'Finalidade ou descrição da alta',
    })
    @IsOptional()
    @IsString({
        message: 'O campo instituicaoEncaminhada deve ser um texto.',
    })
    finalidade?: string;
}
