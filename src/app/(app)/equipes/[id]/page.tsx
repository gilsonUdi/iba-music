"use client";

import { useEffect, useState } from "react";
import { corVisivel } from "@/lib/cores";
import { EsqueletoPagina } from "@/components/ui/Esqueleto";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft, Users2, UserCheck, FileText, Headphones, ExternalLink, Link2,
  Calendar, ChevronRight, BookMarked, Music2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getEquipe, getAllUsers, getEscalas, getMusicas, getRepertorioEquipe } from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import { CULTO_LABELS, INSTRUMENTO_LABELS, type AppUser, type Equipe, type Escala, type Musica } from "@/lib/types";

export default function EquipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [membros, setMembros] = useState<AppUser[]>([]);
  const [proximas, setProximas] = useState<Escala[]>([]);
  const [repertorio, setRepertorio] = useState<Musica[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const eq = await getEquipe(id);
        if (!eq) { toast.error("Equipe não encontrada"); router.replace("/equipes"); return; }
        const [users, escalas, musicas, repIds] = await Promise.all([
          getAllUsers(user!.igrejaId), getEscalas(user!.igrejaId), getMusicas(), getRepertorioEquipe(id),
        ]);
        const hoje = format(new Date(), "yyyy-MM-dd");
        setEquipe(eq);
        setMembros(eq.membros.map(uid => users.find(u => u.uid === uid)).filter(Boolean) as AppUser[]);
        setProximas(escalas.filter(e => e.equipeId === id && e.data.slice(0, 10) >= hoje).reverse());
        setRepertorio(musicas.filter(m => repIds.includes(m.id) && m.ativo !== false));
      } catch (e) {
        toast.error(mensagemErro(e, "Erro ao carregar a equipe"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, user, router]);

  async function copiarLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link da equipe copiado!");
    } catch {
      toast.info(url);
    }
  }

  if (loading) {
    return (
      <EsqueletoPagina />
    );
  }
  if (!equipe) return null;

  const cor = corVisivel(equipe.cor);
  const souMembro = equipe.membros.includes(user?.uid ?? "") || equipe.liderId === user?.uid;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push("/equipes")} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl" aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${cor}22`, border: `1.5px solid ${cor}44` }}>
          <Users2 size={26} style={{ color: cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{equipe.name}</h1>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <UserCheck size={13} /> {equipe.liderName || <span className="italic">Sem líder</span>}
            <span className="text-gray-300 mx-1">·</span>
            {membros.length} músico{membros.length !== 1 ? "s" : ""}
          </p>
          {equipe.descricao && <p className="text-sm text-gray-400 mt-1">{equipe.descricao}</p>}
        </div>
        <button onClick={copiarLink} className="btn-secondary flex items-center gap-1.5 text-sm shrink-0">
          <Link2 size={14} /> <span className="hidden sm:inline">Copiar link</span>
        </button>
      </div>

      {!souMembro && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
          Você não faz parte desta equipe. Peça ao líder ou ao diretor para incluir você.
        </p>
      )}

      {/* Materiais da equipe */}
      {(equipe.cifraUrl || equipe.vsUrl) && (
        <div className="flex flex-wrap gap-2">
          {equipe.cifraUrl && (
            <a href={equipe.cifraUrl} target="_blank" rel="noopener"
              className="inline-flex items-center gap-2 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-xl px-3 py-2 text-sm font-medium">
              <FileText size={14} /> Cifras da equipe <ExternalLink size={11} className="opacity-60" />
            </a>
          )}
          {equipe.vsUrl && (
            <a href={equipe.vsUrl} target="_blank" rel="noopener"
              className="inline-flex items-center gap-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl px-3 py-2 text-sm font-medium">
              <Headphones size={14} /> VS / Playbacks <ExternalLink size={11} className="opacity-60" />
            </a>
          )}
        </div>
      )}

      {/* Próximas escalas */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Calendar size={13} /> Próximas escalas
        </h2>
        {proximas.length === 0 ? (
          <p className="card p-4 text-sm text-gray-400">Nenhuma escala marcada para esta equipe.</p>
        ) : (
          <div className="space-y-2">
            {proximas.map(e => (
              <Link key={e.id} href={`/escalas?abrir=${e.id}`}
                className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: `${cor}18` }}>
                  <span className="font-bold leading-none" style={{ color: cor }}>{format(parseISO(e.data), "dd")}</span>
                  <span className="text-[10px] capitalize" style={{ color: cor }}>{format(parseISO(e.data), "MMM", { locale: ptBR })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{CULTO_LABELS[e.tipoCulto] ?? e.tipoCulto}</p>
                  <p className="text-xs text-gray-400 capitalize">{format(parseISO(e.data), "EEEE", { locale: ptBR })} · {e.membros.length} escalados</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Músicos */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Music2 size={13} /> Músicos
        </h2>
        {membros.length === 0 ? (
          <p className="card p-4 text-sm text-gray-400">Nenhum músico nesta equipe ainda.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {membros.map(m => (
              <div key={m.uid} className="card p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-primary-700 font-semibold text-sm">{m.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                  <p className="text-xs text-gray-400">
                    {(m.instrumentoPrincipal ?? m.instrumento) ? INSTRUMENTO_LABELS[(m.instrumentoPrincipal ?? m.instrumento)!] : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Repertório da equipe */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <BookMarked size={13} /> Repertório da equipe ({repertorio.length})
        </h2>
        {repertorio.length === 0 ? (
          <p className="card p-4 text-sm text-gray-400">
            Nenhuma música no repertório da equipe. Monte pelo menu Repertório → Lista Geral.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {repertorio.map(m => (
              <Link key={m.id} href={`/repertorio/${m.id}`} className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="badge bg-primary-50 text-primary-600 font-bold">{m.tom}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.titulo}</p>
                  <p className="text-xs text-gray-400 truncate">{m.artista}</p>
                </div>
                <ChevronRight size={15} className="text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
