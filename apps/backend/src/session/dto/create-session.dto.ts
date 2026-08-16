import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { UUID } from 'node:crypto';

export class CreateSessionDto {
    @ApiProperty({ example: '2025-01-15T10:00:00Z', description: 'Data e hora de início do atendimento (ISO 8601)' })
    @IsNotEmpty()
    @Transform(({ value }: { value: string }) => new Date(value))
    dataHoraInicio: Date;

    @ApiProperty({ example: '2025-01-15T11:00:00Z', description: 'Data e hora de fim do atendimento (ISO 8601)' })
    @IsNotEmpty()
    @Transform(({ value }: { value: string }) => new Date(value))
    dataHoraFim: Date;

    @ApiProperty({ example: 'uuid-do-paciente', description: 'UUID do paciente na lista de espera' })
    @IsUUID()
    @IsNotEmpty()
    id_Lista: UUID;

    @ApiProperty({ example: 'uuid-do-estagiario', description: 'UUID do estagiário executor do atendimento' })
    @IsUUID()
    @IsNotEmpty()
    id_Estagiario_Executor: UUID;

    @ApiProperty({ example: 'uuid-do-supervisor', description: 'UUID do supervisor responsável' })
    @IsUUID()
    @IsNotEmpty()
    id_Supervisor_Executor: UUID;

    @ApiProperty({ example: 1, description: 'Tipo do atendimento: 1=Triagem, 2=Psicoterapia' })
    @IsInt()
    @IsNotEmpty()
    id_Tipo_Atendimento: number;

    @ApiPropertyOptional({
        example: 'Paciente solicitou horário vespertino.',
        description: 'Observações sobre o agendamento',
    })
    @IsString()
    @IsOptional()
    observacoes?: string;
}
