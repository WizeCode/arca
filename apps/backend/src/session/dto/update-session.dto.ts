import { CreateSessionDto } from './create-session.dto';
import { PartialType, OmitType } from '@nestjs/swagger';

export class UpdateSessionDto extends PartialType(
    OmitType(CreateSessionDto, [
        'id_Lista',
        'id_Estagiario_Executor',
        'id_Supervisor_Executor',
        'id_Tipo_Atendimento',
    ] as const),
) {}
