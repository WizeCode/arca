import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { StatusListaEspera } from 'src/common/enums/status.enum';

export class WaitlistQueryDto extends PaginationDto {
    @ApiPropertyOptional({ enum: StatusListaEspera, description: 'Filtrar por status da lista de espera' })
    @IsOptional()
    @Type(() => Number)
    @IsEnum(StatusListaEspera)
    status?: StatusListaEspera;
}
