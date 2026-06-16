"use client";

import { parseAsInteger, useQueryStates } from "nuqs";

const FILTROS = [
    { label: "Todos",            value: null },
    { label: "Em Espera",        value: 1 },
    { label: "Em Triagem",       value: 2 },
    { label: "Triagem Aprovada", value: 3 },
    { label: "Em Psicoterapia",  value: 4 },
    { label: "Recebeu Alta",     value: 5 },
    { label: "Encaminhado",      value: 6 },
    { label: "Desativado",       value: 7 },
];

const WaitlistFilters = () => {
    const [query, setQuery] = useQueryStates(
        {
            status: parseAsInteger,
            page: parseAsInteger.withDefault(1),
        },
        { shallow: false }
    );

    const handleStatus = (value: number | null) => {
        setQuery({ status: value, page: 1 });
    };

    return (
        <div className="flex flex-wrap gap-2">
            {FILTROS.map((filtro) => {
                const ativo = query.status === filtro.value;
                return (
                    <button
                        key={filtro.value ?? "todos"}
                        onClick={() => handleStatus(filtro.value)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            ativo
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }`}
                    >
                        {filtro.label}
                    </button>
                );
            })}
        </div>
    );
};

export default WaitlistFilters;
