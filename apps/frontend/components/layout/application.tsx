// Directives
"use client";

// Import Libs
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Role } from "@/lib/roles";
import { useRole } from "@/hooks/use-role";

// Import Components
import {
    Avatar,
    AvatarFallback
} from "@/components/ui/avatar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage
} from "@/components/ui/breadcrumb";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    ScrollArea
} from "@/components/ui/scroll-area";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger
} from "@/components/ui/sidebar";

// Import Icons
import {
    Brain,
    CalendarDays,
    ChevronRight,
    ChevronsUpDown,
    ClipboardList,
    FileText,
    GitBranch,
    LayoutDashboard,
    ListChecks,
    LogOut,
    ShieldCheck,
    User,
    Users,
} from "lucide-react";

type NavItem = {
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    href: string;
    children?: NavItem[];
    roles?: number[];
};

type NavGroup = {
    title: string;
    items: NavItem[];
    defaultOpen?: boolean;
    roles?: number[];
};

const navGroups: NavGroup[] = [
    {
        title: "Visão Geral",
        defaultOpen: true,
        items: [
            {
                label: "Dashboard",
                icon: LayoutDashboard,
                href: "/plataforma"
            },
        ],
    },
    {
        title: "Atendimento",
        defaultOpen: true,
        items: [
            {
                label: "Agenda",
                icon: CalendarDays,
                href: "/plataforma/agenda" },
            {
                label: "Lista de Espera",
                icon: ListChecks,
                href: "/plataforma/lista-espera",
            },
            {
                label: "Atendimentos",
                icon: ClipboardList,
                href: "/plataforma/atendimentos",
            },
            {
                label: "Fluxo de Atendimento",
                icon: GitBranch,
                href: "/plataforma/fluxo-atendimento",
                roles: [Role.ADMIN, Role.SECRETARIO],
            },
        ],
    },
    {
        title: "Pacientes",
        defaultOpen: true,
        items: [
            {
                label: "Pacientes",
                icon: Users,
                href: "/plataforma/pacientes"
            },
            {
                label: "Relatórios",
                icon: FileText,
                href: "/plataforma/relatorios"
            },
        ],
    },
    {
        title: "Administração",
        defaultOpen: false,
        roles: [Role.ADMIN],
        items: [
            {
                label: "Usuários",
                icon: User,
                href: "/plataforma/usuarios"
            },
            {
                label: "Auditoria",
                icon: ShieldCheck,
                href: "/plataforma/auditoria"
            },
        ],
    },
];

const SidebarLogo = () => (
    <SidebarMenu>
        <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
                <Link href="/plataforma">
                    <div className="bg-primary flex justify-center items-center size-8 aspect-square rounded-sm">
                        <Brain size={24} color="#FFFFFF" />
                    </div>

                    <div className="flex flex-col gap-1 leading-none">
                        <span className="text-[14px] font-semibold truncate">ARCA</span>
                        <span className="text-[12px] text-muted-foreground truncate">
                            Clínica-Escola de Psicologia
                        </span>
                    </div>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    </SidebarMenu>
);

const NavMenuItem = ({ item }: { item: NavItem }) => {
    const pathname = usePathname();
    const isActive = pathname === item.href;
    const hasChildren = item.children && item.children.length > 0;
    const Icon = item.icon;

    if (!hasChildren) {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.href}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    return (
        <Collapsible className="group/collapsible" asChild defaultOpen>
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isActive}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>

                        <ChevronRight size={16} className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <SidebarMenuSub>
                        {item.children!.map((child) => (
                            <SidebarMenuSubItem key={child.label}>
                                <SidebarMenuSubButton
                                    isActive={pathname === child.href}
                                    asChild
                                >
                                    <Link href={child.href}>{child.label}</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
};

const NavUser = () => {
    const { data: session } = useSession();
    const name = session?.user?.name ?? "Usuário";
    const email = session?.user?.email ?? "";
    const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                        >
                            <Avatar size="lg" className="rounded-lg">
                                <AvatarFallback className="rounded-lg">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 grid text-left">
                                <span className="text-[14px] font-medium truncate">{name}</span>
                                <span className="text-muted-foreground text-[12px] truncate">{email}</span>
                            </div>

                            <ChevronsUpDown size={16} className="ml-auto" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="bg-background w-(--radix-dropdown-menu-trigger-width) rounded-lg"
                        sideOffset={8}
                        side="bottom"
                        align="end"
                    >
                        <DropdownMenuLabel className="p-0">
                            <div className="flex items-center gap-2 px-1 py-1.5">
                                <Avatar size="lg" className="rounded-lg">
                                    <AvatarFallback className="rounded-lg">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 flex flex-col gap-0.5 text-left text-sm leading-tight">
                                    <span className="text-primary text-[14px] font-medium truncate">{name}</span>
                                    <span className="text-muted-foreground text-[12px] truncate">{email}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        <div className="flex flex-col gap-1">
                            <DropdownMenuItem asChild>
                                <Link href="/plataforma/perfil" className="flex items-center gap-2 cursor-pointer">
                                    <User size={16} />Meu Perfil
                                </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => signOut({ callbackUrl: "/login" })}>
                                <LogOut size={16} />Sair
                            </DropdownMenuItem>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
};

const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
    const { canAccess } = useRole();

    const visibleGroups = navGroups
        .filter((g) => !g.roles || canAccess(...g.roles))
        .map((g) => ({
            ...g,
            items: g.items.filter((item) => !item.roles || canAccess(...item.roles)),
        }));

    return (
        <Sidebar {...props}>
            <SidebarHeader>
                <SidebarLogo />
            </SidebarHeader>

            <SidebarContent className="overflow-hidden">
                <ScrollArea className="flex-1 min-h-0">
                    {visibleGroups.map((group) => (
                        <SidebarGroup key={group.title}>
                            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>

                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {group.items.map((item) => (
                                        <NavMenuItem key={item.label} item={item} />
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ))}
                </ScrollArea>
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
};

interface ApplicationShellProps {
    children?: React.ReactNode;
    className?: string;
}

export function ApplicationShell({
    children,
    className,
}: ApplicationShellProps) {
    const pathname = usePathname();

    const currentLabel =
        navGroups
            .flatMap((g) => g.items)
            .find(
                (item) =>
                    item.href === pathname ||
                    item.children?.some((c) => c.href === pathname),
            )?.label ?? "Dashboard";

    return (
        <SidebarProvider className={cn(className)}>
            <AppSidebar />

            <SidebarInset>
                <header className="flex items-center gap-6 shrink-0 h-15 border-b px-4">
                    <SidebarTrigger />

                    <Link href="/plataforma" className="flex items-center gap-2 md:hidden" >
                        <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-primary">
                            <Brain size={16} color="#FFFFFF" />
                        </div>

                        <span className="font-semibold">ARCA</span>
                    </Link>
                    
                    <Breadcrumb className="hidden md:block">
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                <div className="flex-1 flex flex-col gap-4 p-4">
                    {children ?? (
                        <div className="bg-muted/50 flex-1 rounded-xl min-h-screen md:min-h-min" />
                    )}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
