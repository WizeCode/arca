import { getServerSession } from "next-auth";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { apiService } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import type { WaitlistEntry } from "@/lib/types";

const STATUS_CONFIG: Record<number, { label: string; className: string }> = {
    1: { label: "Em Espera",        className: "bg-blue-100 text-blue-700" },
    2: { label: "Em Triagem",       className: "bg-amber-100 text-amber-700" },
    3: { label: "Triagem Aprovada", className: "bg-green-100 text-green-700" },
    4: { label: "Em Psicoterapia",  className: "bg-purple-100 text-purple-700" },
    5: { label: "Recebeu Alta",     className: "bg-muted text-muted-foreground" },
    6: { label: "Encaminhado",      className: "bg-orange-100 text-orange-700" },
    7: { label: "Desativado",       className: "bg-red-100 text-red-700" },
};

const formatCPF = (cpf: string) =>
    cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(iso));

const columns: Column<WaitlistEntry>[] = [
    {
        key: "nome",
        header: "Nome",
        cell: (p) => p.nomeSocial ?? p.nomeRegistro,
    },
    {
        key: "cpf",
        header: "CPF",
        cell: (p) => formatCPF(p.CPF),
        className: "text-muted-foreground",
    },
    {
        key: "inscricao",
        header: "Inscrição",
        cell: (p) => formatDate(p.createdAt),
        className: "text-muted-foreground",
    },
    {
        key: "status",
        header: "Status",
        cell: (p) => {
            const config = STATUS_CONFIG[p.id_Status];
            return (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config?.className ?? ""}`}>
                    {config?.label ?? "—"}
                </span>
            );
        },
    },
];

type WaitlistTableProps = {
    page: number;
    status?: number;
};

const WaitlistTable = async ({ page, status }: WaitlistTableProps) => {
    const session = await getServerSession(authOptions);

    let data: WaitlistEntry[] = [];
    let totalPages = 1;
    let erro: string | null = null;

    try {
        const result = await apiService.waitlist.findAll({ page, status }, session!.token);
        data = result.data;
        totalPages = result.meta.totalPages;
    } catch (error) {
        const is429 = error instanceof Error && (error as Error & { status?: number }).status === 429;
        erro = is429
            ? "Muitas tentativas. Aguarde um momento antes de continuar."
            : "Não foi possível carregar a lista. Tente novamente.";
    }

    if (erro) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {erro}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <DataTable
                columns={columns}
                data={data}
                getRowKey={(row) => row.id_Lista}
                emptyMessage="Nenhum paciente encontrado na lista de espera."
            />
            <Pagination totalPages={totalPages} />
        </div>
    );
};

export default WaitlistTable;
