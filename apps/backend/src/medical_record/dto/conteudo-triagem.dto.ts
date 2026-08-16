import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class ConteudoTriagemDto {
    @ApiProperty({
        example: 'Paciente relata ansiedade intensa há 6 meses após perda de emprego.',
        description: 'Relatório narrativo da sessão de triagem',
    })
    @IsNotEmpty({ message: 'O relatorio não pode estar vazio.' })
    @IsString()
    relatorioDaSessao: string;

    @ApiProperty({ example: true, description: 'Indica se o paciente compareceu à sessão' })
    @IsNotEmpty({ message: 'A presença não pode estar vazia.' })
    @IsBoolean()
    presente: boolean;
}
