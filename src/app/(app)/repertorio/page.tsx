"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getMusicas, createMusica, getMusicasPendentes, getMusicasByLider, updateMusica } from "@/lib/firestore";
import type { Musica, TomMusical, MusicaStatus } from "@/lib/types";
import { toast } from "sonner";
import {
  Library, Plus, Search, X, Music2, Youtube, FileText, Clock,
  CheckCircle2, XCircle, MessageSquare, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import clsx from "clsx";

const TONS: TomMusical[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const EMPTY: Omit<Musica, "id" | "createdAt" | "createdBy"> = {
  titulo: "", artista: "", tom: "G", bpm: undefined, letra: "", cifraUrl: "", youtubeUrl: "", tags: [], ativo: true,
};

const STATUS_BADGE: Record<MusicaStatus, { label: string; cls: string }> = {
  pendente:  { label: "Aguardando aprovação", cls: "bg-amber-100 text-amber-700" },
  aprovada:  { label: "Aprovada",             cls: "bg-green-100 text-green-700" },
  rejeitada: { label: "Rejeitada",            cls: "bg-red-100 text-red-700" },
};

// ── Card de música pendente (visão do pastor) ──────────────────────────────────
function CardPendente({
  musica,
  onDecisao,
}: {
  musica: Musica;
  onDecisao: (id: string, status: "aprovada" | "rejeitada", comentario: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);

  async function decidir(status: "aprovada" | "rejeitada") {
    if (status === "rejeitada" && !comentario.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setSaving(true);
    try {
      await onDecisao(musica.id, status, comentario);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
          <Music2 size={18} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{musica.titulo}</p>
          <p className="text-sm text-gray-500 truncate">{musica.artista}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge bg-primary-100 text-primary-700 font-bold">{musica.tom}</span>
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          {musica.letra && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Letra</p>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 max-h-60 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{musica.letra}</pre>
              </div>
            </div>
          )}
          {musica.youtubeUrl && (
            <a href={musica.youtubeUrl} target="_blank" rel="noreferrer" className="text-sm text-red-500 flex items-center gap-1.5 hover:underline">
              <Youtube size={14} /> Ver no YouTube
            </a>
          )}

          <div>
            <label className="label flex items-center gap-1.5">
              <MessageSquare size={13} /> Comentário do pastor
            </label>
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Observações sobre a letra, tema, adequação... (obrigatório para rejeição)"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => decidir("rejeitada")}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors border border-red-100"
            >
              <XCircle size={16} /> Rejeitar
            </button>
            <button
              onClick={() => decidir("aprovada")}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-green-50 text-green-700 font-medium text-sm hover:bg-green-100 transition-colors border border-green-100"
            >
              <CheckCircle2 size={16} /> Aprovar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function RepertorioPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isPastor     = user?.roles?.includes("pastor") ?? false;
  const isLiderEquipe = (user?.roles?.includes("lider_equipe") && !isPastor) ?? false;

  const [tab, setTab] = useState<"repertorio" | "pendentes" | "minhas">("repertorio");
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [pendentes, setPendentes] = useState<Musica[]>([]);
  const [minhas, setMinhas] = useState<Musica[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const promises: Promise<void>[] = [
      getMusicas(user?.igrejaId).then(setMusicas),
    ];
    if (isPastor) promises.push(getMusicasPendentes(user?.igrejaId).then(setPendentes));
    if (isLiderEquipe && user?.uid) promises.push(getMusicasByLider(user.uid, user?.igrejaId).then(setMinhas));
    await Promise.all(promises);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm(EMPTY);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.titulo || !form.artista) { toast.error("Título e artista são obrigatórios"); return; }
    setSaving(true);
    try {
      // Pastor cria aprovada; lider_equipe cria pendente
      const status: MusicaStatus = isPastor ? "aprovada" : "pendente";
      const ref = await createMusica({ ...form, status, createdBy: user!.uid, igrejaId: user?.igrejaId });
      if (isPastor) {
        toast.success("Música adicionada ao repertório!");
        router.push(`/repertorio/${ref.id}`);
      } else {
        toast.success("Música enviada para aprovação do pastor!");
        setShowModal(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDecisao(id: string, status: "aprovada" | "rejeitada", comentario: string) {
    await updateMusica(id, {
      status,
      aprovacaoComentario: comentario || undefined,
      aprovadoPor: user!.uid,
      aprovadoEm: new Date(),
    });
    toast.success(status === "aprovada" ? "Música aprovada!" : "Música rejeitada");
    await load();
  }

  const filtered = musicas.filter(m =>
    m.titulo.toLowerCase().includes(search.toLowerCase()) ||
    m.artista.toLowerCase().includes(search.toLowerCase()) ||
    m.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const canEdit = isPastor || isLiderEquipe;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library size={24} className="text-primary-500" /> Repertório
          </h1>
          <p className="text-gray-500 mt-1">{musicas.length} músicas aprovadas</p>
        </div>
        {canEdit && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {isPastor ? "Adicionar Música" : "Submeter Música"}
          </button>
        )}
      </div>

      {/* Tabs */}
      {(isPastor || isLiderEquipe) && (
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
          <button
            onClick={() => setTab("repertorio")}
            className={clsx("flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors", tab === "repertorio" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
          >
            Repertório
          </button>
          {isPastor && (
            <button
              onClick={() => setTab("pendentes")}
              className={clsx("flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2", tab === "pendentes" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
            >
              Pendentes
              {pendentes.length > 0 && (
                <span className="w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {pendentes.length}
                </span>
              )}
            </button>
          )}
          {isLiderEquipe && (
            <button
              onClick={() => setTab("minhas")}
              className={clsx("flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors", tab === "minhas" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
            >
              Minhas Submissões
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      ) : (
        <>
          {/* ── Aba Repertório ───────────────────────────────────────────────── */}
          {tab === "repertorio" && (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, artista ou tag..." className="input pl-9" />
              </div>

              {filtered.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <Music2 size={40} className="mx-auto mb-3 opacity-40" />
                  <p>{search ? "Nenhuma música encontrada" : "Nenhuma música aprovada no repertório"}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map(m => (
                    <div
                      key={m.id}
                      className="card p-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                      onClick={() => router.push(`/repertorio/${m.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                              <Music2 size={16} className="text-purple-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{m.titulo}</p>
                              <p className="text-sm text-gray-500 truncate">{m.artista}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="badge bg-primary-100 text-primary-700 font-bold">{m.tom}</span>
                          {m.bpm && <span className="badge bg-gray-100 text-gray-600 flex items-center gap-0.5"><Clock size={10} />{m.bpm}</span>}
                        </div>
                      </div>
                      {m.tags && m.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {m.tags.map(t => <span key={t} className="badge bg-gray-100 text-gray-500">{t}</span>)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                        {m.cifraUrl && <span className="text-xs text-primary-500 flex items-center gap-1"><FileText size={11} /> Cifra</span>}
                        {m.youtubeUrl && <span className="text-xs text-red-400 flex items-center gap-1"><Youtube size={11} /> YouTube</span>}
                        <span className="ml-auto text-xs text-gray-300">Ver detalhes →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Aba Pendentes (pastor) ────────────────────────────────────────── */}
          {tab === "pendentes" && isPastor && (
            <div className="space-y-3">
              {pendentes.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <CheckCircle2 size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Nenhuma música aguardando aprovação</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-2xl px-4 py-3 border border-amber-100">
                    <AlertCircle size={15} />
                    {pendentes.length} música{pendentes.length !== 1 ? "s" : ""} aguardando sua avaliação sobre a coerência e edificação da letra
                  </div>
                  {pendentes.map(m => (
                    <CardPendente key={m.id} musica={m} onDecisao={handleDecisao} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Aba Minhas Submissões (lider_equipe) ─────────────────────────── */}
          {tab === "minhas" && isLiderEquipe && (
            <div className="space-y-3">
              {minhas.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">
                  <Music2 size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Você ainda não submeteu nenhuma música</p>
                </div>
              ) : (
                minhas.map(m => {
                  const st = m.status ?? "aprovada";
                  const badge = STATUS_BADGE[st];
                  return (
                    <div key={m.id} className="card p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                          <Music2 size={16} className="text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 truncate">{m.titulo}</p>
                            <span className={clsx("badge", badge.cls)}>{badge.label}</span>
                          </div>
                          <p className="text-sm text-gray-500 truncate">{m.artista}</p>
                        </div>
                        <span className="badge bg-primary-100 text-primary-700 font-bold shrink-0">{m.tom}</span>
                        {st === "aprovada" && (
                          <button
                            onClick={() => router.push(`/repertorio/${m.id}`)}
                            className="text-xs text-primary-500 hover:underline shrink-0"
                          >
                            Ver →
                          </button>
                        )}
                      </div>
                      {m.aprovacaoComentario && (
                        <div className={clsx(
                          "mt-3 flex items-start gap-2 text-sm rounded-xl p-3 border",
                          st === "rejeitada" ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100"
                        )}>
                          <MessageSquare size={14} className="shrink-0 mt-0.5" />
                          <span>{m.aprovacaoComentario}</span>
                        </div>
                      )}
                      {m.aprovadoEm && (
                        <p className="text-xs text-gray-400 mt-2">
                          {st === "aprovada" ? "Aprovada" : "Rejeitada"} em {format(m.aprovadoEm, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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
                  {isPastor ? "Nova Música" : "Submeter Música para Aprovação"}
                </h2>
                {!isPastor && (
                  <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                    <AlertCircle size={12} /> O pastor precisa aprovar antes de entrar no repertório
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
                <label className="label">Link da Cifra</label>
                <input value={form.cifraUrl ?? ""} onChange={e => setForm(f => ({ ...f, cifraUrl: e.target.value }))} className="input" placeholder="https://cifras..." />
              </div>
              <div>
                <label className="label">Link do YouTube</label>
                <input value={form.youtubeUrl ?? ""} onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))} className="input" placeholder="https://youtube.com/..." />
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
                {!isPastor && <p className="text-xs text-gray-400 mb-1">O pastor vai analisar a letra para aprovação</p>}
                <textarea value={form.letra ?? ""} onChange={e => setForm(f => ({ ...f, letra: e.target.value }))} className="input resize-none" rows={6} placeholder="Cole a letra aqui..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Salvando..." : isPastor ? "Adicionar" : "Enviar para aprovação"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
