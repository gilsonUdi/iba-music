"use client";

import { useEffect, useState } from "react";
import { corVisivel } from "@/lib/cores";
import { EsqueletoLista } from "@/components/ui/Esqueleto";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getEscalas, createEscala, updateEscala, deleteEscala, getEquipes, getMusicas, confirmarPresenca } from "@/lib/firestore";
import PaletaPicker, { PaletaResumo, nomeCor } from "@/components/escalas/PaletaPicker";
import SetlistEditor from "@/components/escalas/SetlistEditor";
import EscalaAcoes, { AvisarWhatsapp } from "@/components/escalas/EscalaAcoes";
import { resolverSetlist } from "@/lib/exportar";
import { mensagemErro } from "@/lib/errors";
import {
  CULTO_LABELS, INSTRUMENTO_LABELS, itensDoSetlist,
  type Escala, type AppUser, type TipoCulto, type Musica, type Equipe, type Instrumento, type SetlistItem,
} from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import Sheet from "@/components/ui/Sheet";
import {
  Calendar, Plus, X, Trash2, CheckCircle2, XCircle, Clock, Pencil,
  ChevronDown, ChevronUp, Music2, ListMusic, Users2, ChevronRight, Shirt, ExternalLink, PenLine,
} from "lucide-react";

import clsx from "clsx";

