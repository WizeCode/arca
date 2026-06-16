import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ApplicationShell } from "@/components/layout/plataforma/application-shell";

export default function PlataformaLayout({ children }: { children: React.ReactNode }) {
    return (
        <NuqsAdapter>
            <ApplicationShell>{children}</ApplicationShell>
        </NuqsAdapter>
    );
}
