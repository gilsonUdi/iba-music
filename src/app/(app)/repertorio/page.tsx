"use client";

import { useEffect, useMemo, useState } from "react";
import { EsqueletoLista } from "@/components/ui/Esqueleto";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  getMusicas, createMusica, getMusicasPendentes, getMusicasByLider,
  getAllPastores, votarMusica, getRepertorioEquipe, setRepertorioEquipe,
  getEquipes, getEscalas, getUser, setFavorita, getConfigRepertorio, setLiberacaoDireta,
  aprovarSemVotacao,
} from "@/lib/firestore";
import { formatarDuracao, type Musica, type MusicaStatus, type Equipe } from "@/lib/types";
import { toast } from "sonner";
import Sheet from "@/components/ui/Sheet";
import { mensagemErro } from "@/lib/errors";
import {
  Library, Plus, Search, X, Music2, Clock,
  CheckCircle2, XCircle, Star, BookMarked, ChevronDown, ChevronUp,
  AlertCircle, Bookmark, BookmarkCheck, History, Timer, EyeOff, BarChart3, Unlock, Lock,
} from "lucide-react";
import clsx from "clsx";
import MusicaCampos, { camposEditaveis, type MusicaForm } from "@/components/musica/MusicaCampos";
import { diasSemTocar, textoUltimaVez, usoDasMusicas, type UsoMusica } from "@/lib/estatisticas";

