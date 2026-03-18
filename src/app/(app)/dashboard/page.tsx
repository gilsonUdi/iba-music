"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getEscalas, getMusicas, getAllMusicos, getNotificacoes, getPrestacaoControle } from "@/lib/firestore";
import { Calendar, Library, Users, Bell, ClipboardCheck, AlertCircle } from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import type { Escala, Notificacao } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ musicos: 0, musicas: 0, escalas: 0, notificacoes: 0 });
  const [proximaEscala, setProximaEscala] = useState<Escala | null>(null);
  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState<Notificacao[]>([]);
  const [prestacaoPendente, setPrestacaoPendente] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [escalas, musicas, musicos, notifs] = await Promise.all([
        getEscalas(user!.igrejaId),
        getMusicas(user!.igrejaId),
        !user!.roles?.includes("musico") ? getAllMusicos(user!.igrejaId) : Promise.resolve([]),
        getNotificacoes(user!.igrejaId),
      ]);

      const hoje = new Date();
      const proxima = escalas.find(e => isAfter(parseISO(e.data), hoje)) ?? escalas[0] ?? null;
      setProximaEscala(proxima);

      const naoLidas = notifs.filter(n => {
        const dest = n.destinatarios;
        const relevante = dest === "todos" || (Array.isArray(dest) && dest.includes(user!.uid));
        return relevante && !n.lidos.includes(user!.uid);
      });
      setNotificacoesNaoLidas(naoLidas);

      setStats({
        musicos: musicos.length,
        musicas: musicas.length,
        escalas: escalas.length,
        notificacoes: naoLidas.length,
      });

      // Checar prestação de contas pendente (para músicos e líderes de equipe)
      const deveResponder = (user!.roles?.includes("musico") || user!.roles?.includes("lider_equipe")) && !user!.roles?.includes("pastor") && !user!.roles?.includes("lider_celula");
      if (deveResponder) {
        const mes = format(hoje, "yyyy-MM");
        const controle = await getPrestacaoControle(mes);
        if (controle && !controle.responderam.includes(user!.uid)) {
          setPrestacaoPendente(true);
        }
      }
    }
    load();
  }, [user]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {user?.name.split(" ")[0]}!</h1>
        <p className="text-gray-500 mt-1">Aqui está o resumo do seu ministério</p>
      </div>

      {/* Alert: Prestação de Contas */}
      {prestacaoPendente && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">Prestação de contas pendente</p>
            <p className="text-sm text-amber-600 mt-0.5">Você ainda não respondeu o formulário deste mês. Prazo: dia 15.</p>
          </div>
          <Link href="/prestacao" className="text-sm font-medium text-amber-700 hover:text-amber-900 underline shrink-0">
            Responder
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {!user?.roles?.every(r => r === "musico") && (
          <Link href="/membros" className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users size={18} className="text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.musicos}</p>
            <p className="text-sm text-gray-500 mt-0.5">Músicos ativos</p>
          </Link>
        )}
        <Link href="/repertorio" className="card p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <Library size={18} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.musicas}</p>
          <p className="text-sm text-gray-500 mt-0.5">Músicas no repertório</p>
        </Link>
        <Link href="/escalas" className="card p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Calendar size={18} className="text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.escalas}</p>
          <p className="text-sm text-gray-500 mt-0.5">Escalas cadastradas</p>
        </Link>
        <Link href="/notificacoes" className="card p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
              <Bell size={18} className="text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.notificacoes}</p>
          <p className="text-sm text-gray-500 mt-0.5">Notificações não lidas</p>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Próxima Escala */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Próxima Escala</h2>
            <Link href="/escalas" className="text-sm text-primary-500 hover:text-primary-700">Ver todas</Link>
          </div>
          {proximaEscala ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-primary-500" />
                <span className="font-medium text-gray-800">
                  {format(parseISO(proximaEscala.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {proximaEscala.membros.map(m => (
                  <span key={m.uid} className={`badge ${m.confirmado === true ? "bg-green-100 text-green-700" : m.confirmado === false ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Nenhuma escala cadastrada</p>
          )}
        </div>

        {/* Notificações Recentes */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Notificações Recentes</h2>
            <Link href="/notificacoes" className="text-sm text-primary-500 hover:text-primary-700">Ver todas</Link>
          </div>
          {notificacoesNaoLidas.length > 0 ? (
            <ul className="space-y-2">
              {notificacoesNaoLidas.slice(0, 3).map(n => (
                <li key={n.id} className="flex items-start gap-3 p-3 bg-primary-50 rounded-xl">
                  <Bell size={14} className="text-primary-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{n.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.mensagem}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">Tudo em dia! Sem notificações pendentes.</p>
          )}
        </div>
      </div>

      {/* Atalhos */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/escalas", label: "Nova Escala", icon: Calendar, color: "bg-green-100 text-green-600" },
            { href: "/repertorio", label: "Adicionar Música", icon: Library, color: "bg-purple-100 text-purple-600" },
            { href: "/notificacoes", label: "Enviar Aviso", icon: Bell, color: "bg-orange-100 text-orange-600" },
            { href: "/prestacao", label: "Prestação de Contas", icon: ClipboardCheck, color: "bg-indigo-100 text-indigo-600" },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-50 transition-colors text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
