// Directives
"use client";

// Import CSS
import '../globals.css';

// Import Libs
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

// Import Components
import { ApplicationShell } from "@/components/layout/application";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="pt-br">
            <body cz-shortcut-listen="true" suppressHydrationWarning>
                <SessionProvider>
                    <NuqsAdapter>
                        <ApplicationShell>{children}</ApplicationShell>
                    </NuqsAdapter>
                </SessionProvider>
            </body>
        </html>
    );
};
