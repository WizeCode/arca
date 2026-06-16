import type { PaginatedResponse, WaitlistEntry } from "./types";

const API_BASE_URL = process.env.API_URL || "http://localhost:3333";
const API_ENDPOINTS = {
    login: `${API_BASE_URL}/auth/login`,
    waitlist: `${API_BASE_URL}/waitlist`,
} as const;

export async function apiRequest(
    endpoint: string,
    options: RequestInit & { token?: string } = {}
) {
    const { token, ...fetchOptions } = options;

    const response = await fetch(endpoint, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...fetchOptions.headers,
        },
        ...fetchOptions,
    });

    if (!response.ok) {
        if (response.status === 429) {
            const error = new Error("Muitas tentativas. Aguarde um momento e tente novamente.") as Error & { status: number };
            error.status = 429;
            throw error;
        }

        let errorData;

        try {
            errorData = await response.json();
        } catch {
            errorData = { message: `HTTP ${response.status} - ${response.statusText}` };
        }

        const error = new Error(errorData.message || `Erro ${response.status}`) as Error & {
            status: number;
            userId?: string;
            userName?: string;
        };

        error.status = response.status;
        throw error;
    }

    return response.json();
};

export const apiService = {
    login: (credentials: { email: string; password: string }) =>
        apiRequest(API_ENDPOINTS.login, {
            method: "POST",
            body: JSON.stringify(credentials),
        }),

    waitlist: {
        create: (data: Record<string, unknown>) =>
            apiRequest(API_ENDPOINTS.waitlist, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        stats: () =>
            apiRequest(`${API_ENDPOINTS.waitlist}/stats`, {
                next: { revalidate: 60 },
            } as RequestInit) as Promise<{ qntFila: number; ultimaAtualizacao: string | null }>,
        findPublicPosition: (id: string) =>
            apiRequest(`${API_ENDPOINTS.waitlist}/${id}/position`, {
                cache: "no-store",
            } as RequestInit) as Promise<{
                id_Lista: string;
                nomeRegistro: string;
                nomeSocial: string | null;
                createdAt: string;
                id_Status: number;
                posicaoNaLista: number;
                situacao: "Ativo" | "Inativo";
            }>,

        findAll: (params: { page?: number; status?: number }, token: string) => {
            const qs = new URLSearchParams();
            if (params.page) qs.set("page", String(params.page));
            if (params.status !== undefined) qs.set("status", String(params.status));
            return apiRequest(`${API_ENDPOINTS.waitlist}?${qs}`, {
                token,
                cache: "no-store",
            } as RequestInit & { token: string }) as Promise<PaginatedResponse<WaitlistEntry>>;
        },
    },
};