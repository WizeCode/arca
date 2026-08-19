import { UUID } from 'node:crypto';

export interface ValidatedUserDto {
    id_User: string;
    nome: string;
    email: string;
    roleId: number;
    id_Clinica: UUID;
}