// ── Página principal ───────────────────────────────────────────────────────────
export default function EscalasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [todasMusicas, setTodasMusicas] = useState<Musica[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form
  const [data, setData] = useState("");
  const [tipoCulto, setTipoCulto] = useState<TipoCulto>("domingo");
  const [equipeId, setEquipeId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [selectedMusicos, setSelectedMusicos] = useState<AppUser[]>([]);
  const [selectedSetlist, setSelectedSetlist] = useState<SetlistItem[]>([]);
  const [selectedPaleta, setSelectedPaleta] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Edição de paleta de cores de escala existente
  const [editingPaletaId, setEditingPaletaId] = useState<string | null>(null);
  const [editPaleta, setEditPaleta] = useState<string[]>([]);
  const [savingPaleta, setSavingPaleta] = useState(false);

  // Edição de setlist de escala existente
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [editSetlist, setEditSetlist] = useState<SetlistItem[]>([]);
  const [editInstrucoes, setEditInstrucoes] = useState("");
  const [savingSetlist, setSavingSetlist] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [esc, eq, musicas] = await Promise.all([getEscalas(user?.igrejaId), getEquipes(user?.igrejaId), getMusicas(user?.igrejaId)]);
      setEscalas(esc);
      setEquipes(eq.filter(e => e.ativo));
      setTodasMusicas(musicas.filter(m => m.ativo !== false));
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao carregar as escalas"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // ?abrir=<id> (vindo da página da equipe) já expande a escala
    const abrir = new URLSearchParams(window.location.search).get("abrir");
    if (abrir) setExpandedId(abrir);
  }, []);

  function openNew() {
    setData("");
    setTipoCulto("domingo");
    setEquipeId("");
    setObservacoes("");
    setSelectedMusicos([]);
    setSelectedSetlist([]);
    setSelectedPaleta([]);
    setShowModal(true);
  }

  // Ao selecionar equipe: auto-preenche os músicos
  function handleEquipeChange(id: string) {
    setEquipeId(id);
    if (!id) { setSelectedMusicos([]); return; }
    const equipe = equipes.find(e => e.id === id);
    if (!equipe) return;
    // Monta lista de AppUser a partir dos UIDs da equipe
    // Vamos guardar como objetos simplificados vindos dos membros
    setSelectedMusicos([]); // será preenchido abaixo via equipe.membros
    // Busca os usuários reais — já temos getAllUsers no load, mas equipe.membros são só UIDs
    // Vamos reutilizar os dados que chegam das equipes (só temos uid na equipe)
    // A solução mais limpa: buscamos de um getEquipeMembros ou do equipe.membros
    // Como membros é string[], precisamos recuperar via getAllUsers que já chamamos
    // Mas aqui não temos todos os users, só musicos. Vamos adicionar getAllUsers no load.
    _preencherMusicosEquipe(equipe);
  }

  function _preencherMusicosEquipe(equipe: Equipe) {
    // equipe.membros = UIDs; allUsers foi carregado no load via getEquipes
    // Precisamos do mapa uid→AppUser. Guardamos em todosUsers.
    setSelectedMusicos(prev => {
      const novos = todosUsers.filter(u => equipe.membros.includes(u.uid));
      return novos;
    });
  }

  // Todos os usuários (músicos) — carregado junto com equipes
  const [todosUsers, setTodosUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    // Carrega apenas músicos para a lista
    import("@/lib/firestore").then(({ getAllMusicos }) => {
      getAllMusicos(user?.igrejaId).then(setTodosUsers);
    });
  }, []);

  async function handleCreate() {
    if (!data) { toast.error("Selecione a data do culto"); return; }
    if (selectedMusicos.length === 0) { toast.error("Selecione ao menos um músico"); return; }
    // Bloqueia duas equipes no mesmo dia para a mesma igreja
    const conflito = escalas.find(e => e.data === data && e.igrejaId === user?.igrejaId);
    if (conflito) {
      toast.error(`Já existe uma escala para ${format(parseISO(data), "dd/MM/yyyy")} (${conflito.equipeName ?? "sem equipe"}). Cada dia só pode ter uma equipe escalada.`);
      return;
    }
    setSaving(true);
    try {
      const equipe = equipes.find(e => e.id === equipeId);
      const membros = selectedMusicos.map(m => ({
        uid: m.uid,
        name: m.name,
        instrumento: (m.instrumentoPrincipal ?? m.instrumento ?? "outro") as Instrumento,
        confirmado: null as null,
      }));
      await createEscala({
        data,
        tipoCulto,
        equipeId: equipeId || undefined,
        equipeName: equipe?.name,
        membros,
        observacoes,
        setlistItens: selectedSetlist,
        setlist: selectedSetlist.map(i => i.musicaId).filter((x): x is string => !!x),
        paletaCores: selectedPaleta,
        igrejaId: user?.igrejaId,
        createdBy: user!.uid,
      });
      toast.success("Escala criada!");
      setShowModal(false);
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao criar a escala"));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmar(escalaId: string, uid: string, confirmado: boolean) {
    try {
      await confirmarPresenca(escalaId, uid, confirmado);
      toast.success(confirmado ? "Presença confirmada!" : "Ausência registrada");
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao registrar sua resposta"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta escala?")) return;
    try {
      await deleteEscala(id);
      toast.success("Escala excluída");
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao excluir a escala"));
    }
  }

  function openEditPaleta(escala: Escala) {
    setEditingPaletaId(escala.id);
    setEditPaleta(escala.paletaCores ?? []);
  }

  async function savePaleta() {
    if (!editingPaletaId) return;
    setSavingPaleta(true);
    try {
      await updateEscala(editingPaletaId, { paletaCores: editPaleta });
      toast.success("Paleta de cores atualizada!");
      setEditingPaletaId(null);
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar a paleta"));
    } finally {
      setSavingPaleta(false);
    }
  }

  function openEditSetlist(escala: Escala) {
    setEditingSetlistId(escala.id);
    setEditSetlist(itensDoSetlist(escala).map(i => {
      const m = i.musicaId ? todasMusicas.find(x => x.id === i.musicaId) : undefined;
      return { ...i, titulo: i.titulo || m?.titulo || "", artista: i.artista || m?.artista };
    }));
    setEditInstrucoes(escala.observacoes ?? "");
  }

  async function saveSetlist() {
    if (!editingSetlistId) return;
    setSavingSetlist(true);
    try {
      await updateEscala(editingSetlistId, {
        setlistItens: editSetlist,
        setlist: editSetlist.map(i => i.musicaId).filter((x): x is string => !!x),
        observacoes: editInstrucoes,
      });
      toast.success("Setlist atualizado!");
      setEditingSetlistId(null);
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar o setlist"));
    } finally {
      setSavingSetlist(false);
    }
  }

  function toggleMusico(u: AppUser) {
    setSelectedMusicos(prev =>
      prev.some(m => m.uid === u.uid)
        ? prev.filter(m => m.uid !== u.uid)
        : [...prev, u]
    );
  }

  function getMusicaById(id: string) {
    return todasMusicas.find(m => m.id === id);
  }

  // Músicos disponíveis: se equipe selecionada, mostra membros dela; senão todos
  const musicosDisponiveis = equipeId
    ? todosUsers.filter(u => equipes.find(e => e.id === equipeId)?.membros.includes(u.uid))
    : todosUsers;

  const canEdit = user?.roles?.includes("pastor") || user?.roles?.includes("diretor_musical") || user?.roles?.includes("lider_equipe");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={24} className="text-primary-500" /> Escalas
          </h1>
          <p className="text-gray-500 mt-1">{escalas.length} escalas cadastradas</p>
        </div>
        {canEdit && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nova Escala
          </button>
        )}
      </div>

      {/* Lista de escalas */}
      {loading ? (
        <EsqueletoLista />
      ) : escalas.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nenhuma escala cadastrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escalas.map(escala => {
            const meuStatus = escala.membros.find(m => m.uid === user?.uid);
            const expanded = expandedId === escala.id;
            const confirmados = escala.membros.filter(m => m.confirmado === true).length;
            const pendentes = escala.membros.filter(m => m.confirmado === null).length;
            const setlistMusicas = resolverSetlist(escala, todasMusicas);

            const equipeCor = equipes.find(e => e.id === escala.equipeId)?.cor;
            return (
              <div key={escala.id} className="card overflow-hidden" style={equipeCor ? { borderLeft: `4px solid ${equipeCor}` } : {}}>
                {/* Cabeçalho */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : escala.id)}
                >
                  {/* Data */}
                  <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: equipeCor ? `${equipeCor}22` : undefined, border: equipeCor ? `1.5px solid ${equipeCor}44` : undefined }}>
                    <span className="font-bold text-lg leading-none" style={{ color: corVisivel(equipeCor) }}>
                      {format(parseISO(escala.data), "dd")}
                    </span>
                    <span className="text-xs capitalize" style={{ color: corVisivel(equipeCor) }}>
                      {format(parseISO(escala.data), "MMM", { locale: ptBR })}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {CULTO_LABELS[escala.tipoCulto] ?? escala.tipoCulto}
                      </span>
                      {escala.equipeName && (
                        <span className="badge bg-primary-50 text-primary-600 flex items-center gap-1">
                          <Users2 size={10} /> {escala.equipeName}
                        </span>
                      )}
                      <span className="text-gray-400 text-sm">
                        {format(parseISO(escala.data), "EEEE", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-green-500" /> {confirmados} confirmados
                      </span>
                      {pendentes > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} className="text-amber-500" /> {pendentes} aguardando
                        </span>
                      )}
                      {setlistMusicas.length > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <ListMusic size={12} className="text-primary-400" /> {setlistMusicas.length} música{setlistMusicas.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <PaletaResumo cores={escala.paletaCores ?? []} />
                    </div>
                  </div>

                  {/* Minha confirmação */}
                  {meuStatus && (
                    <div className="shrink-0">
                      {meuStatus.confirmado === true && <span className="badge bg-green-100 text-green-700"><CheckCircle2 size={11} /> Confirmado</span>}
                      {meuStatus.confirmado === false && <span className="badge bg-red-100 text-red-700"><XCircle size={11} /> Recusado</span>}
                      {meuStatus.confirmado === null && <span className="badge bg-amber-100 text-amber-700"><Clock size={11} /> Pendente</span>}
                    </div>
                  )}

                  {canEdit && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(escala.id); }}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  {expanded
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </div>

                {/* Conteúdo expandido */}
                {expanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                    <EscalaAcoes escala={escala} itens={setlistMusicas} />

                    {escala.observacoes && editingSetlistId !== escala.id && (
                      <div className="text-sm text-gray-600 border-l-2 border-primary-200 pl-3">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Instruções gerais</p>
                        <p className="whitespace-pre-wrap">{escala.observacoes}</p>
                      </div>
                    )}

                    {/* Setlist */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                          <ListMusic size={13} /> Setlist
                          {setlistMusicas.length > 0 && (
                            <span className="text-gray-300 font-normal normal-case">({setlistMusicas.length})</span>
                          )}
                        </p>
                        {canEdit && editingSetlistId !== escala.id && (
                          <button
                            onClick={() => openEditSetlist(escala)}
                            className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                          >
                            <Pencil size={11} /> Editar setlist
                          </button>
                        )}
                      </div>

                      {/* Modo edição de setlist */}
                      {editingSetlistId === escala.id ? (
                        <div className="space-y-2">
                          <SetlistEditor musicas={todasMusicas} itens={editSetlist} onChange={setEditSetlist} />
                          <div>
                            <label className="label">Instruções gerais da celebração</label>
                            <textarea value={editInstrucoes} onChange={e => setEditInstrucoes(e.target.value)}
                              className="input resize-none text-sm" rows={3}
                              placeholder="Ex: ministração após a 3ª música, Santa Ceia no final..." />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setEditingSetlistId(null)}
                              className="btn-secondary text-sm flex-1"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={saveSetlist}
                              disabled={savingSetlist}
                              className="btn-primary text-sm flex-1"
                            >
                              {savingSetlist ? "Salvando..." : "Salvar setlist"}
                            </button>
                          </div>
                        </div>
                      ) : setlistMusicas.length > 0 ? (
                        <div className="space-y-1.5">
                          {setlistMusicas.map((m, idx) => (
                            <button
                              key={m.id}
                              onClick={() => m.musicaId ? router.push(`/repertorio/${m.musicaId}`) : m.link && window.open(m.link, "_blank", "noopener")}
                              className="w-full flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-all group text-left"
                            >
                              <span className="text-xs font-bold text-gray-300 w-5 text-center group-hover:text-primary-400 transition-colors">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-primary-700 transition-colors flex items-center gap-1.5">
                                  {!m.musicaId && <PenLine size={11} className="text-amber-500 shrink-0" aria-label="Avulsa" />}
                                  {m.titulo}
                                </p>
                                <p className="text-xs text-gray-400 truncate">{m.artista}</p>
                              </div>
                              {m.tomFinal && (
                                <span className="badge bg-primary-50 text-primary-600 shrink-0 group-hover:bg-primary-100">
                                  Tom: {m.tomFinal}
                                </span>
                              )}
                              {m.musicaId
                                ? <ChevronRight size={14} className="text-gray-300 group-hover:text-primary-400 shrink-0" />
                                : m.link && <ExternalLink size={13} className="text-gray-300 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Nenhuma música no setlist ainda.</p>
                      )}
                    </div>

                    {/* Paleta de cores */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                          <Shirt size={13} /> Combinação de Roupas
                        </p>
                        {canEdit && editingPaletaId !== escala.id && (
                          <button
                            onClick={() => openEditPaleta(escala)}
                            className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                          >
                            <Pencil size={11} /> Editar cores
                          </button>
                        )}
                      </div>
                      {editingPaletaId === escala.id ? (
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                          <PaletaPicker selected={editPaleta} onChange={setEditPaleta} igrejaId={user?.igrejaId} uid={user!.uid} />
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setEditingPaletaId(null)} className="btn-secondary text-sm flex-1">Cancelar</button>
                            <button onClick={savePaleta} disabled={savingPaleta} className="btn-primary text-sm flex-1">
                              {savingPaleta ? "Salvando..." : "Salvar cores"}
                            </button>
                          </div>
                        </div>
                      ) : (escala.paletaCores ?? []).length > 0 ? (
                        <div className="bg-white rounded-2xl p-4 border border-gray-100">
                          <div className="flex flex-wrap gap-2">
                            {escala.paletaCores!.map(hex => (
                              <span key={hex} className="inline-flex items-center gap-2 text-sm bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100">
                                <span className="w-4 h-4 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: hex }} />
                                {nomeCor(hex)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          {canEdit ? "Nenhuma cor definida ainda." : "Combinação de roupas não definida."}
                        </p>
                      )}
                    </div>

                    {/* Músicos */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Music2 size={13} /> Músicos
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {escala.membros.map(m => (
                          <div key={m.uid} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-primary-700 text-xs font-bold">{m.name[0]}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{m.name}</p>
                              <p className="text-xs text-gray-400">{INSTRUMENTO_LABELS[m.instrumento]}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {m.confirmado === true && <span className="badge bg-green-100 text-green-700">Confirmado</span>}
                              {m.confirmado === false && <span className="badge bg-red-100 text-red-700">Ausente</span>}
                              {m.confirmado === null && <span className="badge bg-amber-100 text-amber-700">Aguardando</span>}
                              {canEdit && m.uid !== user?.uid && (
                                <AvisarWhatsapp nome={m.name} telefone={todosUsers.find(u => u.uid === m.uid)?.telefone} escala={escala} />
                              )}

                              {m.uid === user?.uid && m.confirmado === null && (
                                <>
                                  <button
                                    onClick={() => handleConfirmar(escala.id, m.uid, true)}
                                    className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Confirmar presença"
                                  >
                                    <CheckCircle2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleConfirmar(escala.id, m.uid, false)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Informar ausência"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Nova Escala ─────────────────────────────────────────────────── */}
      {showModal && (
        <Sheet aberto onFechar={() => setShowModal(false)} className="sm:max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nova Escala</h2>
          <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Data + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data do culto *</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Tipo de culto</label>
              <select
                value={tipoCulto}
                onChange={e => setTipoCulto(e.target.value as TipoCulto)}
                className="input"
              >
                {Object.entries(CULTO_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Equipe */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Users2 size={14} className="text-primary-500" /> Equipe que vai ministrar
            </label>
            <select
              value={equipeId}
              onChange={e => handleEquipeChange(e.target.value)}
              className="input"
            >
              <option value="">Selecione a equipe...</option>
              {equipes.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            {equipeId && (
              <p className="text-xs text-primary-600 mt-1.5 flex items-center gap-1">
                <CheckCircle2 size={11} />
                Músicos da equipe carregados automaticamente
              </p>
            )}
          </div>

          {/* Músicos */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Music2 size={14} className="text-primary-500" /> Músicos escalados *
            </label>
            {musicosDisponiveis.length === 0 ? (
              <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl p-4 text-center">
                {equipeId ? "Nenhum músico cadastrado nesta equipe" : "Selecione uma equipe ou aguarde o carregamento"}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-2xl p-2">
                {musicosDisponiveis.map(m => {
                  const sel = selectedMusicos.some(x => x.uid === m.uid);
                  return (
                    <label
                      key={m.uid}
                      className={clsx(
                        "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors",
                        sel ? "bg-primary-50" : "hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleMusico(m)}
                        className="w-4 h-4 accent-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{m.name}</p>
                        <p className="text-xs text-gray-400">{INSTRUMENTO_LABELS[m.instrumento!] ?? "—"}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedMusicos.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{selectedMusicos.length} selecionado(s)</p>
            )}
          </div>

          {/* Setlist */}
          <div>
            <label className="label flex items-center gap-1.5">
              <ListMusic size={14} className="text-primary-500" /> Setlist
            </label>
            <p className="text-xs text-gray-400 mb-2">Do repertório ou avulsas — arraste para ordenar</p>
            <SetlistEditor musicas={todasMusicas} itens={selectedSetlist} onChange={setSelectedSetlist} />
          </div>

          {/* Paleta de cores */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Shirt size={14} className="text-primary-500" /> Combinação de roupas
            </label>
            <p className="text-xs text-gray-400 mb-3">Selecione os tons que a equipe vai usar</p>
            <PaletaPicker selected={selectedPaleta} onChange={setSelectedPaleta} igrejaId={user?.igrejaId} uid={user!.uid} />
          </div>

          {/* Observações */}
          <div>
            <label className="label">Instruções gerais da celebração (opcional)</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="input resize-none"
              rows={2}
              placeholder="Ex: ministração após a 3ª música, Santa Ceia no final..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">
              {saving ? "Criando..." : "Criar Escala"}
            </button>
          </div>
        </div>
        </Sheet>
      )}
    </div>
  );
}
