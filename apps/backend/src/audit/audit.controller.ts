import { Controller, UseGuards, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleAccess } from 'src/common/enums/status.enum';
import { AuditFilterDto } from './dto/audit-filter.dto';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
    constructor(private auditService: AuditService) {}

    @ApiOperation({ summary: 'Listar logs de auditoria (somente Coordenador)' })
    @ApiResponse({ status: 200, description: 'Lista paginada de logs retornada com sucesso.' })
    @ApiResponse({ status: 401, description: 'Não autenticado.' })
    @ApiResponse({ status: 403, description: 'Acesso negado. Somente Coordenadores têm acesso.' })
    @Roles(RoleAccess.ADMIN)
    @Get('/')
    async getAuditInfo(@Query() filter: AuditFilterDto) {
        return this.auditService.findAll(filter);
    }
}
