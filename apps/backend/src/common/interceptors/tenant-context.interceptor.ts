import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import type { TokenDto } from 'src/common/dto/token.dto';
import type { TenantClsStore } from 'src/prisma/tenant.extension';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
    constructor(private readonly cls: ClsService<TenantClsStore>) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<{ user?: TokenDto }>();
        const clinicaId = request.user?.clinicaId;

        if (clinicaId) {
            this.cls.set('clinicaId', clinicaId);
        }

        return next.handle();
    }
}
