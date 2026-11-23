"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, Users, Calendar, Library,
  Bell, ClipboardCheck, LogOut, Users2, Building2, LayoutGrid, Guitar,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { primaryRoleLabel } from "@/lib/types";
import Sheet from "@/components/ui/Sheet";

const NAV_ITEMS = [
  { href: "/igrejas",     label: "Igrejas",             shortLabel: "Igrejas",    icon: Building2,       roles: ["super_admin"] },
  { href: "/dashboard",   label: "Início",              shortLabel: "Início",     icon: LayoutDashboard, roles: ["super_admin", "pastor", "diretor_musical", "lider_equipe", "lider_celula", "musico"] },
  { href: "/cifras",      label: "Cifras",              shortLabel: "Cifras",     icon: Guitar,          roles: ["pastor", "diretor_musical", "lider_equipe", "lider_celula", "musico"] },
  { href: "/escalas",     label: "Escalas",             shortLabel: "Escalas",    icon: Calendar,        roles: ["pastor", "diretor_musical", "lider_equipe", "lider_celula", "musico"] },
  { href: "/repertorio",  label: "Repertório",          shortLabel: "Músicas",    icon: Library,         roles: ["pastor", "diretor_musical", "lider_equipe", "lider_celula", "musico"] },
  { href: "/equipes",     label: "Equipes",             shortLabel: "Equipes",    icon: Users2,          roles: ["pastor", "diretor_musical", "lider_equipe", "lider_celula", "musico"] },
  { href: "/membros",     label: "Membros",             shortLabel: "Membros",    icon: Users,           roles: ["pastor", "diretor_musical", "lider_equipe"] },
  { href: "/notificacoes",label: "Avisos",              shortLabel: "Avisos",     icon: Bell,            roles: ["pastor", "diretor_musical", "lider_equipe", "lider_celula", "musico"] },
  { href: "/prestacao",   label: "Prestação de Contas", shortLabel: "Prestação",  icon: ClipboardCheck,  roles: ["pastor", "diretor_musical", "lider_equipe", "lider_celula", "musico"] },
] as const;

