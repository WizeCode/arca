// Directives
'use client';

// Import Libs
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { navLinksExternal } from '@/lib/navigation';
import Link from 'next/link';

// Imports Components
import { Button } from '@/components/ui/button';
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from '@/components/ui/navigation-menu';
import { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';

// Import Icons
import { Brain, LogIn, TextAlignJustify } from 'lucide-react';

const Header = () => {
    // Routes
    const pathname = usePathname();

    // OffCanvas Control
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setIsSheetOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <>
            <div className="bg-(--color-light) p-4! rounded-[20px] border border-(--color-mlight)/50">
                <div className="container mx-auto! flex justify-between items-center">
                    <div className="flex-1 flex justify-start">
                        <Link href="/" className="flex items-center gap-2">
                            <Brain size={36} color="#000000" />
                            <h1 className="font-bold text-(--color-dark) text-[18px]">ARCA</h1>
                        </Link>
                    </div>

                    <NavigationMenu className="flex-2 hidden justify-center lg:flex">
                        <NavigationMenuList>
                            {navLinksExternal.map((link) => {
                                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);

                                return (
                                    <NavigationMenuItem key={link.label}>
                                        <NavigationMenuLink className="bg-transparent! hover:bg-transparent!" asChild>
                                            <Link href={link.href} className={`${isActive ? 'font-bold' : 'font-normal'} text-(--color-dark) relative after:content-[''] after:absolute after:-bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-px after:w-0 after:bg-(--color-dark) after:transition-all after:duration-250 after:ease-in-out hover:after:w-full`}>{link.label}</Link>
                                        </NavigationMenuLink>
                                    </NavigationMenuItem>
                                );
                            })}
                        </NavigationMenuList>
                    </NavigationMenu>

                    <div className="flex-1 hidden justify-end lg:flex">
                        <Button size="lg" asChild>
                            <Link href='/login'>
                                <LogIn color="#FFFFFF" />Acesso Interno
                            </Link>
                        </Button>
                    </div>

                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild className="flex lg:hidden">
                            <TextAlignJustify size={20} color="#000000" className="cursor-pointer" />
                        </SheetTrigger>

                        <SheetContent className="bg-(--color-light) px-4! py-4!">
                            <SheetHeader>
                                <SheetTitle className="font-bold text-(--color-dark)">MENU</SheetTitle>
                                <SheetDescription className="sr-only">
                                    Menu principal de navegação.
                                </SheetDescription>
                            </SheetHeader>

                            <nav className="flex-1 flex flex-col items-start gap-4">
                                {navLinksExternal.map((link) => {
                                    const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                                    
                                    return (
                                        <SheetClose asChild key={link.href}>
                                            <Link href={link.href} className={`${isActive ? 'font-bold' : 'font-normal'} text-(--color-dark)`}>{link.label}</Link>
                                        </SheetClose>
                                    );
                                })}
                            </nav>

                            <SheetFooter>
                                <Button size="lg" asChild>
                                    <Link href="/login">
                                        <LogIn color="#FFFFFF" />Acesso Interno
                                    </Link>
                                </Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </>
    )
};

export default Header;