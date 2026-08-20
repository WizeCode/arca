import { IsEmail, IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { UUID } from 'node:crypto';
import type { RoleAccess } from '../enums/status.enum';

// DTO de usuário com base no modelo Usuario criador - Responsável pelas requisições
// Campos persistidos: nome (<=50), email (<=100), senha (será convertida para senhaHash), roleId (SmallInt)
export class TokenDto {
    @IsUUID()
    @IsNotEmpty()
    sub: UUID;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    name: string;

    @IsEmail()
    @IsNotEmpty()
    @MaxLength(100)
    email: string;

    @IsInt()
    @Min(1)
    access: RoleAccess;

    @IsUUID()
    @IsNotEmpty()
    clinicaId: UUID;

    @IsInt()
    iat: number;

    @IsInt()
    exp: number;

    @IsString()
    @IsNotEmpty()
    aud: string;

    @IsString()
    @IsNotEmpty()
    iss: string;
}
