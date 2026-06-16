"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";

type PaginationProps = {
    totalPages: number;
};

export function Pagination({ totalPages }: PaginationProps) {
    const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: false }));

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
                Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded-md border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeftIcon className="size-4" />
                </button>
                <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-md border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRightIcon className="size-4" />
                </button>
            </div>
        </div>
    );
}
