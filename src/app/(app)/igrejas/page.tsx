"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getIgrejas, createIgreja, updateIgreja, getAllUsers } from "@/lib/firestore";
import { registerUser } from "@/lib/auth";
import type { Igreja, AppUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { toast } from "sonner";
import {
  Building2, Plus, Pencil, X, Users, MapPin,
  CheckCircle2, UserPlus, ChevronDown, ChevronUp,
} from "lucide-react";
import clsx from "clsx";

type IgrejaForm = { name: string; cidade: string; estado: string };
type PastorForm = { name: string; email: string; password: string };
const EMPTY_IGREJA: IgrejaForm = { name: "", cidade: "", estado: "" };
const EMPTY_PASTOR: PastorForm = { name: "", email: "", password: "" };

export default function IgrejasPage() {
  const { user } = useAuth();
  const [igrejas, setIgrejas] = useState<Igreja[]>([]);
  const [membros, setMembros] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal Igreja
  const [showModalIgreja, setShowModalIgreja] = useState(false);
  const [editingIgreja, setEditingIgreja] = useState<Igreja | null>(null);
  const [formIgreja, setFormIgreja] = useState<IgrejaForm>(EMPTY_IGREJA);
  const [savingIgreja, setSavingIgreja] = useState(false);

  // Modal Pastor
  const [showModalPastor, setShowModalPastor] = useState(false);
  const [igrejaParaPastor, setIgrejaParaPastor] = useState<Igreja | null>(null);
  const [formPastor, setFormPastor] = useState<PastorForm>(EMPTY_PASTOR);
  const [savingPastor, setSavingPastor] = useState(false);

  const isSuperAdmin = user?.roles?.includes("super_admin");

  async function load() {
    setLoading(true);
    const [ig, mb] = await Promise.all([getIgrejas(), getAllUsers()]);
    setIgrejas(ig);
    setMembros(mb);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center text-gray-500">
        Acesso restrito ao Super Admin.
      </div>
    );
  }

  // ── Funções de Igreja ──────────────────────────────────────────────────────
  function openNewIgreja() {
    setEditingIgreja(null);
    setFormIgreja(EMPTY_IGREJA);
    setShowModalIgreja(true);
  }

  function openEditIgreja(ig: Igreja) {
    setEditingIgreja(ig);
    setFormIgreja({ name: ig.name, cidade: ig.cidade ?? "", estado: ig.estado ?? "" });
    setShowModalIgreja(true);
  }

  async function handleSaveIgreja() {
    if (!formIgreja.name.trim()) { toast.error("Nome da igreja é obrigatório"); return; }
    setSavingIgreja(true);
    try {
      if (editingIgreja) {
        await updateIgreja(editingIgreja.id, { name: formIgreja.name, cidade: formIgreja.cidade || undefined, estado: formIgreja.estado || undefined });
        toast.success("Igreja atualizada!");
      } else {
        await createIgreja({ name: formIgreja.name, cidade: formIgreja.cidade || undefined, estado: formIgreja.estado || undefined, ativo: true });
        toast.success("Igreja criada!");
      }
      setShowModalIgreja(false);
      await load();
    } finally {
      setSavingIgreja(false);
    }
  }

  // ── Funções de Pastor ──────────────────────────────────────────────────────
  function openAddPastor(ig: Igreja) {
    setIgrejaParaPastor(ig);
    setFormPastor(EMPTY_PASTOR);
    setShowModalPastor(true);
  }

  async function handleSavePastor() {
    if (!formPastor.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!formPastor.email) { toast.error("E-mail obrigatório"); return; }
    if (!formPastor.password || formPastor.password.length < 6) { toast.error("Senha mínima de 6 caracteres"); return; }
    if (!igrejaParaPastor) return;
    setSavingPastor(true);
    try {
      await registerUser(
        formPastor.email,
        formPastor.password,
        formPastor.name,
        ["pastor"],
        undefined,
        igrejaParaPastor.id,
      );
      toast.success(`Pastor ${formPastor.name} cadastrado na ${igrejaParaPastor.name}!`);
      setShowModalPastor(false);
      await load();
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      toast.error(code === "auth/email-already-in-use" ? "E-mail já cadastrado" : "Erro ao cadastrar pastor");
    } finally {
      setSavingPastor(false);
    }
  }

  // ── Helpers de exibição ───────────────────────────────────────────────────
  function getMembrosIgreja(igrejaId: string) {
    return membros.filter(m => m.igrejaId === igrejaId);
  }

  function getPastoresIgreja(igrejaId: string) {
    return getMembrosIgreja(igrejaId).filter(m => m.roles.includes("pastor"));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={24} className="text-primary-500" /> Igrejas
          </h1>
          <p className="text-gray-500 mt-1">{igrejas.length} igreja{igrejas.length !== 1 ? "s" : ""} cadastrada{igrejas.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openNewIgreja} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nova Igreja
        </button>
      </div>

      {/* Stats gerais */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-primary-600">{igrejas.length}</p>
          <p className="text-xs text-gray-500 mt-1">Igrejas</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {membros.filter(m => m.roles.includes("pastor")).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Pastores</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{membros.length}</p>
          <p className="text-xs text-gray-500 mt-1">Usuários totais</p>
        </div>
      </div>

      {/* Lista de igrejas */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      ) : igrejas.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nenhuma igreja cadastrada</p>
          <p className="text-sm mt-1">Comece criando a primeira igreja</p>
        </div>
      ) : (
        <div className="space-y-3">
          {igrejas.map(ig => {
            const expanded = expandedId === ig.id;
            const membrosIgreja = getMembrosIgreja(ig.id);
            const pastores = getPastoresIgreja(ig.id);

            return (
              <div key={ig.id} className="card overflow-hidden">
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : ig.id)}
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Building2 size={20} className="text-primary-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{ig.name}</p>
                      {ig.ativo
                        ? <span className="badge bg-green-100 text-green-700"><CheckCircle2 size={10} /> Ativa</span>
                        : <span className="badge bg-gray-100 text-gray-400">Inativa</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {(ig.cidade || ig.estado) && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin size={11} /> {[ig.cidade, ig.estado].filter(Boolean).join(" — ")}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Users size={11} /> {membrosIgreja.length} usuário{membrosIgreja.length !== 1 ? "s" : ""}
                      </span>
                      {pastores.length > 0 && (
                        <span className="text-xs text-gray-500">
                          Pastor: {pastores.map(p => p.name.split(" ")[0]).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); openAddPastor(ig); }}
                      className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                      title="Adicionar pastor"
                    >
                      <UserPlus size={15} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openEditIgreja(ig); }}
                      className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-colors"
                      title="Editar igreja"
                    >
                      <Pencil size={15} />
                    </button>
                    {expanded
                      ? <ChevronUp size={16} className="text-gray-400" />
                      : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expandido: membros por cargo */}
                {expanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
                    {membrosIgreja.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">
                        Nenhum usuário cadastrado nesta igreja ainda.
                        <button
                          onClick={() => openAddPastor(ig)}
                          className="ml-2 text-primary-500 hover:underline"
                        >
                          Adicionar pastor
                        </button>
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {membrosIgreja.map(m => (
                          <div key={m.uid} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-primary-700 text-xs font-bold">{m.name[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                              <p className="text-xs text-gray-400 truncate">{m.email}</p>
                            </div>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {m.roles.map(r => (
                                <span key={r} className="badge bg-primary-50 text-primary-600 text-[10px]">
                                  {ROLE_LABELS[r]}
                                </span>
                              ))}
                              <span className={`badge text-[10px] ${m.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                                {m.ativo ? "Ativo" : "Inativo"}
                              </span>
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

      {/* ── Modal Igreja ─────────────────────────────────────────────────────── */}
      {showModalIgreja && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">
                {editingIgreja ? "Editar Igreja" : "Nova Igreja"}
              </h2>
              <button onClick={() => setShowModalIgreja(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome da Igreja *</label>
                <input
                  value={formIgreja.name}
                  onChange={e => setFormIgreja(f => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="Ex: Igreja Batista Central"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cidade</label>
                  <input
                    value={formIgreja.cidade}
                    onChange={e => setFormIgreja(f => ({ ...f, cidade: e.target.value }))}
                    className="input"
                    placeholder="São Paulo"
                  />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <input
                    value={formIgreja.estado}
                    onChange={e => setFormIgreja(f => ({ ...f, estado: e.target.value }))}
                    className="input"
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModalIgreja(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSaveIgreja} disabled={savingIgreja} className="btn-primary flex-1">
                  {savingIgreja ? "Salvando..." : editingIgreja ? "Salvar" : "Criar Igreja"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Pastor ─────────────────────────────────────────────────────── */}
      {showModalPastor && igrejaParaPastor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Novo Pastor</h2>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <Building2 size={11} /> {igrejaParaPastor.name}
                </p>
              </div>
              <button onClick={() => setShowModalPastor(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome completo *</label>
                <input
                  value={formPastor.name}
                  onChange={e => setFormPastor(f => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="Pastor João da Silva"
                />
              </div>
              <div>
                <label className="label">E-mail *</label>
                <input
                  value={formPastor.email}
                  onChange={e => setFormPastor(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="input"
                  placeholder="pastor@igreja.com"
                />
              </div>
              <div>
                <label className="label">Senha provisória *</label>
                <input
                  value={formPastor.password}
                  onChange={e => setFormPastor(f => ({ ...f, password: e.target.value }))}
                  type="password"
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                />
                <p className="text-xs text-gray-400 mt-1">O pastor poderá alterar a senha depois</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModalPastor(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSavePastor} disabled={savingPastor} className="btn-primary flex-1">
                  {savingPastor ? "Cadastrando..." : "Cadastrar Pastor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
