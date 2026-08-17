import { TenantContextInterceptor } from './tenant-context.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TenantContextInterceptor', () => {
    let interceptor: TenantContextInterceptor;
    const mockCls = { set: jest.fn(), get: jest.fn() };

    function createMockContext(request: object) {
        return {
            switchToHttp: () => ({ getRequest: () => request }),
        } as unknown as ExecutionContext;
    }

    function createMockHandler(response: unknown = {}) {
        return { handle: () => of(response) } as CallHandler;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        interceptor = new TenantContextInterceptor(mockCls as any);
    });

    it('sets clinicaId on the CLS context from the authenticated user', async () => {
        const request = { user: { sub: 'uuid-user', clinicaId: 'uuid-clinica' } };
        const context = createMockContext(request);
        const next = createMockHandler();

        await new Promise<void>((resolve) => {
            interceptor.intercept(context, next).subscribe({ complete: resolve });
        });

        expect(mockCls.set).toHaveBeenCalledWith('clinicaId', 'uuid-clinica');
    });

    it('does not touch the CLS context when there is no authenticated user', async () => {
        const request = {};
        const context = createMockContext(request);
        const next = createMockHandler();

        await new Promise<void>((resolve) => {
            interceptor.intercept(context, next).subscribe({ complete: resolve });
        });

        expect(mockCls.set).not.toHaveBeenCalled();
    });

    it('does not touch the CLS context when the user has no clinicaId', async () => {
        const request = { user: { sub: 'uuid-user' } };
        const context = createMockContext(request);
        const next = createMockHandler();

        await new Promise<void>((resolve) => {
            interceptor.intercept(context, next).subscribe({ complete: resolve });
        });

        expect(mockCls.set).not.toHaveBeenCalled();
    });

    it('lets the response pass through unchanged', async () => {
        const request = { user: { sub: 'uuid-user', clinicaId: 'uuid-clinica' } };
        const context = createMockContext(request);
        const next = createMockHandler({ id_User: 'uuid-entity' });

        const result = await new Promise<unknown>((resolve) => {
            interceptor.intercept(context, next).subscribe({ next: resolve });
        });

        expect(result).toEqual({ id_User: 'uuid-entity' });
    });
});
