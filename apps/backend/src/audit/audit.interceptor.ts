import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { Prisma } from '@prisma/client';
import type { TokenDto } from 'src/common/dto/token.dto';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditInterceptor.name);

    constructor(private readonly auditService: AuditService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<{
            user: TokenDto;
            ip: string;
            method: string;
            path: string;
            body: Record<string, unknown>;
            params: Record<string, string>;
        }>();
        const user = request.user;

        if (!user?.sub) {
            return next.handle();
        }

        return next.handle().pipe(
            tap((data) => {
                this.logAudit(context, request, data).catch((error: unknown) =>
                    this.logger.error(
                        'Falha ao salvar o log de auditoria',
                        error instanceof Error ? error.stack : error,
                    ),
                );
            }),
        );
    }

    private async logAudit(
        context: ExecutionContext,
        request: {
            ip: string;
            method: string;
            path: string;
            body: Record<string, unknown>;
            params: Record<string, string>;
            user: TokenDto;
        },
        data: unknown,
    ): Promise<void> {
        const { ip, method, path, body, params, user } = request;
        const controllerName = context.getClass().name;
        const methodName = context.getHandler().name;

        const entidade = controllerName.replace('Controller', '');
        const responseData = data as Record<string, unknown> | null | undefined;
        const idEntidade =
            params.id ??
            (responseData &&
                ((responseData.id_User as string) ||
                    (responseData.id_Lista as string) ||
                    (responseData.id_Atendimento as string) ||
                    (responseData.id_Registro as string)));

        await this.auditService.create({
            id_Usuario_Executor: user.sub,
            nome_Usuario_Executor: user.name,
            tipoAcao: methodName,
            entidade_Afetada: entidade,
            id_Entidade_Afetada: idEntidade || undefined,
            endereco_Ip: ip,
            detalhes: {
                path,
                method,
                requestBody: this.sanitizeBody(body) as Prisma.InputJsonValue,
            },
        });
    }

    private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
        if (!body || typeof body !== 'object') return body;

        const sanitizedBody = { ...body };
        const sensitiveKeys = ['senha', 'senhaHash', 'password', 'token'];

        for (const key of sensitiveKeys) {
            if (sanitizedBody[key]) {
                sanitizedBody[key] = '********';
            }
        }
        return sanitizedBody;
    }
}
