import "./globals.css";

import Link from "next/link";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

import { SearchX } from "lucide-react";

const NotFound = () => {
  return (
    <>
      <header className="m-4!">
        <Header />
      </header>

      <main className="m-4!">
        <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
          <div className="size-16 rounded-full bg-(--color-mlight)/30 flex items-center justify-center">
            <SearchX size={28} className="text-(--color-mdark)" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-6xl font-bold text-(--color-dark)">404</h1>
            <p className="text-lg font-medium text-(--color-dark)">
              Página não encontrada
            </p>
            <p className="text-sm text-(--color-mdark) max-w-sm">
              O endereço que você tentou acessar não existe ou foi movido.
            </p>
          </div>

          <Button asChild variant="primary">
            <Link href="/">Voltar ao início</Link>
          </Button>
        </div>
      </main>

      <footer className="m-4!">
        <Footer />
      </footer>
    </>
  );
};

export default NotFound;