const EMPTY: MusicaForm = {
  titulo: "", artista: "", tom: "G", letra: "", tags: [], links: [], ativo: true,
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
  readonly = false,
  onVotar,
  onAprovar,
}: {
  musica: Musica;
  pastorUid: string;
  totalPastores: number;
  readonly?: boolean;
  onVotar: (id: string, pontuacao: number, comentario: string) => Promise<void>;
  onAprovar?: () => void;
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

          {/* Formulário de voto — oculto para diretor */}
          {onAprovar && (
            <button onClick={onAprovar}
              className="w-full text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-2xl py-2.5 flex items-center justify-center gap-1.5">
              <CheckCircle2 size={15} /> Aprovar sem votação
            </button>
          )}

          {!readonly && <div className="bg-white rounded-2xl p-4 border border-primary-100 space-y-3">
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
          </div>}
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

// ── Card de música (lista) ─────────────────────────────────────────────────────
function CardMusica({
  m, uso, favorita, noRepertorio, podeMarcarRepertorio, onFavorita, onRepertorio, onAbrir,
}: {
  m: Musica;
  uso?: UsoMusica;
  favorita: boolean;
  noRepertorio: boolean;
  podeMarcarRepertorio: boolean;
  onFavorita: () => void;
  onRepertorio: () => void;
  onAbrir: () => void;
}) {
  const dias = diasSemTocar(uso);
  return (
    <div className={clsx("card p-4 hover:shadow-md transition-shadow", m.ativo === false && "opacity-60")}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onAbrir}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
              <Music2 size={16} className="text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate text-sm">{m.titulo}</p>
              <p className="text-xs text-gray-500 truncate">{m.artista}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 ml-11 flex-wrap">
            <span className="badge bg-primary-50 text-primary-600 font-bold text-xs">{m.tom}</span>
            {m.bpm && <span className="text-xs text-gray-400">{m.bpm} BPM</span>}
            {m.duracaoSeg && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Timer size={10} />{formatarDuracao(m.duracaoSeg)}</span>}
            <span className={clsx("text-xs flex items-center gap-0.5",
              dias === undefined ? "text-gray-400" : dias > 60 ? "text-amber-600" : "text-gray-400")}>
              <History size={10} /> {textoUltimaVez(dias)}
            </span>
            {m.ativo === false && <span className="badge bg-gray-100 text-gray-500 text-[10px]"><EyeOff size={9} /> Retirada</span>}
          </div>
        </div>
        <button onClick={onFavorita} title={favorita ? "Remover das favoritas" : "Favoritar"}
          className={clsx("p-2 rounded-xl transition-colors shrink-0", favorita ? "text-amber-500" : "text-gray-300 hover:text-amber-400")}>
          <Star size={17} fill={favorita ? "currentColor" : "none"} />
        </button>
        {podeMarcarRepertorio && (
          <button onClick={onRepertorio}
            title={noRepertorio ? "Remover do repertório da equipe" : "Adicionar ao repertório da equipe"}
            className={clsx("p-2 rounded-xl transition-colors shrink-0",
              noRepertorio ? "bg-primary-100 text-primary-600 hover:bg-primary-200" : "text-gray-300 hover:bg-gray-100 hover:text-primary-400")}>
            {noRepertorio ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
type Tab = "geral" | "equipe" | "votar" | "submissoes";
type Filtro = { tipo: "todas" } | { tipo: "favoritas" } | { tipo: "naoTocadas" } | { tipo: "retiradas" } | { tipo: "tag"; tag: string };

export default function RepertorioPage() {
  const router = useRouter();
  const { user } = useAuth();

  const isPastor      = (user?.roles?.includes("pastor") || user?.roles?.includes("super_admin")) ?? false;
  const isDiretor     = (user?.roles?.includes("diretor_musical") && !isPastor) ?? false;
  const isLiderEquipe = (user?.roles?.includes("lider_equipe") && !isPastor && !isDiretor) ?? false;
  const podeCadastrar = isPastor || isDiretor || isLiderEquipe;

  const [tab, setTab] = useState<Tab>("geral");
  const [musicas,       setMusicas]       = useState<Musica[]>([]);
  const [pendentes,     setPendentes]     = useState<Musica[]>([]);
  const [minhas,        setMinhas]        = useState<Musica[]>([]);
  const [totalPastores, setTotalPastores] = useState(0);
  const [uso,           setUso]           = useState<Record<string, UsoMusica>>({});
  const [favoritas,     setFavoritas]     = useState<string[]>([]);
  const [liberacao,     setLiberacao]     = useState(false);
  const [loading,       setLoading]       = useState(true);

  // Repertório por equipe
  const [equipes,       setEquipes]       = useState<Equipe[]>([]);
  const [equipeId,      setEquipeId]      = useState<string>("");
  const [repEquipe,     setRepEquipe]     = useState<string[]>([]);
  const [savingRep,     setSavingRep]     = useState(false);

  const [search,  setSearch]  = useState("");
  const [filtro,  setFiltro]  = useState<Filtro>({ tipo: "todas" });
  const [diasX,   setDiasX]   = useState(60);

  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState<MusicaForm>({ ...EMPTY });
  const [saving,    setSaving]    = useState(false);

  const equipe = equipes.find(e => e.id === equipeId);
  const podeEditarRepEquipe = !!equipe && (isPastor || isDiretor || equipe.liderId === user?.uid);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const [ms, pastores, escalas, eu, cfg, eqs] = await Promise.all([
        getMusicas(), getAllPastores(), getEscalas(user.igrejaId), getUser(user.uid),
        getConfigRepertorio(), getEquipes(user.igrejaId),
      ]);
      setMusicas(ms);
      setTotalPastores(pastores.length);
      setUso(usoDasMusicas(escalas));
      setFavoritas(eu?.favoritas ?? []);
      setLiberacao(cfg.liberacaoDireta);
      const visiveis = (isPastor || isDiretor)
        ? eqs
        : eqs.filter(e => e.membros.includes(user.uid) || e.liderId === user.uid);
      setEquipes(visiveis);
      const inicial = visiveis.find(e => e.liderId === user.uid) ?? visiveis[0];
      if (inicial && !equipeId) setEquipeId(inicial.id);
      if (isPastor || isDiretor) setPendentes(await getMusicasPendentes());
      if (isLiderEquipe || isDiretor) setMinhas(await getMusicasByLider(user.uid));
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao carregar o repertório"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!equipeId) { setRepEquipe([]); return; }
    getRepertorioEquipe(equipeId).then(setRepEquipe).catch(e => toast.error(mensagemErro(e)));
  }, [equipeId]);

  function openNew() { setForm({ ...EMPTY }); setShowModal(true); }

  const vaiAprovado = isPastor || liberacao;

  async function handleSave() {
    if (!form.titulo?.trim() || !form.artista?.trim()) { toast.error("Título e artista são obrigatórios"); return; }
    if (!user?.igrejaId && !isPastor) { toast.error("Seu usuário não está vinculado a uma igreja."); return; }
    setSaving(true);
    try {
      const status: MusicaStatus = vaiAprovado ? "aprovada" : "pendente";
      const dados = Object.fromEntries(Object.entries(camposEditaveis(form)).filter(([, v]) => v !== undefined && v !== ""));
      const ref = await createMusica({
        ...(dados as Omit<Musica, "id" | "createdAt">),
        ativo: true, status, createdBy: user!.uid, igrejaId: user?.igrejaId,
      });
      if (vaiAprovado) {
        toast.success("Música adicionada ao repertório!");
        router.push(`/repertorio/${ref.id}`);
      } else {
        toast.success("Música enviada para votação dos pastores!");
        setShowModal(false);
        await load();
        setTab("submissoes");
      }
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar a música"));
    } finally {
      setSaving(false);
    }
  }

  async function handleVotar(id: string, pontuacao: number, comentario: string) {
    try {
      await votarMusica(id, { uid: user!.uid, name: user!.name, igrejaId: user?.igrejaId }, pontuacao, comentario);
      toast.success("Voto registrado!");
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao registrar o voto"));
    }
  }

  async function aprovarPendentes(ids: string[]) {
    const msg = ids.length === 1
      ? "Aprovar esta música sem votação? Ela entra direto no repertório."
      : `Aprovar as ${ids.length} músicas pendentes sem votação? Todas entram direto no repertório.`;
    if (!confirm(msg)) return;
    try {
      await aprovarSemVotacao(ids);
      toast.success(ids.length === 1 ? "Música aprovada" : `${ids.length} músicas aprovadas`);
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao aprovar"));
    }
  }

  async function toggleLiberacao() {
    const novo = !liberacao;
    const msg = novo
      ? "Liberar o cadastro direto? Todas as músicas novas entram direto no repertório, sem votação."
      : "Iniciar a rotina de aprovação? Novas músicas voltam a passar pela votação dos pastores.";
    if (!confirm(msg)) return;
    try {
      await setLiberacaoDireta(novo);
      setLiberacao(novo);
      toast.success(novo ? "Cadastro direto liberado" : "Rotina de aprovação ativada");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao alterar a liberação"));
    }
  }

  async function toggleFavorita(musicaId: string) {
    const fav = !favoritas.includes(musicaId);
    setFavoritas(f => fav ? [...f, musicaId] : f.filter(x => x !== musicaId));
    try {
      await setFavorita(user!.uid, musicaId, fav);
    } catch (e) {
      setFavoritas(f => fav ? f.filter(x => x !== musicaId) : [...f, musicaId]);
      toast.error(mensagemErro(e, "Erro ao salvar favorita"));
    }
  }

  async function toggleRepEquipe(musicaId: string) {
    if (!equipe || !podeEditarRepEquipe) return;
    const anterior = repEquipe;
    const nova = repEquipe.includes(musicaId) ? repEquipe.filter(id => id !== musicaId) : [...repEquipe, musicaId];
    setRepEquipe(nova);
    setSavingRep(true);
    try {
      await setRepertorioEquipe(equipe.id, equipe.name, equipe.igrejaId ?? user!.igrejaId!, nova);
    } catch (e) {
      setRepEquipe(anterior);
      toast.error(mensagemErro(e, "Erro ao salvar o repertório da equipe"));
    } finally {
      setSavingRep(false);
    }
  }

  // Tags existentes viram abas de filtro
  const tags = useMemo(() => {
    const cont = new Map<string, number>();
    musicas.filter(m => m.ativo !== false).forEach(m => m.tags?.forEach(t => cont.set(t, (cont.get(t) ?? 0) + 1)));
    return Array.from(cont.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [musicas]);

  const termo = search.trim().toLowerCase();
  const casaBusca = (m: Musica) => !termo ||
    m.titulo.toLowerCase().includes(termo) ||
    m.artista.toLowerCase().includes(termo) ||
    m.tags?.some(t => t.toLowerCase().includes(termo));

  const listaGeral = musicas.filter(m => {
    if (filtro.tipo === "retiradas") return m.ativo === false;
    if (m.ativo === false) return false;
    if (filtro.tipo === "favoritas") return favoritas.includes(m.id);
    if (filtro.tipo === "tag") return m.tags?.includes(filtro.tag);
    if (filtro.tipo === "naoTocadas") {
      const d = diasSemTocar(uso[m.id]);
      return d === undefined || d >= diasX;
    }
    return true;
  }).filter(casaBusca);

  if (filtro.tipo === "naoTocadas") {
    // nunca tocadas primeiro, depois as há mais tempo sem tocar
    listaGeral.sort((a, b) => (diasSemTocar(uso[b.id]) ?? 1e9) - (diasSemTocar(uso[a.id]) ?? 1e9));
  }

  const listaEquipe = musicas.filter(m => repEquipe.includes(m.id) && m.ativo !== false).filter(casaBusca);

  const tabs = [
    { id: "geral" as Tab, label: "Lista Geral", show: true },
    { id: "equipe" as Tab, label: "Da Equipe", show: equipes.length > 0 },
    { id: "votar" as Tab, label: "Para Votar", badge: pendentes.length, show: isPastor || isDiretor },
    { id: "submissoes" as Tab, label: "Minhas Submissões", show: isLiderEquipe || isDiretor },
  ].filter(t => t.show);

  const chip = (ativo: boolean) => clsx(
    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1",
    ativo ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
  );

  const renderCard = (m: Musica) => (
    <CardMusica
      key={m.id}
      m={m}
      uso={uso[m.id]}
      favorita={favoritas.includes(m.id)}
      noRepertorio={repEquipe.includes(m.id)}
      podeMarcarRepertorio={podeEditarRepEquipe && !savingRep}
      onFavorita={() => toggleFavorita(m.id)}
      onRepertorio={() => toggleRepEquipe(m.id)}
      onAbrir={() => router.push(`/repertorio/${m.id}`)}
    />
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library size={24} className="text-primary-500" /> Repertório
          </h1>
          <p className="text-gray-500 mt-1">{musicas.filter(m => m.ativo !== false).length} músicas no repertório</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {podeCadastrar && (
            <Link href="/repertorio/relatorio" className="btn-secondary flex items-center gap-2" title="Músicas mais tocadas">
              <BarChart3 size={16} /> <span className="hidden sm:inline">Relatório</span>
            </Link>
          )}
          {podeCadastrar && (
            <button onClick={openNew} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> {isPastor || liberacao ? "Adicionar" : "Submeter"}
            </button>
          )}
        </div>
      </div>

      {/* Liberação direta */}
      {(isPastor || (liberacao && podeCadastrar)) && (
        <div className={clsx("card p-3 flex items-center gap-3 text-sm",
          liberacao ? "bg-green-50 border-green-100" : "bg-gray-50")}>
          {liberacao ? <Unlock size={16} className="text-green-600 shrink-0" /> : <Lock size={16} className="text-gray-400 shrink-0" />}
          <p className="flex-1 text-gray-700">
            {liberacao
              ? "Cadastro direto liberado: as músicas entram no repertório sem votação."
              : "Rotina de aprovação ativa: novas músicas passam pela votação dos pastores."}
          </p>
          {isPastor && (
            <button onClick={toggleLiberacao} className="text-xs font-semibold text-primary-600 hover:text-primary-800 shrink-0">
              {liberacao ? "Ativar votação" : "Liberar cadastro"}
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx("flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-2",
                tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {(tab === "geral" || tab === "equipe") && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, artista ou tag..." className="input pl-9" />
        </div>
      )}

      {loading ? (
        <EsqueletoLista grade />
      ) : (
        <>
          {/* ── Lista Geral ─────────────────────────────────────────────────── */}
          {tab === "geral" && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <button className={chip(filtro.tipo === "todas")} onClick={() => setFiltro({ tipo: "todas" })}>Todas</button>
                <button className={chip(filtro.tipo === "favoritas")} onClick={() => setFiltro({ tipo: "favoritas" })}>
                  <Star size={11} fill="currentColor" /> Favoritas
                </button>
                <button className={chip(filtro.tipo === "naoTocadas")} onClick={() => setFiltro({ tipo: "naoTocadas" })}>
                  <History size={11} /> Não tocadas
                </button>
                {tags.map(([t, n]) => (
                  <button key={t} className={chip(filtro.tipo === "tag" && filtro.tag === t)} onClick={() => setFiltro({ tipo: "tag", tag: t })}>
                    {t} <span className="opacity-60">{n}</span>
                  </button>
                ))}
                {isPastor && (
                  <button className={chip(filtro.tipo === "retiradas")} onClick={() => setFiltro({ tipo: "retiradas" })}>
                    <EyeOff size={11} /> Retiradas
                  </button>
                )}
              </div>

              {filtro.tipo === "naoTocadas" && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  Sem tocar há pelo menos
                  <input type="number" min={1} value={diasX} onChange={e => setDiasX(Math.max(1, Number(e.target.value) || 1))}
                    className="input w-20 py-1.5 text-center" />
                  dias (inclui as nunca tocadas)
                </div>
              )}

              {equipe && podeEditarRepEquipe && (
                <p className="text-xs text-gray-400">
                  Use <Bookmark size={11} className="inline" /> para montar o repertório da equipe <strong>{equipe.name}</strong>.
                </p>
              )}

              {listaGeral.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <Music2 size={40} className="mx-auto mb-3 opacity-40" />
                  <p>{search || filtro.tipo !== "todas" ? "Nenhuma música neste filtro" : "Nenhuma música aprovada ainda"}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">{listaGeral.map(renderCard)}</div>
              )}
            </>
          )}

          {/* ── Repertório da Equipe ────────────────────────────────────────── */}
          {tab === "equipe" && (
            <>
              <div className="card p-4 bg-primary-50 border-primary-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <BookMarked size={20} className="text-primary-500 shrink-0" />
                <div className="flex-1">
                  {equipes.length > 1 ? (
                    <select value={equipeId} onChange={e => setEquipeId(e.target.value)} className="input py-2 bg-white">
                      {equipes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-primary-800">Repertório de {equipe?.name}</p>
                  )}
                  <p className="text-xs text-primary-600 mt-1">
                    {repEquipe.length} música{repEquipe.length !== 1 ? "s" : ""}
                    {podeEditarRepEquipe && <> · adicione pela Lista Geral com <Bookmark size={11} className="inline" /></>}
                  </p>
                </div>
              </div>
              {listaEquipe.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <BookMarked size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Nenhuma música no repertório desta equipe</p>
                  {podeEditarRepEquipe && (
                    <button onClick={() => setTab("geral")} className="btn-secondary mt-4 text-sm">Ir para a Lista Geral</button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">{listaEquipe.map(renderCard)}</div>
              )}
            </>
          )}

          {/* ── Para Votar ──────────────────────────────────────────────────── */}
          {tab === "votar" && (isPastor || isDiretor) && (
            pendentes.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <CheckCircle2 size={40} className="mx-auto mb-3 opacity-40" />
                <p>Nenhuma música aguardando votação</p>
              </div>
            ) : (
              <div className="space-y-3">
                {isDiretor && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                    Como Diretor Musical, você acompanha as votações mas não participa da avaliação das músicas.
                  </p>
                )}
                {isPastor && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm text-gray-500">
                      {pendentes.filter(m => m.votos?.[user!.uid]).length} de {pendentes.length} avaliadas por você
                    </p>
                    <button onClick={() => aprovarPendentes(pendentes.map(m => m.id))}
                      className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-xl flex items-center gap-1">
                      <CheckCircle2 size={13} /> Aprovar todas sem votação
                    </button>
                  </div>
                )}
                {pendentes.map(m => (
                  <CardPendente key={m.id} musica={m} pastorUid={user!.uid} totalPastores={totalPastores}
                    readonly={isDiretor} onVotar={handleVotar}
                    onAprovar={isPastor ? () => aprovarPendentes([m.id]) : undefined} />
                ))}
              </div>
            )
          )}

          {/* ── Minhas Submissões ───────────────────────────────────────────── */}
          {tab === "submissoes" && (isLiderEquipe || isDiretor) && (
            minhas.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <Music2 size={40} className="mx-auto mb-3 opacity-40" />
                <p>Você ainda não cadastrou nenhuma música</p>
                <button onClick={openNew} className="btn-primary mt-4 text-sm">Cadastrar primeira música</button>
              </div>
            ) : (
              <div className="space-y-3">
                {minhas.map(m => <CardSubmissao key={m.id} musica={m} totalPastores={totalPastores} />)}
              </div>
            )
          )}
        </>
      )}

      {/* Modal cadastro */}
      {showModal && (
        <Sheet aberto onFechar={() => setShowModal(false)} className="sm:max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{vaiAprovado ? "Nova Música" : "Submeter Música para Votação"}</h2>
            {!vaiAprovado && (
              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <AlertCircle size={12} /> Todos os pastores precisam votar antes de entrar no repertório
              </p>
            )}
          </div>
          <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <MusicaCampos form={form} setForm={setForm} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? "Salvando..." : vaiAprovado ? "Adicionar" : "Enviar para votação"}
            </button>
          </div>
        </div>
        </Sheet>
      )}
    </div>
  );
}
