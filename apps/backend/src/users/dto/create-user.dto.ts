import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
    @ApiProperty({ example: 'Pedro Silva', description: 'Nome completo do usuário (máx. 50 caracteres)' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    nome: string;

    @ApiProperty({ example: 'pedro@clinica.com', description: 'E-mail de acesso ao sistema' })
    @IsEmail()
    @IsNotEmpty()
    @MaxLength(100)
    email: string;

    @ApiProperty({ example: 'senha1234', description: 'Senha inicial do usuário (mínimo 8 caracteres)' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(255)
    senha: string;

    @ApiProperty({
        example: 4,
        description: 'ID do perfil de acesso: 1=Coordenador, 2=Secretário, 3=Supervisor, 4=Estagiário',
    })
    @IsInt()
    @Min(1)
    @Transform(({ value }: { value: string }) => parseInt(value))
    roleId: number;

    @ApiPropertyOptional({
        example: '06/12345',
        description: 'CRP do supervisor no formato XX/XXXXX ou XX/XXXXXX. Obrigatório quando roleId=3.',
    })
    @IsOptional()
    @IsString({ message: 'O CRP deve ser um texto.' })
    @IsNotEmpty({ message: 'O campo CRP não pode ser vazio.' })
    @Matches(/^\d{2}\/\d{5,6}$/, {
        message: 'O CRP é inválido. O formato esperado é XX/XXXXX ou XX/XXXXXX (ex: 06/12345).',
    })
    crp?: string;
}
