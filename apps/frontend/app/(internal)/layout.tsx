// Directives
"use client";

// Import CSS
import '../globals.css';

// Import Libs
import { SessionProvider } from "next-auth/react";

// Import Components
import { ApplicationShell } from "@/components/layout/application";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="pt-br">
            <body cz-shortcut-listen="true" suppressHydrationWarning>
                <SessionProvider>
                    <ApplicationShell>{children}</ApplicationShell>
                </SessionProvider>
            </body>
        </html>
    );
};
