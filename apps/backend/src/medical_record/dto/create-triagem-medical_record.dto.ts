import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { ConteudoTriagemDto } from './conteudo-triagem.dto';
import { UUID } from 'node:crypto';

export class CreateTriagemProntuarioDto {
    @ApiProperty({
        example: 'uuid-do-atendimento',
        description: 'UUID do atendimento de triagem ao qual o prontuário pertence',
    })
    @IsNotEmpty({ message: 'O ID da sessão é obrigatório.' })
    @IsUUID()
    id_Sessao: UUID;

    @ApiProperty({ type: ConteudoTriagemDto, description: 'Conteúdo do relatório de triagem' })
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => ConteudoTriagemDto)
    conteudo: ConteudoTriagemDto;
}
