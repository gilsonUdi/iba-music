"use client";

import { useEffect, useMemo, useState } from "react";
import { EsqueletoLista } from "@/components/ui/Esqueleto";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, History, PenLine } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { getEscalas, getMusicas } from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import type { Escala, Musica } from "@/lib/types";
import { diasSemTocar, rankingPeriodo, textoUltimaVez, usoDasMusicas } from "@/lib/estatisticas";

type Periodo = "mes" | "ano";

export default function RelatorioRepertorioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const [ano, setAno] = useState(format(new Date(), "yyyy"));
  const [diasX, setDiasX] = useState(60);

  useEffect(() => {
    if (!user) return;
    Promise.all([getEscalas(user.igrejaId), getMusicas()])
      .then(([e, m]) => { setEscalas(e); setMusicas(m.filter(x => x.ativo !== false)); })
      .catch(e => toast.error(mensagemErro(e, "Erro ao carregar o relatório")))
      .finally(() => setLoading(false));
  }, [user]);

  const [inicio, fim] = periodo === "mes" ? [`${mes}-01`, `${mes}-31`] : [`${ano}-01-01`, `${ano}-12-31`];
  const ranking = useMemo(() => rankingPeriodo(escalas, inicio, fim), [escalas, inicio, fim]);
  const uso = useMemo(() => usoDasMusicas(escalas), [escalas]);
  const maximo = ranking[0]?.vezes ?? 0;
  const cultos = escalas.filter(e => e.data.slice(0, 10) >= inicio && e.data.slice(0, 10) <= fim && e.data.slice(0, 10) <= format(new Date(), "yyyy-MM-dd")).length;

  const paradas = musicas
    .map(m => ({ m, dias: diasSemTocar(uso[m.id]) }))
    .filter(x => x.dias === undefined || x.dias >= diasX)
    .sort((a, b) => (b.dias ?? 1e9) - (a.dias ?? 1e9));

  const anos = Array.from(new Set([format(new Date(), "yyyy"), ...escalas.map(e => e.data.slice(0, 4))])).sort().reverse();
  const tituloDe = (musicaId?: string, titulo?: string) => musicas.find(m => m.id === musicaId)?.titulo || titulo || "(música removida)";

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/repertorio")} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl" aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={24} className="text-primary-500" /> Relatório do repertório
        </h1>
      </div>

      {loading ? (
        <EsqueletoLista />
      ) : (
        <>
          {/* Mais tocadas */}
          <section className="card p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-gray-900 flex-1">Mais tocadas</h2>
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                {(["mes", "ano"] as Periodo[]).map(p => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium", periodo === p ? "bg-white shadow text-gray-900" : "text-gray-500")}>
                    {p === "mes" ? "Mês" : "Ano"}
                  </button>
                ))}
              </div>
              {periodo === "mes" ? (
                <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} className="input py-1.5 w-auto text-sm" />
              ) : (
                <select value={ano} onChange={e => setAno(e.target.value)} className="input py-1.5 w-auto text-sm">
                  {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {periodo === "mes" ? format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR }) : ano}
              {" · "}{cultos} culto{cultos !== 1 ? "s" : ""} realizado{cultos !== 1 ? "s" : ""} · {ranking.length} música{ranking.length !== 1 ? "s" : ""} diferentes
            </p>

            {ranking.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Nenhuma música tocada neste período.</p>
            ) : (
              <ol className="space-y-2">
                {ranking.map((r, i) => (
                  <li key={r.chave} className="flex items-center gap-3">
                    <span className="w-6 text-right text-xs font-bold text-gray-400 tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        {r.musicaId ? (
                          <Link href={`/repertorio/${r.musicaId}`} className="text-sm font-medium text-gray-800 truncate hover:text-primary-600">
                            {tituloDe(r.musicaId, r.titulo)}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
                            <PenLine size={11} className="text-amber-500" /> {r.titulo}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 tabular-nums shrink-0">{r.vezes}x</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary-400 rounded-full" style={{ width: `${(r.vezes / maximo) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Paradas há X dias */}
          <section className="card p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-gray-900 flex items-center gap-1.5 flex-1">
                <History size={16} className="text-amber-500" /> Sem tocar há
              </h2>
              <input type="number" min={1} value={diasX} onChange={e => setDiasX(Math.max(1, Number(e.target.value) || 1))}
                className="input w-20 py-1.5 text-center text-sm" />
              <span className="text-sm text-gray-500">dias ou mais</span>
            </div>
            <p className="text-xs text-gray-500">{paradas.length} música{paradas.length !== 1 ? "s" : ""} — boas opções para diversificar o repertório.</p>
            {paradas.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Todas as músicas foram tocadas nesse intervalo.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {paradas.map(({ m, dias }) => (
                  <Link key={m.id} href={`/repertorio/${m.id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-1">
                    <span className="badge bg-primary-50 text-primary-600 font-bold">{m.tom}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.titulo}</p>
                      <p className="text-xs text-gray-400 truncate">{m.artista}</p>
                    </div>
                    <span className={clsx("text-xs shrink-0", dias === undefined ? "text-gray-400" : "text-amber-600")}>
                      {textoUltimaVez(dias)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
