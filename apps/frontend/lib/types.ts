export type PaginatedResponse<T> = {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};

export type WaitlistEntry = {
    id_Lista: string;
    nomeRegistro: string;
    nomeSocial: string | null;
    CPF: string;
    dataNascimento: string;
    telefonePessoal: string;
    contatoEmergencia: string;
    enderecoRua: string;
    enderecoNumero: string;
    enderecoBairro: string;
    enderecoCidade: string;
    enderecoEstado: string;
    enderecoCEP: string;
    id_Genero: number;
    id_Etnia: number;
    id_Escolaridade: number;
    id_Status: number;
    createdAt: string;
    updatedAt: string;
};
