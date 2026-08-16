import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
    let service: CryptoService;

    const VALID_KEY = 'a'.repeat(64);

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CryptoService,
                {
                    provide: ConfigService,
                    useValue: {
                        getOrThrow: jest.fn().mockReturnValue(VALID_KEY),
                    },
                },
            ],
        }).compile();

        service = module.get<CryptoService>(CryptoService);
    });

    it('deve estar definido', () => {
        expect(service).toBeDefined();
    });

    it('deve criptografar e descriptografar um objeto (roundtrip)', () => {
        const dados = { texto: 'conteúdo sensível', paciente: 'João' };

        const cifrado = service.encrypt(dados);
        const decifrado = service.decrypt(cifrado);

        expect(decifrado).toEqual(dados);
    });

    it('deve lançar erro ao descriptografar dado adulterado', () => {
        const cifrado = service.encrypt({ texto: 'original' });
        const adulterado = cifrado.replace(/.$/, 'X'); // muda o último caractere

        expect(() => service.decrypt(adulterado)).toThrow();
    });

    it('deve lançar erro se o formato for inválido (sem ":")', () => {
        expect(() => service.decrypt('dado-invalido-sem-separadores')).toThrow(
            'Formato de dado criptografado inválido.',
        );
    });

    it('deve lançar erro ao construir com chave de tamanho errado', async () => {
        await expect(
            Test.createTestingModule({
                providers: [
                    CryptoService,
                    {
                        provide: ConfigService,
                        useValue: { getOrThrow: jest.fn().mockReturnValue('chave-curta') },
                    },
                ],
            }).compile(),
        ).rejects.toThrow('ENCRYPTION_KEY deve ter exatamente 64 caracteres hex');
    });
});
