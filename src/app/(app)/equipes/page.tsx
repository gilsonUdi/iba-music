"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getEquipes, createEquipe, updateEquipe, deleteEquipe, getAllUsers, updateUser } from "@/lib/firestore";
import type { Equipe, AppUser } from "@/lib/types";
import { primaryRoleLabel, INSTRUMENTO_LABELS } from "@/lib/types";
import { toast } from "sonner";
import { Users2, Plus, Pencil, Trash2, X, UserCheck, ChevronDown, FileText, ExternalLink, Headphones } from "lucide-react";
import clsx from "clsx";

type Form = Omit<Equipe, "id" | "createdAt" | "createdBy" | "liderName">;
const EMPTY: Form = { name: "", descricao: "", liderId: "", membros: [], cifraUrl: "", vsUrl: "", cor: undefined, ativo: true };

const CORES_EQUIPE = [
  { label: "Violeta",      hex: "#7c3aed" },
  { label: "Azul",         hex: "#2563eb" },
  { label: "Ciano",        hex: "#0891b2" },
  { label: "Verde",        hex: "#16a34a" },
  { label: "Lima",         hex: "#65a30d" },
  { label: "Amarelo",      hex: "#d97706" },
  { label: "Laranja",      hex: "#ea580c" },
  { label: "Vermelho",     hex: "#dc2626" },
  { label: "Rosa",         hex: "#db2777" },
  { label: "Cinza",        hex: "#4b5563" },
  { label: "Preto",        hex: "#111827" },
  { label: "Teal",         hex: "#0d9488" },
];

