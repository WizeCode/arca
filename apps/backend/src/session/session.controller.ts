import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TokenDto } from 'src/common/dto/token.dto';
import { UUID } from 'node:crypto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleAccess } from 'src/common/enums/status.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('Atendimentos')
@ApiBearerAuth()
@Controller('session')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionController {
    constructor(private readonly sessionService: SessionService) {}

    @ApiOperation({ summary: 'Agendar novo atendimento (Coordenador/Secretário)' })
    @ApiResponse({ status: 201, description: 'Atendimento agendado com sucesso.' })
    @ApiResponse({
        status: 400,
        description:
            'Dados inválidos: paciente sem status correto, conflito de horário, papéis inválidos ou datas incorretas.',
    })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Acesso negado. Somente Coordenadores e Secretários.' })
    @ApiResponse({ status: 404, description: 'Paciente, estagiário ou supervisor não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SECRETARIO)
    @Post()
    create(@Body() createSessionDto: CreateSessionDto) {
        return this.sessionService.create(createSessionDto);
    }

    @ApiOperation({ summary: 'Listar atendimentos (filtra por papel do usuário logado)' })
    @ApiResponse({ status: 200, description: 'Lista paginada de atendimentos.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @Get()
    findAll(@CurrentUser() user: TokenDto, @Query() pagination: PaginationDto) {
        return this.sessionService.findAll(user, pagination);
    }

    @ApiOperation({ summary: 'Listar pacientes sem atendimento ativo (Coordenador/Secretário)' })
    @ApiResponse({ status: 200, description: 'Lista de pacientes aguardando agendamento.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Acesso negado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SECRETARIO)
    @Get('no-session')
    findAllWithNoSession() {
        return this.sessionService.findAllWithNoSession();
    }

    @ApiOperation({ summary: 'Buscar atendimento por ID' })
    @ApiResponse({ status: 200, description: 'Atendimento encontrado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Sem permissão para visualizar este atendimento.' })
    @ApiResponse({ status: 404, description: 'Atendimento não encontrado.' })
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: UUID, @CurrentUser() user: TokenDto) {
        return this.sessionService.findOne(id, user);
    }

    @ApiOperation({ summary: 'Atualizar dados do atendimento (Coordenador/Secretário)' })
    @ApiResponse({ status: 200, description: 'Atendimento atualizado.' })
    @ApiResponse({ status: 400, description: 'Dados inválidos ou conflito de horário.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Acesso negado.' })
    @ApiResponse({ status: 404, description: 'Atendimento não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SECRETARIO)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: UUID, @Body() updateSessionDto: UpdateSessionDto) {
        return this.sessionService.update(id, updateSessionDto);
    }

    @ApiOperation({ summary: 'Cancelar atendimento (Coordenador/Secretário)' })
    @ApiResponse({ status: 200, description: 'Atendimento cancelado.' })
    @ApiResponse({ status: 400, description: 'Atendimento já cancelado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Acesso negado.' })
    @ApiResponse({ status: 404, description: 'Atendimento não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SECRETARIO)
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: UUID) {
        return this.sessionService.remove(id);
    }
}
