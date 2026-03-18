"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import {
  Music2, LayoutDashboard, Users, Calendar, Library,
  Bell, ClipboardCheck, LogOut, Users2, Building2,
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

  // Mobile: mostra os 4 primeiros + "Mais" se tiver mais de 4
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
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 shrink-0">
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
              <Music2 size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">IBA</p>
              <p className="text-xs text-gray-400 mt-0.5">Music</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1">
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-primary-500 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <div className="flex items-center gap-3 px-3 mb-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-semibold text-sm">{user.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-400">{primaryRoleLabel(user.roles)}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
              <Music2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">IBA Music</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-semibold text-xs">{user.name[0]}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-area-inset-bottom">
          <div className="flex items-center justify-around px-2 py-1">
            {mobileMain.map(({ href, shortLabel, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-0"
                >
                  <div className={clsx(
                    "w-10 h-7 flex items-center justify-center rounded-xl transition-all",
                    active ? "bg-primary-500" : "bg-transparent"
                  )}>
                    <Icon size={18} className={active ? "text-white" : "text-gray-400"} />
                  </div>
                  <span className={clsx(
                    "text-[10px] font-medium truncate max-w-[52px]",
                    active ? "text-primary-600" : "text-gray-400"
                  )}>
                    {shortLabel}
                  </span>
                </Link>
              );
            })}

            {/* Botão "Mais" */}
            {hasMore && (
              <button
                onClick={() => setMoreOpen(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-0"
              >
                <div className={clsx(
                  "w-10 h-7 flex items-center justify-center rounded-xl transition-all",
                  mobileMore.some(i => pathname === i.href || pathname.startsWith(i.href + "/"))
                    ? "bg-primary-500" : "bg-transparent"
                )}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={mobileMore.some(i => pathname === i.href || pathname.startsWith(i.href + "/"))
                      ? "text-white" : "text-gray-400"}>
                    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <span className={clsx(
                  "text-[10px] font-medium",
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
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
              <div className="space-y-1">
                {mobileMore.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={clsx(
                        "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all",
                        active ? "bg-primary-500 text-white" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Icon size={20} />
                      {label}
                    </Link>
                  );
                })}
                <div className="border-t border-gray-100 mt-3 pt-3">
                  <div className="flex items-center gap-3 px-4 py-2 mb-2">
                    <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-semibold">{user.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-400">{primaryRoleLabel(user.roles)}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                  >
                    <LogOut size={18} />
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
