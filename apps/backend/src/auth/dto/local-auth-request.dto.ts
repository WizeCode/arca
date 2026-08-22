import { RoleAccess } from 'src/common/enums/status.enum';

export interface LocalAuthRequest {
    user: {
        id_User: string;
        nome: string;
        email: string;
        roleId: RoleAccess;
    };
}
