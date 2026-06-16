import { Suspense } from "react";

import { DataTableSkeleton } from "@/components/ui/data-table";

import WaitlistFilters from "./waitlist-filters";
import WaitlistTable from "./waitlist-table";

type SearchParams = Promise<{ page?: string; status?: string }>;

const ListaEsperaPage = async ({ searchParams }: { searchParams: SearchParams }) => {
    const { page, status } = await searchParams;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Lista de Espera</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Gerencie os pacientes inscritos na lista de espera.
                </p>
            </div>

            <WaitlistFilters />

            <Suspense
                key={`${page}-${status}`}
                fallback={<DataTableSkeleton columnCount={5} />}
            >
                <WaitlistTable
                    page={page ? Number(page) : 1}
                    status={status ? Number(status) : undefined}
                />
            </Suspense>
        </div>
    );
};

export default ListaEsperaPage;
