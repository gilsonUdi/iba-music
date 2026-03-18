"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import {
  Music2, LayoutDashboard, Users, Calendar, Library,
  Bell, ClipboardCheck, LogOut, Users2, Building2, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { primaryRoleLabel } from "@/lib/types";
import { toast } from "sonner";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/igrejas",     label: "Igrejas",             shortLabel: "Igrejas",    icon: Building2,       roles: ["super_admin"] },
  { href: "/dashboard",   label: "Dashboard",           shortLabel: "Início",     icon: LayoutDashboard, roles: ["super_admin", "pastor", "lider_equipe", "lider_celula", "musico"] },
  { href: "/membros",     label: "Membros",             shortLabel: "Membros",    icon: Users,           roles: ["pastor", "lider_equipe"] },
  { href: "/equipes",     label: "Equipes",             shortLabel: "Equipes",    icon: Users2,          roles: ["pastor", "lider_equipe"] },
  { href: "/escalas",     label: "Escalas",             shortLabel: "Escalas",    icon: Calendar,        roles: ["pastor", "lider_equipe", "lider_celula", "musico"] },
  { href: "/repertorio",  label: "Repertório",          shortLabel: "Repertório", icon: Library,         roles: ["pastor", "lider_equipe", "lider_celula", "musico"] },
  { href: "/notificacoes",label: "Notificações",        shortLabel: "Avisos",     icon: Bell,            roles: ["pastor", "lider_equipe", "lider_celula", "musico"] },
  { href: "/prestacao",   label: "Prestação de Contas", shortLabel: "Prestação",  icon: ClipboardCheck,  roles: ["pastor", "lider_equipe", "lider_celula", "musico"] },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter(item =>
    user.roles.some(r => (item.roles as readonly string[]).includes(r))
  );

  const mobileMain = visibleItems.slice(0, 4);
  const mobileMore = visibleItems.slice(4);
  const hasMore = mobileMore.length > 0;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    toast.success("Até logo!");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0"
        style={{ background: "linear-gradient(160deg, #12082e 0%, #1e0a4a 60%, #180d3a 100%)" }}>
        <div className="flex flex-col h-full px-4 py-6">

          {/* Logo */}
          <div className="flex items-center gap-3 px-3 mb-8">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
              <Music2 size={20} className="text-white" />
            </div>
            <div>
              <p className="font-extrabold text-white text-base leading-none tracking-tight">IBA Music</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(196,181,253,0.7)" }}>
                {primaryRoleLabel(user.roles)}
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5">
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    active
                      ? "text-white shadow-lg"
                      : "text-purple-200/70 hover:text-white hover:bg-white/8"
                  )}
                  style={active ? {
                    background: "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(139,92,246,0.3))",
                    boxShadow: "0 2px 12px rgba(124,58,237,0.3)",
                    borderLeft: "3px solid #a78bfa",
                  } : undefined}
                >
                  <Icon size={18} className={active ? "text-violet-300" : ""} />
                  <span>{label}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-1"
              style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
                style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }}>
                {user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <p className="text-xs truncate" style={{ color: "rgba(196,181,253,0.6)" }}>
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200"
              style={{ color: "rgba(252,165,165,0.8)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <LogOut size={16} />
              Sair da conta
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: "linear-gradient(135deg, #12082e, #1e0a4a)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
              <Music2 size={15} className="text-white" />
            </div>
            <span className="font-extrabold text-white text-sm tracking-tight">IBA Music</span>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white"
            style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }}>
            {user.name[0]}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-28 md:pb-6">
          {children}
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-40"
          style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.10)", borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="flex items-center justify-around px-1 pt-2 pb-3">
            {mobileMain.map(({ href, shortLabel, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1 min-w-0 flex-1"
                >
                  <div className={clsx(
                    "w-12 h-8 flex items-center justify-center rounded-2xl transition-all duration-200",
                  )}
                    style={active ? {
                      background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                      boxShadow: "0 2px 10px rgba(124,58,237,0.4)",
                    } : undefined}>
                    <Icon size={18} className={active ? "text-white" : "text-gray-400"} />
                  </div>
                  <span className={clsx(
                    "text-[10px] font-semibold truncate max-w-[56px] text-center",
                    active ? "text-primary-600" : "text-gray-400"
                  )}>
                    {shortLabel}
                  </span>
                </Link>
              );
            })}

            {hasMore && (
              <button
                onClick={() => setMoreOpen(true)}
                className="flex flex-col items-center gap-1 min-w-0 flex-1"
              >
                <div className={clsx(
                  "w-12 h-8 flex items-center justify-center rounded-2xl transition-all duration-200",
                )}
                  style={mobileMore.some(i => pathname === i.href || pathname.startsWith(i.href + "/")) ? {
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    boxShadow: "0 2px 10px rgba(124,58,237,0.4)",
                  } : undefined}>
                  <ChevronUp size={18} className={
                    mobileMore.some(i => pathname === i.href || pathname.startsWith(i.href + "/"))
                      ? "text-white" : "text-gray-400"
                  } />
                </div>
                <span className={clsx(
                  "text-[10px] font-semibold",
                  mobileMore.some(i => pathname === i.href || pathname.startsWith(i.href + "/"))
                    ? "text-primary-600" : "text-gray-400"
                )}>
                  Mais
                </span>
              </button>
            )}
          </div>
        </nav>

        {/* More Sheet */}
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-10"
              style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

              {/* Header do sheet */}
              <div className="flex items-center gap-3 px-2 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }}>
                  {user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-400">{primaryRoleLabel(user.roles)}</p>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                {mobileMore.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={clsx(
                        "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all",
                        active ? "text-white" : "text-gray-700 hover:bg-gray-50"
                      )}
                      style={active ? {
                        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                        boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
                      } : undefined}
                    >
                      <Icon size={20} className={active ? "text-white" : "text-gray-400"} />
                      {label}
                    </Link>
                  );
                })}
              </div>

              <div style={{ borderTop: "1px solid #f3f4f6" }} className="pt-3">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                >
                  <LogOut size={18} />
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
