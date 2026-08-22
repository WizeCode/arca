import { RoleAccess } from 'src/common/enums/status.enum';

export interface ValidatedUserDto {
    id_User: string;
    nome: string;
    email: string;
    roleId: RoleAccess;
}
