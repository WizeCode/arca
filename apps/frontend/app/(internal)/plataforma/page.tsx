// Directives
'use client';

// Import Libs
import { useSession } from 'next-auth/react';

// Import Components
import { Skeleton } from '@/components/ui/skeleton';

const DashboardPage = () => {
    const { data: session } = useSession();
    const firstName = session?.user?.name?.split(' ')[0] ?? '';

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 mb-4">
                <h2 className="text-[24px] font-semibold">
                    Seja bem-vindo{firstName ? `, ${firstName}` : ''}! 👋
                </h2>
                <p className="text-(--color-medium) text-[14px]">
                    Apresentamos uma visão geral de tudo o que está acontecendo na clínica-escola.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card flex flex-col gap-2 rounded-xl border p-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
                    <Skeleton className="h-5 w-40" />

                    <div className="flex flex-col gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Skeleton className="shrink-0 size-8 rounded-full" />

                                <div className="flex-1 flex flex-col gap-2">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
                    <Skeleton className="h-5 w-40" />

                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Skeleton className="h-3 w-12 shrink-0" />
                                <Skeleton className="h-3 flex-1" />
                                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
