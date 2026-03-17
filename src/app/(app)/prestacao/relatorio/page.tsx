"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAllRespostasByMes, getRespostasByLider, getAllMusicos,
  getMusicosByLider, getPrestacaoControle, initPrestacaoControle,
  getPrestacaoPerguntas,
} from "@/lib/firestore";
import type { AppUser, PrestacaoPergunta, PrestacaoResposta } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, ChevronLeft, Eye, EyeOff, AlertCircle, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export default function RelatorioPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mesAtual, setMesAtual] = useState(format(new Date(), "yyyy-MM"));

  const [musicos, setMusicos] = useState<AppUser[]>([]);
  const [respostas, setRespostas] = useState<PrestacaoResposta[]>([]);
  const [perguntas, setPerguntas] = useState<PrestacaoPergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [totalMusicos, setTotalMusicos] = useState(0);

  useEffect(() => {
    if (user && !user.roles?.includes("pastor") && !user.roles?.includes("lider_celula") && !user.roles?.includes("lider_equipe")) {
      router.replace("/prestacao");
    }
  }, [user]);

  useEffect(() => {
    if (!user || (!user.roles?.includes("pastor") && !user.roles?.includes("lider_celula") && !user.roles?.includes("lider_equipe"))) return;
    load();
  }, [user, mesAtual]);

  async function load() {
    setLoading(true);
    try {
      const [perg, resp, mus] = await Promise.all([
        getPrestacaoPerguntas(),
        user!.roles?.includes("pastor")
          ? getAllRespostasByMes(mesAtual)
          : getRespostasByLider(user!.uid, mesAtual),
        user!.roles?.includes("pastor")
          ? getAllMusicos()
          : getMusicosByLider(user!.uid),
      ]);

      setPerguntas(perg);
      setRespostas(resp);
      setMusicos(mus);
      setTotalMusicos(mus.length);

      // Garantir controle criado
      let controle = await getPrestacaoControle(mesAtual);
      if (!controle) {
        await initPrestacaoControle(mesAtual, mus.length);
        controle = await getPrestacaoControle(mesAtual);
      }
    } finally {
      setLoading(false);
    }
  }

  const responderam = musicos.filter(m => respostas.some(r => r.uid === m.uid));
  const naoResponderam = musicos.filter(m => !respostas.some(r => r.uid === m.uid));
  const taxaResposta = totalMusicos > 0 ? Math.round((responderam.length / totalMusicos) * 100) : 0;

  const prazo = `${mesAtual}-15`;
  const prazoPassou = new Date() > parseISO(prazo);

  // Meses disponíveis (últimos 6)
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, "yyyy-MM");
  });

  if (!user?.roles?.includes("pastor") && !user?.roles?.includes("lider_celula") && !user?.roles?.includes("lider_equipe")) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/prestacao" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4">
          <ChevronLeft size={14} /> Prestação de contas
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatório de Respostas</h1>
            <p className="text-gray-500 mt-1 capitalize">
              {format(parseISO(`${mesAtual}-01`), "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <select
            value={mesAtual}
            onChange={e => setMesAtual(e.target.value)}
            className="input w-auto text-sm"
          >
            {meses.map(m => (
              <option key={m} value={m}>
                {format(parseISO(`${m}-01`), "MMM/yyyy", { locale: ptBR })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{responderam.length}</p>
          <p className="text-sm text-gray-500 mt-1">Responderam</p>
        </div>
        <div className="card p-5 text-center">
          <p className={clsx("text-3xl font-bold", naoResponderam.length > 0 && prazoPassou ? "text-red-600" : "text-amber-600")}>
            {naoResponderam.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Pendentes</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-primary-600">{taxaResposta}%</p>
          <p className="text-sm text-gray-500 mt-1">Taxa de resposta</p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="card p-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Progresso do mês</span>
          <span className="text-gray-500">{responderam.length} de {totalMusicos}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx("h-full rounded-full transition-all", taxaResposta === 100 ? "bg-green-500" : "bg-primary-500")}
            style={{ width: `${taxaResposta}%` }}
          />
        </div>
        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
          <AlertCircle size={14} className={prazoPassou && naoResponderam.length > 0 ? "text-red-500" : "text-amber-500"} />
          Prazo: {format(parseISO(prazo), "dd/MM/yyyy")}
          {prazoPassou && naoResponderam.length > 0 && (
            <span className="text-red-600 font-medium">— prazo encerrado!</span>
          )}
        </div>
      </div>

      {/* Quem não respondeu */}
      {naoResponderam.length > 0 && (
        <div className="card overflow-hidden">
          <div className={clsx("px-5 py-4 border-b border-gray-100 flex items-center gap-2", prazoPassou ? "bg-red-50" : "bg-amber-50")}>
            <XCircle size={16} className={prazoPassou ? "text-red-500" : "text-amber-500"} />
            <h2 className={clsx("font-semibold", prazoPassou ? "text-red-700" : "text-amber-700")}>
              Ainda não responderam ({naoResponderam.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {naoResponderam.map(m => (
              <div key={m.uid} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-gray-500 text-xs font-bold">{m.name[0]}</span>
                </div>
                <p className="font-medium text-gray-800">{m.name}</p>
                <span className="ml-auto badge bg-amber-100 text-amber-700">Pendente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Respostas */}
      {responderam.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 bg-green-50">
            <CheckCircle2 size={16} className="text-green-500" />
            <h2 className="font-semibold text-green-700">Responderam ({responderam.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {responderam.map(m => {
              const resp = respostas.find(r => r.uid === m.uid)!;
              const isExpanded = expanded === m.uid;

              return (
                <div key={m.uid}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : m.uid)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-green-700 text-xs font-bold">{m.name[0]}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-400">
                        Enviado em {format(resp.enviadoEm, "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                    <span className="badge bg-green-100 text-green-700 mr-2">Respondido</span>
                    {isExpanded ? <EyeOff size={15} className="text-gray-400" /> : <Eye size={15} className="text-gray-400" />}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 bg-gray-50 border-t border-gray-100">
                      <div className="mt-1 p-3 bg-amber-50 rounded-xl border border-amber-100 mb-4">
                        <p className="text-xs text-amber-700 flex items-center gap-1">
                          <AlertCircle size={11} />
                          Conteúdo confidencial — visível apenas para você e o músico.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {perguntas.map(p => {
                          const valor = resp.respostas[p.id];
                          return (
                            <div key={p.id}>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{p.texto}</p>
                              <p className="text-sm text-gray-800 bg-white rounded-xl px-4 py-3 border border-gray-100">
                                {Array.isArray(valor) ? valor.join(", ") : String(valor ?? "—")}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      )}
    </div>
  );
}
