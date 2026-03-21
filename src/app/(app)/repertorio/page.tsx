"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getMusicas, createMusica, getMusicasPendentes, getMusicasByLider,
  getAllPastores, votarMusica, getRepertorioEquipe, setRepertorioEquipe,
  getEquipesByLider,
} from "@/lib/firestore";
import type { Musica, TomMusical, MusicaStatus, AppUser } from "@/lib/types";
import { toast } from "sonner";
import {
  Library, Plus, Search, X, Music2, Youtube, Clock,
  CheckCircle2, XCircle, Star, Users2, BookMarked, ChevronDown, ChevronUp,
  AlertCircle, Check, Bookmark, BookmarkCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import clsx from "clsx";
import YoutubeSearch from "@/components/YoutubeSearch";

const TONS: TomMusical[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const EMPTY: Omit<Musica, "id" | "createdAt" | "createdBy"> = {
  titulo: "", artista: "", tom: "G", bpm: undefined, letra: "", youtubeUrl: "", tags: [], ativo: true,
};

// ── Estrelas ───────────────────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  readonly = false,
  size = 28,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={clsx("transition-transform", !readonly && "hover:scale-110 active:scale-95")}
        >
          <Star
            size={size}
            className={clsx(
              "transition-colors",
              n <= (hover || value) ? "text-amber-400" : "text-gray-200"
            )}
            fill={n <= (hover || value) ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

// ── Progresso de votos ─────────────────────────────────────────────────────────
function VoteProgress({ musica, totalPastores }: { musica: Musica; totalPastores: number }) {
  const votos = Object.values(musica.votos ?? {});
  const votados = votos.length;
  const media = votados > 0 ? votos.reduce((s, v) => s + v.pontuacao, 0) / votados : 0;
  const pct = Math.round((media / 5) * 100);
  const progressoVotos = totalPastores > 0 ? (votados / totalPastores) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{votados}/{totalPastores} pastor{totalPastores !== 1 ? "es" : ""} votaram</span>
        {votados > 0 && (
          <span className="flex items-center gap-1 font-medium text-amber-600">
            <Star size={11} fill="currentColor" className="text-amber-400" />
            {media.toFixed(1)} ({pct}%)
          </span>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary-400 transition-all"
          style={{ width: `${progressoVotos}%` }}
        />
      </div>
    </div>
  );
}

// ── Card de música pendente (votação) ──────────────────────────────────────────
function CardPendente({
  musica,
  pastorUid,
  totalPastores,
  onVotar,
}: {
  musica: Musica;
  pastorUid: string;
  totalPastores: number;
  onVotar: (id: string, pontuacao: number, comentario: string) => Promise<void>;
}) {
  const meuVoto = musica.votos?.[pastorUid];
  const [open, setOpen] = useState(false);
  const [pontuacao, setPontuacao] = useState(meuVoto?.pontuacao ?? 0);
  const [comentario, setComentario] = useState(meuVoto?.comentario ?? "");
  const [saving, setSaving] = useState(false);

  async function handleVotar() {
    if (pontuacao === 0) { toast.error("Dê pelo menos 1 estrela"); return; }
    setSaving(true);
    try {
      await onVotar(musica.id, pontuacao, comentario);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className={clsx(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          meuVoto ? "bg-green-100" : "bg-amber-100"
        )}>
          {meuVoto
            ? <CheckCircle2 size={18} className="text-green-600" />
            : <Clock size={18} className="text-amber-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{musica.titulo}</p>
          <p className="text-sm text-gray-500 truncate">{musica.artista}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge bg-primary-100 text-primary-700 font-bold">{musica.tom}</span>
          {meuVoto && (
            <span className="badge bg-green-100 text-green-700 text-xs flex items-center gap-0.5">
              <Star size={10} fill="currentColor" className="text-amber-400" /> {meuVoto.pontuacao}
            </span>
          )}
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          {/* Progresso */}
          <VoteProgress musica={musica} totalPastores={totalPastores} />

          {/* Votos anteriores */}
          {Object.values(musica.votos ?? {}).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Votos</p>
              {Object.values(musica.votos!).map(v => (
                <div key={v.pastorUid} className="flex items-start gap-2 bg-white rounded-xl p-3 border border-gray-100">
                  <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-primary-700 text-xs font-bold">{v.pastorName[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{v.pastorName}</span>
                      <StarRating value={v.pontuacao} readonly size={14} />
                    </div>
                    {v.comentario && <p className="text-xs text-gray-500 mt-0.5">{v.comentario}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Letra */}
          {musica.letra && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Letra</p>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 max-h-52 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{musica.letra}</pre>
              </div>
            </div>
          )}

          {/* Formulário de voto */}
          <div className="bg-white rounded-2xl p-4 border border-primary-100 space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              {meuVoto ? "Atualizar meu voto" : "Meu voto"}
            </p>
            <StarRating value={pontuacao} onChange={setPontuacao} size={36} />
            {pontuacao > 0 && (
              <p className="text-xs text-gray-500">
                {pontuacao === 1 && "Não recomendo"}
                {pontuacao === 2 && "Abaixo da média"}
                {pontuacao === 3 && "Razoável"}
                {pontuacao === 4 && "Boa música"}
                {pontuacao === 5 && "Excelente! Recomendo"}
                {" "}— {Math.round((pontuacao / 5) * 100)}%
              </p>
            )}
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              className="input resize-none text-sm"
              rows={3}
              placeholder="Comentário sobre a letra e adequação ao ministério (opcional)..."
            />
            <button
              onClick={handleVotar}
              disabled={saving || pontuacao === 0}
              className="btn-primary w-full"
            >
              {saving ? "Salvando..." : meuVoto ? "Atualizar voto" : "Registrar voto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card de submissão (visão do lider_equipe) ──────────────────────────────────
function CardSubmissao({ musica, totalPastores }: { musica: Musica; totalPastores: number }) {
  const [open, setOpen] = useState(false);
  const votos = Object.values(musica.votos ?? {});
  const votados = votos.length;
  const media = votados > 0 ? votos.reduce((s, v) => s + v.pontuacao, 0) / votados : 0;

  const statusCls = {
    pendente: "bg-amber-100 text-amber-700",
    aprovada: "bg-green-100 text-green-700",
    rejeitada: "bg-red-100 text-red-700",
  }[musica.status ?? "pendente"];

  const statusLabel = {
    pendente: "Aguardando votos",
    aprovada: "Aprovada",
    rejeitada: "Rejeitada",
  }[musica.status ?? "pendente"];

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
          <Music2 size={18} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{musica.titulo}</p>
          <p className="text-sm text-gray-500 truncate">{musica.artista}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={clsx("badge text-xs", statusCls)}>{statusLabel}</span>
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          {musica.status === "pendente" && (
            <VoteProgress musica={musica} totalPastores={totalPastores} />
          )}
          {musica.status === "aprovada" && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl p-3">
              <CheckCircle2 size={16} />
              <span className="text-sm font-medium">
                Aprovada! Média: {musica.mediaVotos?.toFixed(1)} ⭐ ({Math.round(((musica.mediaVotos ?? 0) / 5) * 100)}%)
              </span>
            </div>
          )}
          {musica.status === "rejeitada" && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-xl p-3">
              <XCircle size={16} />
              <span className="text-sm font-medium">
                Rejeitada. Média: {musica.mediaVotos?.toFixed(1)} ⭐ ({Math.round(((musica.mediaVotos ?? 0) / 5) * 100)}%)
              </span>
            </div>
          )}
          {/* Comentários dos pastores */}
          {votados > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avaliações dos pastores</p>
              {Object.values(musica.votos!).map(v => (
                <div key={v.pastorUid} className="flex items-start gap-2 bg-white rounded-xl p-3 border border-gray-100">
                  <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-primary-700 text-xs font-bold">{v.pastorName[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{v.pastorName}</span>
                      <StarRating value={v.pontuacao} readonly size={13} />
                    </div>
                    {v.comentario && <p className="text-xs text-gray-500 mt-0.5">{v.comentario}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function RepertorioPage() {
  const router = useRouter();
  const { user } = useAuth();

  const isPastor      = user?.roles?.includes("pastor") ?? false;
  const isLiderEquipe = (user?.roles?.includes("lider_equipe") && !isPastor) ?? false;

  type Tab = "geral" | "votar" | "submissoes" | "meu";
  const [tab, setTab] = useState<Tab>("geral");

  const [musicas,      setMusicas]      = useState<Musica[]>([]);
  const [pendentes,    setPendentes]    = useState<Musica[]>([]);
  const [minhas,       setMinhas]       = useState<Musica[]>([]);
  const [meuRepertorio, setMeuRepertorio] = useState<string[]>([]);
  const [totalPastores, setTotalPastores] = useState(0);
  const [minhaEquipeId, setMinhaEquipeId] = useState<string | null>(null);
  const [minhaEquipeName, setMinhaEquipeName] = useState<string>("");
  const [loading,      setLoading]      = useState(true);
  const [savingRep,    setSavingRep]    = useState(false);

  const [search,     setSearch]     = useState("");
  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState({ ...EMPTY });
  const [saving,     setSaving]     = useState(false);

  async function load() {
    setLoading(true);
    const tasks: Promise<void>[] = [
      getMusicas().then(setMusicas),
      getAllPastores().then(ps => setTotalPastores(ps.length)),
    ];
    if (isPastor)      tasks.push(getMusicasPendentes().then(setPendentes));
    if (isLiderEquipe && user?.uid) {
      tasks.push(getMusicasByLider(user.uid).then(setMinhas));
      tasks.push(
        getEquipesByLider(user.uid).then(async eqs => {
          const eq = eqs[0];
          if (eq) {
            setMinhaEquipeId(eq.id);
            setMinhaEquipeName(eq.name);
            const ids = await getRepertorioEquipe(eq.id);
            setMeuRepertorio(ids);
          }
        })
      );
    }
    await Promise.all(tasks);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...EMPTY }); setShowModal(true); }

  async function handleSave() {
    if (!form.titulo || !form.artista) { toast.error("Título e artista são obrigatórios"); return; }
    if (!user?.igrejaId && !isPastor) { toast.error("Seu usuário não está vinculado a uma igreja."); return; }
    if (!isPastor && !form.letra?.trim()) { toast.error("A letra é obrigatória para análise dos pastores"); return; }
    setSaving(true);
    try {
      const status: MusicaStatus = isPastor ? "aprovada" : "pendente";
      const ref = await createMusica({ ...form, status, createdBy: user!.uid, igrejaId: user?.igrejaId });
      if (isPastor) {
        toast.success("Música adicionada ao repertório!");
        router.push(`/repertorio/${ref.id}`);
      } else {
        toast.success("Música enviada para votação dos pastores!");
        setShowModal(false);
        await load();
        setTab("submissoes");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleVotar(id: string, pontuacao: number, comentario: string) {
    await votarMusica(id, { uid: user!.uid, name: user!.name, igrejaId: user?.igrejaId }, pontuacao, comentario);
    toast.success("Voto registrado!");
    await load();
  }

  async function toggleMeuRepertorio(musicaId: string) {
    if (!minhaEquipeId) { toast.error("Você precisa ser líder de uma equipe"); return; }
    const novaLista = meuRepertorio.includes(musicaId)
      ? meuRepertorio.filter(id => id !== musicaId)
      : [...meuRepertorio, musicaId];
    setMeuRepertorio(novaLista);
    setSavingRep(true);
    try {
      await setRepertorioEquipe(minhaEquipeId, minhaEquipeName, user!.igrejaId!, novaLista);
    } finally {
      setSavingRep(false);
    }
  }

  const filtered = musicas.filter(m =>
    m.titulo.toLowerCase().includes(search.toLowerCase()) ||
    m.artista.toLowerCase().includes(search.toLowerCase()) ||
    m.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const canSubmit = isPastor || isLiderEquipe;

  // ── Tabs config ───────────────────────────────────────────────────────────────
  const tabs = [
    { id: "geral" as Tab, label: "Repertório Geral", show: true },
    { id: "votar" as Tab, label: "Para Votar", badge: pendentes.length, show: isPastor },
    { id: "submissoes" as Tab, label: "Minhas Submissões", show: isLiderEquipe },
    { id: "meu" as Tab, label: "Meu Repertório", show: isLiderEquipe },
  ].filter(t => t.show);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library size={24} className="text-primary-500" /> Repertório
          </h1>
          <p className="text-gray-500 mt-1">{musicas.length} música{musicas.length !== 1 ? "s" : ""} aprovadas</p>
        </div>
        {canSubmit && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {isPastor ? "Adicionar" : "Submeter"}
          </button>
        )}
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-2",
                tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      ) : (
        <>
          {/* ── Aba Repertório Geral ──────────────────────────────────────────── */}
          {tab === "geral" && (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por título, artista ou tag..."
                  className="input pl-9"
                />
              </div>
              {filtered.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <Music2 size={40} className="mx-auto mb-3 opacity-40" />
                  <p>{search ? "Nenhuma música encontrada" : "Nenhuma música aprovada ainda"}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map(m => {
                    const noMeu = meuRepertorio.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className="card p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => router.push(`/repertorio/${m.id}`)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                                <Music2 size={16} className="text-purple-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 truncate text-sm">{m.titulo}</p>
                                <p className="text-xs text-gray-500 truncate">{m.artista}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 ml-11">
                              <span className="badge bg-primary-50 text-primary-600 font-bold text-xs">{m.tom}</span>
                              {m.bpm && <span className="text-xs text-gray-400">{m.bpm} BPM</span>}
                              {m.mediaVotos && (
                                <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                  <Star size={10} fill="currentColor" className="text-amber-400" />
                                  {m.mediaVotos.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          {isLiderEquipe && (
                            <button
                              onClick={() => toggleMeuRepertorio(m.id)}
                              disabled={savingRep}
                              title={noMeu ? "Remover do meu repertório" : "Adicionar ao meu repertório"}
                              className={clsx(
                                "p-2 rounded-xl transition-colors shrink-0",
                                noMeu
                                  ? "bg-primary-100 text-primary-600 hover:bg-primary-200"
                                  : "text-gray-300 hover:bg-gray-100 hover:text-primary-400"
                              )}
                            >
                              {noMeu ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Aba Para Votar (pastores) ─────────────────────────────────────── */}
          {tab === "votar" && isPastor && (
            <>
              {pendentes.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <CheckCircle2 size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Nenhuma música aguardando votação</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    {pendentes.filter(m => m.votos?.[user!.uid]).length} de {pendentes.length} avaliadas por você
                  </p>
                  {pendentes.map(m => (
                    <CardPendente
                      key={m.id}
                      musica={m}
                      pastorUid={user!.uid}
                      totalPastores={totalPastores}
                      onVotar={handleVotar}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Aba Minhas Submissões (lider_equipe) ─────────────────────────── */}
          {tab === "submissoes" && isLiderEquipe && (
            <>
              {minhas.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <Music2 size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Você ainda não submeteu nenhuma música</p>
                  <button onClick={openNew} className="btn-primary mt-4 text-sm">
                    Submeter primeira música
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {minhas.map(m => (
                    <CardSubmissao key={m.id} musica={m} totalPastores={totalPastores} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Aba Meu Repertório (lider_equipe) ────────────────────────────── */}
          {tab === "meu" && isLiderEquipe && (
            <>
              <div className="card p-4 bg-primary-50 border-primary-100">
                <div className="flex items-center gap-3">
                  <BookMarked size={20} className="text-primary-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-primary-800">Repertório de {minhaEquipeName || "sua equipe"}</p>
                    <p className="text-xs text-primary-600">{meuRepertorio.length} música{meuRepertorio.length !== 1 ? "s" : ""} selecionada{meuRepertorio.length !== 1 ? "s" : ""}. Clique no marcador <Bookmark size={11} className="inline" /> no Repertório Geral para adicionar.</p>
                  </div>
                </div>
              </div>

              {meuRepertorio.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <BookMarked size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Nenhuma música no seu repertório ainda</p>
                  <button onClick={() => setTab("geral")} className="btn-secondary mt-4 text-sm">
                    Ir para Repertório Geral
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {musicas.filter(m => meuRepertorio.includes(m.id)).map((m, idx) => (
                    <div
                      key={m.id}
                      className="card p-4 flex items-center gap-3"
                    >
                      <span className="w-7 h-7 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                        {idx + 1}
                      </span>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => router.push(`/repertorio/${m.id}`)}
                      >
                        <p className="font-semibold text-gray-900 truncate text-sm">{m.titulo}</p>
                        <p className="text-xs text-gray-500 truncate">{m.artista} · {m.tom}</p>
                      </div>
                      <button
                        onClick={() => toggleMeuRepertorio(m.id)}
                        className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Remover do meu repertório"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal cadastro */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">
                  {isPastor ? "Nova Música" : "Submeter Música para Votação"}
                </h2>
                {!isPastor && (
                  <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                    <AlertCircle size={12} /> Todos os pastores precisam votar antes de entrar no repertório
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Título *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className="input" placeholder="Nome da música" />
              </div>
              <div>
                <label className="label">Artista/Ministério *</label>
                <input value={form.artista} onChange={e => setForm(f => ({ ...f, artista: e.target.value }))} className="input" placeholder="Ex: Hillsong, Gabriela Rocha..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tom</label>
                  <select value={form.tom} onChange={e => setForm(f => ({ ...f, tom: e.target.value as TomMusical }))} className="input">
                    {TONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">BPM</label>
                  <input type="number" value={form.bpm ?? ""} onChange={e => setForm(f => ({ ...f, bpm: e.target.value ? Number(e.target.value) : undefined }))} className="input" placeholder="120" />
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <Youtube size={13} className="text-red-500" /> YouTube
                </label>
                <YoutubeSearch
                  value={form.youtubeUrl ?? ""}
                  onChange={url => setForm(f => ({ ...f, youtubeUrl: url }))}
                  searchQuery={[form.titulo, form.artista].filter(Boolean).join(" ")}
                />
              </div>
              <div>
                <label className="label">Tags (separadas por vírgula)</label>
                <input
                  value={form.tags?.join(", ") ?? ""}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                  className="input"
                  placeholder="adoração, ungida, rápida"
                />
              </div>
              <div>
                <label className="label">
                  Letra {!isPastor && <span className="text-red-500">*</span>}
                </label>
                {!isPastor && <p className="text-xs text-gray-400 mb-1">Os pastores analisam a letra para a votação</p>}
                <textarea
                  value={form.letra ?? ""}
                  onChange={e => setForm(f => ({ ...f, letra: e.target.value }))}
                  className="input resize-none"
                  rows={6}
                  placeholder="Cole a letra aqui..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Salvando..." : isPastor ? "Adicionar" : "Enviar para votação"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
