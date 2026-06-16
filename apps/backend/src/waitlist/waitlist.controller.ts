import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import { UUID } from 'node:crypto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { WaitlistQueryDto } from './dto/waitlist-query.dto';

@ApiTags('Lista de Espera')
@Controller('waitlist')
export class WaitlistController {
    constructor(private readonly waitlistService: WaitlistService) {}

    @ApiOperation({ summary: 'Cadastro público de paciente na lista de espera' })
    @ApiResponse({ status: 201, description: 'Paciente cadastrado. Retorna UUID para consulta de posição.' })
    @ApiResponse({ status: 400, description: 'CPF já cadastrado ou dados inválidos.' })
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @Post()
    create(@Body() body: CreateWaitlistDto) {
        return this.waitlistService.create(body);
    }

    @ApiOperation({ summary: 'Listar todos os pacientes da lista de espera (requer autenticação)' })
    @ApiResponse({ status: 200, description: 'Lista paginada de pacientes.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get()
    findAll(@Query() query: WaitlistQueryDto) {
        return this.waitlistService.findAll(query);
    }

    @ApiOperation({ summary: 'Estatísticas públicas da fila (quantidade e última atualização)' })
    @ApiResponse({ status: 200, description: 'Retorna { qntFila, ultimaAtualizacao }.' })
    @Throttle({ default: { ttl: 60_000, limit: 10 } })
    @Get('stats')
    findPositions() {
        return this.waitlistService.findPositions();
    }

    @ApiOperation({ summary: 'Consultar posição pública do paciente pelo UUID de cadastro' })
    @ApiResponse({ status: 200, description: 'Retorna posição na fila e dados básicos do paciente.' })
    @ApiResponse({ status: 404, description: 'Paciente não encontrado.' })
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @Get(':id/position')
    findPublicPosition(@Param('id', ParseUUIDPipe) id: UUID) {
        return this.waitlistService.findPublicPosition(id);
    }

    @ApiOperation({ summary: 'Buscar paciente por ID (requer autenticação)' })
    @ApiResponse({ status: 200, description: 'Paciente encontrado.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 404, description: 'Paciente não encontrado.' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: UUID) {
        return this.waitlistService.findOne(id);
    }

    @ApiOperation({ summary: 'Atualizar dados do paciente (requer autenticação)' })
    @ApiResponse({ status: 200, description: 'Paciente atualizado.' })
    @ApiResponse({ status: 400, description: 'Dados inválidos.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 404, description: 'Paciente não encontrado.' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: UUID, @Body() body: UpdateWaitlistDto) {
        return this.waitlistService.update(id, body);
    }

    @ApiOperation({ summary: 'Desativar paciente da lista (requer autenticação)' })
    @ApiResponse({ status: 200, description: 'Paciente desativado.' })
    @ApiResponse({ status: 400, description: 'Paciente não pode ser desativado no status atual.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 404, description: 'Paciente não encontrado.' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: UUID) {
        return this.waitlistService.remove(id);
    }
}
