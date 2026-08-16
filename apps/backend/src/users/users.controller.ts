import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    ParseUUIDPipe,
    UseGuards,
    Put,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UUID } from 'node:crypto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TokenDto } from 'src/common/dto/token.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleAccess } from 'src/common/enums/status.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @ApiOperation({ summary: 'Criar novo usuário' })
    @ApiResponse({ status: 201, description: 'Usuário criado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Dados inválidos (ex: supervisor sem CRP, e-mail duplicado ativo).' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Sem permissão para criar usuário com este perfil.' })
    @ApiResponse({ status: 409, description: 'E-mail pertence a usuário inativo — reativação necessária.' })
    @Post()
    create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: TokenDto) {
        return this.usersService.create(createUserDto, user);
    }

    @ApiOperation({ summary: 'Listar usuários (paginado)' })
    @ApiResponse({ status: 200, description: 'Lista paginada de usuários.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @Get()
    findAll(@CurrentUser() user: TokenDto, @Query() pagination: PaginationDto) {
        return this.usersService.findAll(user, pagination);
    }

    @ApiOperation({ summary: 'Buscar usuário por ID' })
    @ApiResponse({ status: 200, description: 'Usuário encontrado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Sem permissão para visualizar este usuário.' })
    @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: UUID, @CurrentUser() user: TokenDto) {
        return this.usersService.findOne(id, user);
    }

    @ApiOperation({ summary: 'Atualizar dados do usuário' })
    @ApiResponse({ status: 200, description: 'Usuário atualizado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Dados inválidos.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Sem permissão para editar este usuário.' })
    @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
    @Put(':id')
    update(@Param('id', ParseUUIDPipe) id: UUID, @Body() updateUserDto: UpdateUserDto, @CurrentUser() user: TokenDto) {
        return this.usersService.update(id, updateUserDto, user);
    }

    @ApiOperation({ summary: 'Reativar usuário inativo (Coordenador/Secretário)' })
    @ApiResponse({ status: 204, description: 'Usuário reativado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Usuário já está ativo.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Acesso negado. Somente Coordenadores e Secretários.' })
    @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SECRETARIO)
    @Patch(':id/reactivate')
    @HttpCode(HttpStatus.NO_CONTENT)
    reactivate(@Param('id', ParseUUIDPipe) id: UUID, @CurrentUser() user: TokenDto) {
        return this.usersService.reactivate(id, user);
    }

    @ApiOperation({ summary: 'Desativar usuário (Coordenador/Secretário)' })
    @ApiResponse({ status: 204, description: 'Usuário desativado com sucesso.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Sem permissão para remover este usuário.' })
    @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SECRETARIO)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: UUID, @CurrentUser() user: TokenDto) {
        return this.usersService.remove(id, user);
    }
}
