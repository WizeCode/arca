import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class ConteudoEvolucaoDto {
    @ApiProperty({
        example: 'Paciente apresentou melhora nos sintomas de ansiedade. Técnica de respiração aplicada.',
        description: 'Relatório narrativo da sessão de psicoterapia',
    })
    @IsNotEmpty({ message: 'O relatorio não pode estar vazio.' })
    @IsString()
    relatorioDaSessao: string;

    @ApiProperty({ example: true, description: 'Indica se o paciente compareceu à sessão' })
    @IsNotEmpty({ message: 'A presença não pode estar vazia.' })
    @IsBoolean()
    presente: boolean;
}
