// Directives
'use client';

// Import Libs
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { z } from 'zod';
import Link from 'next/link';

// Import Hooks
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Import Components
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel, } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

// Form Schema
const formLoginSchema = z.object({
    email: z
        .email({ message: "Insira um e-mail válido." })
        .min(1, { message: "O e-mail é obrigatório." }),
    password: z
        .string({ message: "A senha é obrigatória." })
        .min(6, { message: "A senha deve conter no mínimo 6 caracteres." })
})

const FormLogin = () => {
    // Router
    const router = useRouter();

    // Controllers
    const [isLoading, setIsLoading] = useState(false);

    // Form Resolver
    const form = useForm<z.infer<typeof formLoginSchema>>({
        resolver: zodResolver(formLoginSchema),
        defaultValues: {
            email: '',
            password: ''
        }
    });

    // Form Submit
    const onSubmit = async (data: z.infer<typeof formLoginSchema>) => {
        setIsLoading(true);

        const toastId = toast.loading("Carregando...", {
            description: "Verificando suas credenciais."
        });

        try {
            const response = await signIn("credentials", {
                email: data.email,
                password: data.password,
                redirect: false
            });

            if (response?.error) {
                toast.warning("Acesso Negado", {
                    id: toastId,
                    description: "E-mail ou senha incorretos."
                });

                return;
            }

            toast.success("Bem-vindo!", {
                id: toastId,
                description: "Redirecionando para a plataforma..."
            });

            router.push("/plataforma");
            router.refresh();
        } catch (error) {
            console.error("Erro de tentativa no login:", error);

            toast.error("Erro Inesperado", {
                id: toastId,
                description: "Por favor, tente novamente."
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <form id="form-login" className="w-full max-w-md" noValidate onSubmit={form.handleSubmit(onSubmit)}>
                <FieldGroup>
                    <Controller
                        name="email"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="form-login-email">Email</FieldLabel>

                                <Input {...field}
                                    id="form-login-email"
                                    type="email"
                                    placeholder="Digite seu e-mail"
                                    autoComplete="off"
                                    aria-describedby="email-error"
                                    aria-invalid={fieldState.invalid}
                                    disabled={isLoading}
                                />

                                {fieldState.invalid && ( <FieldError errors={[fieldState.error]} /> )}
                            </Field>
                        )}
                    />

                    <Controller
                        name="password"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <div className="flex justify-between items-center">
                                    <FieldLabel htmlFor="form-login-password">Senha</FieldLabel>

                                    <Link href="#" className="text-(--color-mdark) text-[14px] transition-colors duration-250 ease-in-out hover:text-(--color-dark)">
                                        Redefinir
                                    </Link>
                                </div>

                                <Input {...field}
                                    id="form-login-password"
                                    type="password"
                                    placeholder="Digite sua senha"
                                    autoComplete="off"
                                    aria-describedby="password-error"
                                    aria-invalid={fieldState.invalid}
                                    disabled={isLoading}
                                />

                                {fieldState.invalid && ( <FieldError errors={[fieldState.error]} /> )}
                            </Field>
                        )}
                    />
                    
                    <Field orientation="horizontal" className="mt-6!">
                        <Button size="lg" className="w-full" form="form-login" type="submit" disabled={isLoading}>
                            {isLoading ? "Carregando..." : "Entrar"}
                        </Button>
                    </Field>
                </FieldGroup>
            </form>
        </>
    );
};

export default FormLogin;