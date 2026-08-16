import { Controller, Post, UseGuards, Request, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { LocalAuthRequest } from './dto/local-auth-request.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @ApiOperation({ summary: 'Login com e-mail e senha' })
    @ApiBody({ type: LoginDto })
    @ApiResponse({ status: 200, description: 'Login realizado com sucesso. Retorna token JWT.' })
    @ApiResponse({ status: 401, description: 'Credenciais inválidas ou usuário inativo.' })
    @HttpCode(200)
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async loginWithPassport(@Request() req: LocalAuthRequest): Promise<AuthenticatedUserDto> {
        return this.authService.login(req.user);
    }
}