export default function EquipesPage() {
  const { user } = useAuth();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEquipe, setEditingEquipe] = useState<Equipe | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const canEdit = user?.roles?.includes("pastor") || user?.roles?.includes("lider_equipe");

  async function load() {
    setLoading(true);
    const [eq, us] = await Promise.all([getEquipes(user?.igrejaId), getAllUsers(user?.igrejaId)]);
    setEquipes(eq);
    setUsers(us);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditingEquipe(null);
    setForm(EMPTY);
    setShowModal(true);
  }

  function openEdit(e: Equipe) {
    setEditingEquipe(e);
    setForm({ name: e.name, descricao: e.descricao, liderId: e.liderId, membros: e.membros, cifraUrl: e.cifraUrl ?? "", vsUrl: e.vsUrl ?? "", cor: e.cor, ativo: e.ativo });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name) { toast.error("Nome da equipe é obrigatório"); return; }
    if (!form.liderId) { toast.error("Selecione um líder"); return; }
    setSaving(true);
    try {
      const lider = users.find(u => u.uid === form.liderId);
      const liderName = lider?.name ?? "";
      // Auto-promove o líder selecionado para lider_equipe se ainda não tiver esse papel
      if (lider && !lider.roles.includes("lider_equipe")) {
        await updateUser(lider.uid, { roles: [...lider.roles, "lider_equipe"] });
        toast.info(`${lider.name} recebeu o cargo Líder de Equipe automaticamente`);
      }
      if (editingEquipe) {
        await updateEquipe(editingEquipe.id, { ...form, liderName });
        toast.success("Equipe atualizada!");
      } else {
        await createEquipe({ ...form, liderName, igrejaId: user?.igrejaId, createdBy: user!.uid });
        toast.success("Equipe criada!");
      }
      setShowModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta equipe?")) return;
    await deleteEquipe(id);
    toast.success("Equipe excluída");
    await load();
  }

  function toggleMembro(uid: string) {
    setForm(f => ({
      ...f,
      membros: f.membros.includes(uid)
        ? f.membros.filter(m => m !== uid)
        : [...f.membros, uid],
    }));
  }

  // Qualquer usuário ativo pode ser líder — o cargo é atribuído automaticamente ao salvar
  const todosUsuarios = users.filter(u => u.ativo);
  const musicos = users.filter(u => u.roles.includes("musico"));

  function getMembrosInfo(equipe: Equipe) {
    return equipe.membros.map(uid => users.find(u => u.uid === uid)).filter(Boolean) as AppUser[];
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users2 size={24} className="text-primary-500" /> Equipes
          </h1>
          <p className="text-gray-500 mt-1">{equipes.length} equipe{equipes.length !== 1 ? "s" : ""} de louvor</p>
        </div>
        {canEdit && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nova Equipe
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      ) : equipes.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Users2 size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nenhuma equipe cadastrada</p>
          {canEdit && <p className="text-sm mt-1">Crie a primeira equipe clicando em "Nova Equipe"</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {equipes.map(eq => {
            const membrosInfo = getMembrosInfo(eq);
            const isExpanded = expanded === eq.id;
            return (
              <div key={eq.id} className="card overflow-hidden" style={eq.cor ? { borderLeft: `4px solid ${eq.cor}` } : {}}>
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : eq.id)}
                >
                  {/* Ícone */}
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: eq.cor ? `${eq.cor}22` : undefined, border: eq.cor ? `1.5px solid ${eq.cor}44` : undefined }}>
                    <Users2 size={20} style={{ color: eq.cor ?? "#7c3aed" }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{eq.name}</p>
                      {!eq.ativo && <span className="badge bg-gray-100 text-gray-400 text-xs">Inativa</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <UserCheck size={13} /> {eq.liderName}
                      </span>
                      <span className="text-sm text-gray-400">
                        {eq.membros.length} músico{eq.membros.length !== 1 ? "s" : ""}
                      </span>
                      {eq.cifraUrl && (
                        <span className="badge bg-primary-50 text-primary-600 text-[10px]">
                          <FileText size={9} /> Cifra
                        </span>
                      )}
                      {eq.vsUrl && (
                        <span className="badge bg-green-50 text-green-600 text-[10px]">
                          <Headphones size={9} /> VS
                        </span>
                      )}
                    </div>
                    {eq.descricao && <p className="text-xs text-gray-400 mt-0.5 truncate">{eq.descricao}</p>}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(eq); }}
                          className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(eq.id); }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                    <ChevronDown
                      size={16}
                      className={clsx("text-gray-400 transition-transform", isExpanded && "rotate-180")}
                    />
                  </div>
                </div>

                {/* Membros expandidos */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
                    {/* Links externos */}
                    <div className="flex flex-wrap gap-2">
                      {eq.cifraUrl && (
                        <a
                          href={eq.cifraUrl}
                          target="_blank"
                          rel="noopener"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-2 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
                        >
                          <FileText size={14} /> Cifras da Equipe
                          <ExternalLink size={11} className="opacity-60" />
                        </a>
                      )}
                      {eq.vsUrl && (
                        <a
                          href={eq.vsUrl}
                          target="_blank"
                          rel="noopener"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
                        >
                          <Headphones size={14} /> VS / Playbacks
                          <ExternalLink size={11} className="opacity-60" />
                        </a>
                      )}
                    </div>
                    {/* Músicos */}
                    {membrosInfo.length === 0 ? (
                      <p className="text-sm text-gray-400">Nenhum músico nesta equipe ainda.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {membrosInfo.map(m => (
                          <div key={m.uid} className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5">
                            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-primary-700 font-semibold text-xs">{m.name[0]}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm text-gray-700">{m.name}</span>
                              {(m.instrumentoPrincipal ?? m.instrumento) && (
                                <p className="text-xs text-gray-400 leading-none mt-0.5">
                                  {INSTRUMENTO_LABELS[(m.instrumentoPrincipal ?? m.instrumento)!]}
                                  {m.instrumentos && m.instrumentos.length > 1 && (
                                    <span className="ml-1 text-gray-300">+{m.instrumentos.length - 1}</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">
                {editingEquipe ? "Editar Equipe" : "Nova Equipe"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome da Equipe *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="Ex: Louvor Principal, Equipe Jovem..."
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input
                  value={form.descricao ?? ""}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="input"
                  placeholder="Descrição opcional"
                />
              </div>
              <div>
                <label className="label">Link das Cifras (Google Docs)</label>
                <p className="text-xs text-gray-400 mb-1.5">Um único arquivo com as cifras de todas as músicas da equipe</p>
                <input
                  value={form.cifraUrl ?? ""}
                  onChange={e => setForm(f => ({ ...f, cifraUrl: e.target.value }))}
                  className="input"
                  placeholder="https://docs.google.com/document/..."
                />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Headphones size={14} className="text-green-500" /> Link dos VS / Playbacks (OneDrive)</label>
                <p className="text-xs text-gray-400 mb-1.5">Pasta do OneDrive com os arquivos MP3 de stems da equipe</p>
                <input
                  value={form.vsUrl ?? ""}
                  onChange={e => setForm(f => ({ ...f, vsUrl: e.target.value }))}
                  className="input"
                  placeholder="https://onedrive.live.com/..."
                />
              </div>
              <div>
                <label className="label">Cor da Equipe</label>
                <p className="text-xs text-gray-400 mb-2">Usada para identificar a equipe nas escalas</p>
                <div className="flex flex-wrap gap-2">
                  {CORES_EQUIPE.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => setForm(f => ({ ...f, cor: f.cor === c.hex ? undefined : c.hex }))}
                      className={clsx(
                        "w-8 h-8 rounded-full transition-all",
                        form.cor === c.hex ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-110 opacity-70 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
                {form.cor && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Cor selecionada: <span className="font-medium">{CORES_EQUIPE.find(c => c.hex === form.cor)?.label}</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, cor: undefined }))} className="ml-2 text-red-400 hover:text-red-600">remover</button>
                  </p>
                )}
              </div>
              <div>
                <label className="label">Líder Responsável *</label>
                <p className="text-xs text-gray-400 mb-1.5">O cargo <strong>Líder de Equipe</strong> será atribuído automaticamente ao salvar</p>
                <select
                  value={form.liderId}
                  onChange={e => setForm(f => ({ ...f, liderId: e.target.value }))}
                  className="input"
                >
                  <option value="">Selecione um líder...</option>
                  {todosUsuarios.map(l => (
                    <option key={l.uid} value={l.uid}>{l.name} ({primaryRoleLabel(l.roles)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Músicos da Equipe</label>
                <p className="text-xs text-gray-400 mb-2">Selecione um ou mais músicos</p>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-100 rounded-2xl p-2">
                  {musicos.length === 0 ? (
                    <p className="text-sm text-gray-400 p-2">Nenhum músico cadastrado ainda.</p>
                  ) : musicos.map(m => (
                    <label
                      key={m.uid}
                      className={clsx(
                        "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors",
                        form.membros.includes(m.uid) ? "bg-primary-50" : "hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={form.membros.includes(m.uid)}
                        onChange={() => toggleMembro(m.uid)}
                        className="accent-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{m.name}</p>
                        {m.instrumento && <p className="text-xs text-gray-400">{m.instrumento}</p>}
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{form.membros.length} músico{form.membros.length !== 1 ? "s" : ""} selecionado{form.membros.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">Equipe ativa</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.ativo ? "bg-primary-500" : "bg-gray-200"
                  )}
                >
                  <span className={clsx(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    form.ativo ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Salvando..." : editingEquipe ? "Salvar" : "Criar Equipe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
