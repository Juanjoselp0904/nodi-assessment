import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nodi — AI Interview Platform",
  description: "Adaptive voice interviews for tech candidates",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-gray-900 bg-gray-950/80 backdrop-blur-sm">
          <Link href="/" className="text-lg font-bold tracking-tight text-white hover:text-indigo-400 transition-colors">
            Nodi
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/candidate/intake" className="text-sm text-gray-400 hover:text-white transition-colors">
              Candidato
            </Link>
            <Link href="/recruiter" className="text-sm text-gray-400 hover:text-white transition-colors">
              Reclutador
            </Link>
          </div>
        </header>
        <div className="pt-12">
          {children}
        </div>
      </body>
    </html>
  );
}