function Avatar({ nome, size = 36 }: { nome: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold text-white ring-2 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.38, background: "linear-gradient(135deg, #8b5cf6, #c026d3)" }}
    >
      {nome[0]?.toUpperCase()}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (!loading && user?.senhaTemporaria && pathname !== "/alterar-senha") {
      router.replace("/alterar-senha");
    }
  }, [user, loading, router, pathname]);

  // Fecha o "Mais" ao navegar
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden animate-pulse-glow">
          <Image src="/logo.png" alt="IBA Music" width={56} height={56} className="object-cover w-full h-full" priority />
        </div>
        <p className="text-sm text-gray-400 animate-pulse">Afinando os instrumentos…</p>
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter(item =>
    user.roles.some(r => (item.roles as readonly string[]).includes(r))
  );
  const mobileMain = visibleItems.slice(0, 4);
  const mobileMore = visibleItems.slice(4);
  const ativo = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const maisAtivo = mobileMore.some(i => ativo(i.href));

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    toast.success("Até logo!");
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden print:block print:h-auto print:overflow-visible">

      {/* ── Menu lateral (desktop) ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/5 print:!hidden"
        style={{ background: "linear-gradient(180deg, rgba(20,12,44,0.85), rgba(11,7,24,0.9))", backdropFilter: "blur(16px)" }}>
        <div className="flex flex-col h-full px-3 py-6">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 mb-8 group">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-primary-500/40 group-hover:ring-primary-400 transition">
              <Image src="/logo.png" alt="IBA Music" width={40} height={40} className="object-cover w-full h-full" />
            </div>
            <div>
              <p className="font-extrabold text-base leading-none tracking-tight texto-neon" style={{ fontFamily: "Sora, Inter, sans-serif" }}>IBA Music</p>
              <p className="text-xs mt-1 text-gray-400">{primaryRoleLabel(user.roles)}</p>
            </div>
          </Link>

          <nav className="flex-1 space-y-1">
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const a = ativo(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    a ? "text-white" : "text-gray-500 hover:text-gray-900 hover:bg-white/5"
                  )}
                  style={a ? {
                    background: "linear-gradient(135deg, rgba(139,92,246,0.35), rgba(192,38,211,0.18))",
                    boxShadow: "inset 0 0 0 1px rgba(167,139,250,0.25), 0 8px 24px -10px rgba(124,58,237,0.6)",
                  } : undefined}
                >
                  {a && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary-400 shadow-glow" />}
                  <Icon size={18} className={a ? "text-primary-700" : ""} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-1 bg-white/[0.04]">
              <Avatar nome={user.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs truncate text-gray-400">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} /> Sair da conta
            </button>
          </div>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">

        {/* Cabeçalho (celular) */}
        <header className="md:hidden flex items-center justify-between px-4 pb-3 shrink-0 border-b border-white/5 print:!hidden"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", background: "rgba(11,7,24,0.75)", backdropFilter: "blur(16px)" }}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-2 ring-primary-500/40">
              <Image src="/logo.png" alt="IBA Music" width={32} height={32} className="object-cover w-full h-full" />
            </div>
            <span className="font-extrabold text-sm tracking-tight texto-neon" style={{ fontFamily: "Sora, Inter, sans-serif" }}>IBA Music</span>
          </Link>
          <button onClick={() => setMoreOpen(true)} aria-label="Abrir menu do perfil">
            <Avatar nome={user.name} size={32} />
          </button>
        </header>

        {/* Página */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-32 md:pb-8 print:p-0 print:overflow-visible">
          {children}
        </main>

        {/* ── Barra inferior (celular) ── */}
        <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 rounded-3xl border border-white/10 shadow-nav print:!hidden"
          style={{ background: "rgba(22,16,48,0.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", marginBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-center justify-around px-1 py-1.5">
            {mobileMain.map(({ href, shortLabel, icon: Icon }) => {
              const a = ativo(href);
              return (
                <Link key={href} href={href} className="flex flex-col items-center gap-0.5 min-w-0 flex-1 py-1">
                  <div className={clsx("w-12 h-8 flex items-center justify-center rounded-2xl transition-all duration-300",
                    a ? "scale-105" : "")}
                    style={a ? { background: "linear-gradient(135deg, #8b5cf6, #c026d3)", boxShadow: "0 6px 18px -4px rgba(139,92,246,0.7)" } : undefined}>
                    <Icon size={19} className={a ? "text-white" : "text-gray-400"} />
                  </div>
                  <span className={clsx("text-[10px] font-semibold truncate max-w-[60px] text-center transition-colors",
                    a ? "text-gray-900" : "text-gray-400")}>
                    {shortLabel}
                  </span>
                </Link>
              );
            })}
            <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 min-w-0 flex-1 py-1">
              <div className="w-12 h-8 flex items-center justify-center rounded-2xl transition-all"
                style={maisAtivo ? { background: "linear-gradient(135deg, #8b5cf6, #c026d3)" } : undefined}>
                <LayoutGrid size={19} className={maisAtivo ? "text-white" : "text-gray-400"} />
              </div>
              <span className={clsx("text-[10px] font-semibold", maisAtivo ? "text-gray-900" : "text-gray-400")}>Mais</span>
            </button>
          </div>
        </nav>

        {/* "Mais" (bottom sheet) */}
        <Sheet aberto={moreOpen} onFechar={() => setMoreOpen(false)} className="sm:max-w-sm">
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 px-1 py-3 mb-2">
              <Avatar nome={user.name} size={44} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-400">{primaryRoleLabel(user.roles)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {mobileMore.map(({ href, shortLabel, icon: Icon }) => {
                const a = ativo(href);
                return (
                  <Link key={href} href={href}
                    className={clsx("flex flex-col items-center gap-2 py-4 rounded-2xl text-xs font-semibold transition-all",
                      a ? "text-white" : "text-gray-700 bg-white/[0.04] hover:bg-white/[0.08]")}
                    style={a ? { background: "linear-gradient(135deg, #8b5cf6, #c026d3)" } : undefined}>
                    <Icon size={22} className={a ? "text-white" : "text-primary-600"} />
                    {shortLabel}
                  </Link>
                );
              })}
            </div>
            <button onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-colors">
              <LogOut size={18} /> Sair da conta
            </button>
          </div>
        </Sheet>
      </div>
    </div>
  );
}
