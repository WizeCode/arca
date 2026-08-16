import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseUUIDPipe, Put, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MedicalRecordService } from './medical_record.service';
import { CreateTriagemProntuarioDto } from './dto/create-triagem-medical_record.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UUID } from 'node:crypto';
import { TokenDto } from 'src/common/dto/token.dto';
import { CreateEvolucaoProntuarioDto } from './dto/create-evolucao-medical_record.dto';
import { ConteudoTriagemDto } from './dto/conteudo-triagem.dto';
import { ConteudoEvolucaoDto } from './dto/conteudo-evolucao.dto';
import { CreateEncaminhamentoDto } from './dto/create-encaminhamento.dto';
import { CreateAltaDto } from './dto/create-alta.dtos';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleAccess } from 'src/common/enums/status.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Response } from 'express';

@ApiTags('Prontuários')
@ApiBearerAuth()
@Controller('medical-record')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicalRecordController {
    constructor(private readonly medicalRecordService: MedicalRecordService) {}

    @ApiOperation({ summary: 'Criar prontuário de triagem (Coordenador/Supervisor/Estagiário)' })
    @ApiResponse({ status: 201, description: 'Prontuário de triagem criado.' })
    @ApiResponse({
        status: 400,
        description: 'Atendimento não é do tipo triagem, já concluído ou paciente sem status correto.',
    })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Usuário não é o responsável pelo atendimento.' })
    @ApiResponse({ status: 404, description: 'Atendimento não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SUPERVISOR, RoleAccess.ESTAGIARIO)
    @Post('triagem')
    create_triagem(@Body() CreateTriagemProntuarioDto: CreateTriagemProntuarioDto, @CurrentUser() user: TokenDto) {
        return this.medicalRecordService.createTriagem(CreateTriagemProntuarioDto, user);
    }

    @ApiOperation({ summary: 'Atualizar conteúdo do prontuário de triagem (Coordenador/Supervisor/Estagiário)' })
    @ApiResponse({ status: 200, description: 'Prontuário atualizado.' })
    @ApiResponse({ status: 400, description: 'Prontuário já aprovado ou atendimento inativo.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Usuário não é o responsável pelo atendimento.' })
    @ApiResponse({ status: 404, description: 'Prontuário não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SUPERVISOR, RoleAccess.ESTAGIARIO)
    @Put('triagem/:id')
    put_triagem(
        @Param('id', ParseUUIDPipe) id: UUID,
        @Body() ConteudoTriagemDto: ConteudoTriagemDto,
        @CurrentUser() user: TokenDto,
    ) {
        return this.medicalRecordService.putTriagem(id, ConteudoTriagemDto, user);
    }

    @ApiOperation({ summary: 'Aprovar prontuário de triagem e decidir encaminhamento (Coordenador/Supervisor)' })
    @ApiResponse({
        status: 200,
        description: 'Triagem aprovada. Paciente encaminhado para psicoterapia ou serviço externo.',
    })
    @ApiResponse({ status: 400, description: 'Prontuário já aprovado, ou encaminhado=true sem instituição informada.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Somente o supervisor responsável pode aprovar.' })
    @ApiResponse({ status: 404, description: 'Prontuário não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SUPERVISOR)
    @Patch('triagem/:id/approve')
    approve_triagem(
        @Param('id', ParseUUIDPipe) id: UUID,
        @Body() CreateEncaminhamentoDto: CreateEncaminhamentoDto,
        @CurrentUser() user: TokenDto,
    ) {
        return this.medicalRecordService.approveTriagem(id, CreateEncaminhamentoDto, user);
    }

    @ApiOperation({ summary: 'Criar prontuário de evolução de psicoterapia (Coordenador/Supervisor/Estagiário)' })
    @ApiResponse({ status: 201, description: 'Prontuário de evolução criado.' })
    @ApiResponse({
        status: 400,
        description: 'Atendimento não é do tipo psicoterapia, já concluído ou paciente sem status correto.',
    })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Usuário não é o responsável pelo atendimento.' })
    @ApiResponse({ status: 404, description: 'Atendimento não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SUPERVISOR, RoleAccess.ESTAGIARIO)
    @Post('psicoterapia')
    create_evolucao(@Body() CreateEvolucaoProntuarioDto: CreateEvolucaoProntuarioDto, @CurrentUser() user: TokenDto) {
        return this.medicalRecordService.createEvolucao(CreateEvolucaoProntuarioDto, user);
    }

    @ApiOperation({ summary: 'Atualizar conteúdo do prontuário de evolução (Coordenador/Supervisor/Estagiário)' })
    @ApiResponse({ status: 200, description: 'Prontuário de evolução atualizado.' })
    @ApiResponse({ status: 400, description: 'Prontuário já aprovado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Usuário não é o responsável pelo atendimento.' })
    @ApiResponse({ status: 404, description: 'Prontuário não encontrado.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SUPERVISOR, RoleAccess.ESTAGIARIO)
    @Put('psicoterapia/:id')
    put_evolucao(
        @Param('id', ParseUUIDPipe) id: UUID,
        @Body() ConteudoEvolucaoDto: ConteudoEvolucaoDto,
        @CurrentUser() user: TokenDto,
    ) {
        return this.medicalRecordService.putEvolucao(id, ConteudoEvolucaoDto, user);
    }

    @ApiOperation({ summary: 'Aprovar evolução e decidir alta ou encaminhamento (Coordenador/Supervisor)' })
    @ApiResponse({ status: 200, description: 'Evolução aprovada. Alta ou encaminhamento registrado.' })
    @ApiResponse({ status: 400, description: 'Prontuário já aprovado, ou combinação inválida de alta/encaminhamento.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Somente o supervisor responsável pode aprovar.' })
    @ApiResponse({ status: 404, description: 'Prontuário não encontrado.' })
    @ApiResponse({ status: 500, description: 'Falha na transação ao atualizar status do atendimento.' })
    @Roles(RoleAccess.ADMIN, RoleAccess.SUPERVISOR)
    @Patch('psicoterapia/:id/approve')
    approve_evolucao(
        @Param('id', ParseUUIDPipe) id: UUID,
        @Body() CreateAltaDto: CreateAltaDto,
        @CurrentUser() user: TokenDto,
    ) {
        return this.medicalRecordService.approveEvolucao(id, CreateAltaDto, user);
    }

    @ApiOperation({ summary: 'Gerar PDF do prontuário de triagem ou evolução' })
    @ApiResponse({ status: 200, description: 'PDF gerado e retornado como stream (application/pdf).' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Sem permissão para acessar este prontuário.' })
    @ApiResponse({ status: 404, description: 'Prontuário não encontrado.' })
    @Get('prontuarios/pdf/:id')
    generatePdf(@Param('id', ParseUUIDPipe) id: UUID, @CurrentUser() user: TokenDto, @Res() res: Response) {
        return this.medicalRecordService.generatePdf(id, user, res);
    }

    @ApiOperation({ summary: 'Gerar PDF do documento de alta' })
    @ApiResponse({ status: 200, description: 'PDF de alta gerado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 404, description: 'Prontuário de alta não encontrado.' })
    @Get('prontuarios/alta/pdf/:id')
    generateAltaPdf(@Param('id', ParseUUIDPipe) id: UUID, @CurrentUser() user: TokenDto, @Res() res: Response) {
        return this.medicalRecordService.generateAltaPdf(id, user, res);
    }

    @ApiOperation({ summary: 'Gerar PDF do documento de encaminhamento externo' })
    @ApiResponse({ status: 200, description: 'PDF de encaminhamento gerado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 404, description: 'Prontuário de encaminhamento não encontrado.' })
    @Get('prontuarios/encaminhamento/pdf/:id')
    generateEncaminhamentoPdf(
        @Param('id', ParseUUIDPipe) id: UUID,
        @CurrentUser() user: TokenDto,
        @Res() res: Response,
    ) {
        return this.medicalRecordService.generateEncaminhamentoPdf(id, user, res);
    }

    @ApiOperation({ summary: 'Listar prontuários (filtra por papel do usuário logado)' })
    @ApiResponse({ status: 200, description: 'Lista paginada de prontuários.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @Get('prontuarios')
    findAll(@CurrentUser() user: TokenDto, @Query() pagination: PaginationDto) {
        return this.medicalRecordService.findAll(user, pagination);
    }

    @ApiOperation({ summary: 'Buscar prontuário por ID' })
    @ApiResponse({ status: 200, description: 'Prontuário encontrado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Sem permissão para acessar este prontuário.' })
    @ApiResponse({ status: 404, description: 'Prontuário não encontrado.' })
    @Get('prontuarios/:id')
    findOne(@Param('id') id: UUID, @CurrentUser() user: TokenDto) {
        return this.medicalRecordService.findOne(id, user);
    }
}
