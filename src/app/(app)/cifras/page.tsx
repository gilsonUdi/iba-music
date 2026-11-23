"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Guitar, Search, Maximize2, ChevronRight, X, Users2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { getEquipes, getCifrasDaEquipe, getMusicas, getEscalas } from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import { normalizarTitulo, formatarTom } from "@/lib/cifra";
import { CULTO_LABELS, itensDoSetlist, type Cifra, type Equipe, type Escala, type Musica } from "@/lib/types";
import { corVisivel } from "@/lib/cores";
import { EsqueletoLista } from "@/components/ui/Esqueleto";

interface Linha { cifra: Cifra; musica?: Musica; equipe?: Equipe }

/** Acesso rápido às cifras para usar no ensaio e no culto. */
export default function CifrasPage() {
  const { user } = useAuth();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [proximo, setProximo] = useState<Escala | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [equipeSel, setEquipeSel] = useState<string>("todas");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const verTodas = user.roles.some(r => ["super_admin", "pastor", "diretor_musical"].includes(r));
        const [todas, musicas, escalas] = await Promise.all([
          getEquipes(user.igrejaId), getMusicas(), getEscalas(user.igrejaId),
        ]);
        const minhas = (verTodas ? todas : todas.filter(e => e.membros.includes(user.uid) || e.liderId === user.uid))
          .filter(e => e.ativo !== false);
        setEquipes(minhas);
        const listas = await Promise.all(minhas.map(e => getCifrasDaEquipe(e.id, user.igrejaId)));
        const todasLinhas = listas.flat().map(c => ({
          cifra: c,
          musica: musicas.find(m => m.id === c.musicaId),
          equipe: minhas.find(e => e.id === c.equipeId),
        })).filter(l => l.musica?.ativo !== false)
          .sort((a, b) => (a.musica?.titulo ?? "").localeCompare(b.musica?.titulo ?? "", "pt-BR"));
        setLinhas(todasLinhas);

        // Próximo culto: primeiro em que estou escalado; senão o próximo das minhas equipes
        const hoje = format(new Date(), "yyyy-MM-dd");
        const futuras = escalas.filter(e => e.data.slice(0, 10) >= hoje && itensDoSetlist(e).length)
          .sort((a, b) => a.data.localeCompare(b.data));
        setProximo(
          futuras.find(e => e.membros.some(m => m.uid === user.uid))
          ?? futuras.find(e => minhas.some(eq => eq.id === e.equipeId))
          ?? null,
        );
      } catch (e) {
        toast.error(mensagemErro(e, "Erro ao carregar as cifras"));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const termo = normalizarTitulo(busca);
  const filtradas = useMemo(() => linhas.filter(l =>
    (equipeSel === "todas" || l.cifra.equipeId === equipeSel) &&
    (!termo || normalizarTitulo(`${l.musica?.titulo ?? ""} ${l.musica?.artista ?? ""}`).includes(termo))
  ), [linhas, equipeSel, termo]);

  const dias = proximo ? differenceInCalendarDays(parseISO(proximo.data), new Date()) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Guitar size={24} className="text-primary-500" /> Cifras
      </h1>

      {/* Próximo culto → estante */}
      {proximo && (
        <Link href={`/estante?escala=${proximo.id}`}
          className="block rounded-3xl p-5 card-interativo animate-fade-up"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(192,38,211,0.25))", border: "1px solid rgba(167,139,250,0.3)" }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Maximize2 size={26} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">
                {dias <= 0 ? "Culto de hoje" : dias === 1 ? "Culto de amanhã" : `Culto · ${format(parseISO(proximo.data), "dd/MM", { locale: ptBR })}`}
              </p>
              <p className="text-lg font-bold text-white truncate">Abrir estante do culto</p>
              <p className="text-sm text-white/75 truncate">
                {CULTO_LABELS[proximo.tipoCulto] ?? proximo.tipoCulto}
                {proximo.equipeName && ` · ${proximo.equipeName}`} · {itensDoSetlist(proximo).length} músicas
              </p>
            </div>
            <ChevronRight size={22} className="text-white/80" />
          </div>
        </Link>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cifra pelo nome ou artista…"
          className="input pl-11 pr-10 py-3.5 rounded-2xl" inputMode="search" />
        {busca && (
          <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400" aria-label="Limpar busca">
            <X size={16} />
          </button>
        )}
      </div>

      {equipes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[{ id: "todas", name: "Todas", cor: undefined } as Pick<Equipe, "id" | "name" | "cor">, ...equipes].map(e => (
            <button key={e.id} onClick={() => setEquipeSel(e.id)}
              className={clsx("px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-2",
                equipeSel === e.id ? "bg-primary-500 text-white" : "bg-white/5 text-gray-600")}>
              {e.id !== "todas" && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: corVisivel(e.cor) }} />}
              {e.name}
            </button>
          ))}
        </div>
      )}

      {loading ? <EsqueletoLista itens={6} /> : equipes.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 text-sm">
          <Users2 size={32} className="mx-auto mb-2 text-primary-500" />
          Você ainda não faz parte de nenhuma equipe. Peça o link de convite ao líder.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 text-sm">
          {linhas.length === 0
            ? "Ainda não há cifras cadastradas para as suas equipes. O líder pode importar do Google Docs em Repertório → Importar cifras."
            : "Nenhuma cifra encontrada."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(l => (
            <Link key={l.cifra.id} href={`/estante?musica=${l.cifra.musicaId}&equipe=${l.cifra.equipeId}`}
              className="card card-interativo flex items-center gap-3 p-4">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary-700">{formatarTom(l.cifra.tom) || l.musica?.tom || "—"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{l.musica?.titulo ?? "Música"}</p>
                <p className="text-xs text-gray-400 truncate">
                  {l.musica?.artista}{equipes.length > 1 && l.equipe && ` · ${l.equipe.name}`}
                </p>
              </div>
              <Maximize2 size={17} className="text-primary-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
