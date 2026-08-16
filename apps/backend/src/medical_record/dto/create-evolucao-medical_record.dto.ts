import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { ConteudoEvolucaoDto } from './conteudo-evolucao.dto';
import { UUID } from 'node:crypto';

export class CreateEvolucaoProntuarioDto {
    @ApiProperty({
        example: 'uuid-do-atendimento',
        description: 'UUID do atendimento de psicoterapia ao qual o prontuário pertence',
    })
    @IsNotEmpty({ message: 'O ID da sessão é obrigatório.' })
    @IsUUID()
    id_Sessao: UUID;

    @ApiProperty({ type: ConteudoEvolucaoDto, description: 'Conteúdo do relatório de evolução da sessão' })
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => ConteudoEvolucaoDto)
    conteudo: ConteudoEvolucaoDto;
}
