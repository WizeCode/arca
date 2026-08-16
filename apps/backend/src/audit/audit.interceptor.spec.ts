import { AuditInterceptor } from './audit.interceptor';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of } from 'rxjs';

describe('AuditInterceptor', () => {
    let interceptor: AuditInterceptor;
    const mockAuditService = { create: jest.fn() };

    function createMockContext(request: object, controllerName = 'UserController', handlerName = 'create') {
        return {
            switchToHttp: () => ({ getRequest: () => request }),
            getClass: () => ({ name: controllerName }),
            getHandler: () => ({ name: handlerName }),
        } as unknown as ExecutionContext;
    }

    function createMockHandler(response: unknown = {}) {
        return { handle: () => of(response) } as CallHandler;
    }

    beforeEach(() => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        jest.clearAllMocks();
        mockAuditService.create.mockResolvedValue(undefined);
        interceptor = new AuditInterceptor(mockAuditService as any);
    });

    describe('Interceptor tests', () => {
        it('should pass through without logging when there is no authenticated user', async () => {
            const request = { user: {} };
            const context = createMockContext(request);
            const next = createMockHandler({ id_User: 'uuid-1' });

            await new Promise<void>((resolve) => {
                interceptor.intercept(context, next).subscribe({ complete: resolve });
            });
            expect(mockAuditService.create).not.toHaveBeenCalled();
        });

        it('should call auditService.create with correct data', async () => {
            const request = {
                user: { sub: 'uuid-1', name: 'Pedro' },
                ip: '127.0.0.1',
                method: 'POST',
                path: '/users',
                body: { nome: 'pedro' },
                params: {},
            };
            const context = createMockContext(request, 'UserController', 'create');
            const next = createMockHandler({ id_User: 'uuid-entity' });

            await new Promise<void>((resolve) => {
                interceptor.intercept(context, next).subscribe({ complete: resolve });
            });
            await Promise.resolve();

            expect(mockAuditService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    id_Usuario_Executor: 'uuid-1',
                    nome_Usuario_Executor: 'Pedro',
                    tipoAcao: 'create',
                    entidade_Afetada: 'User',
                }),
            );
        });

        it('should sanitaze the sensitive content of the log', async () => {
            const request = {
                user: { sub: 'uuid-1', name: 'Pedro' },
                ip: '127.0.0.1',
                method: 'POST',
                path: '/users',
                body: { nome: 'pedro', senha: '123456789' },
                params: {},
            };
            const context = createMockContext(request, 'UserController', 'create');
            const next = createMockHandler({ id_User: 'uuid-entity' });

            await new Promise<void>((resolve) => {
                interceptor.intercept(context, next).subscribe({ complete: resolve });
            });
            await Promise.resolve();

            expect(mockAuditService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    id_Usuario_Executor: 'uuid-1',
                    nome_Usuario_Executor: 'Pedro',
                    tipoAcao: 'create',
                    entidade_Afetada: 'User',
                    detalhes: {
                        path: '/users',
                        method: 'POST',
                        requestBody: expect.objectContaining({
                            nome: 'pedro',
                            senha: '********',
                        }),
                    },
                }),
            );
        });

        it('should not propagate error when auditService.create fails', async () => {
            const request = {
                user: { sub: 'uuid-1', name: 'Pedro' },
                ip: '127.0.0.1',
                method: 'POST',
                path: '/users',
                body: {},
                params: {},
            };
            const context = createMockContext(request);
            const next = createMockHandler({});

            mockAuditService.create.mockRejectedValue(new Error('DB error'));

            await new Promise<void>((resolve, reject) => {
                interceptor.intercept(context, next).subscribe({
                    complete: resolve,
                    error: reject,
                });
            });
            await Promise.resolve();

            expect(mockAuditService.create).toHaveBeenCalled();
        });
    });

    describe('Sanitize tests', () => {
        it('should sanitize sensitive fields', () => {
            const result = (interceptor as any).sanitizeBody({ nome: 'pedro', senha: '123' });
            expect(result).toEqual({ nome: 'pedro', senha: '********' });
        });

        it('should not sanitize if there is no sensitive field', () => {
            const result = (interceptor as any).sanitizeBody({ nome: 'pedro', email: 'test@email.com' });
            expect(result).toEqual({ nome: 'pedro', email: 'test@email.com' });
        });

        it('should return null if there is no body', () => {
            const result = (interceptor as any).sanitizeBody();
            expect(result).toBeUndefined();
        });

        it('should return body if body is not a object', () => {
            const result = (interceptor as any).sanitizeBody('string');
            expect(result).toBe('string');
        });

        it('should not mutate the original body', () => {
            const original = { nome: 'pedro', senha: '123' };

            (interceptor as any).sanitizeBody(original);

            expect(original.senha).toBe('123');
        });
    });
});
