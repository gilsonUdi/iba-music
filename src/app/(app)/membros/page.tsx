"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAllUsers, updateUser, getEquipes, updateEquipe } from "@/lib/firestore";
import type { Equipe } from "@/lib/types";
import { registerUser } from "@/lib/auth";
import {
  INSTRUMENTO_LABELS, ROLE_LABELS, primaryRoleLabel,
  type AppUser, type Instrumento, type UserRole,
} from "@/lib/types";
import { toast } from "sonner";
import {
  Users, Users2, Plus, Search, Pencil, ToggleLeft, ToggleRight, X, Mail, Phone, UserCheck, Star,
} from "lucide-react";
import clsx from "clsx";

const ALL_ROLES: UserRole[] = ["pastor", "lider_equipe", "lider_celula", "musico"];

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: "bg-orange-100 text-orange-700",
  pastor: "bg-red-100 text-red-700",
  lider_equipe: "bg-blue-100 text-blue-700",
  lider_celula: "bg-purple-100 text-purple-700",
  musico: "bg-gray-100 text-gray-600",
};

interface FormData {
  name: string;
  email: string;
  password: string;
  roles: UserRole[];
  instrumentos: Instrumento[];
  instrumentoPrincipal: Instrumento | "";
  liderUid: string;
  telefone: string;
}

const EMPTY: FormData = {
  name: "", email: "", password: "",
  roles: ["musico"],
  instrumentos: [], instrumentoPrincipal: "", liderUid: "", telefone: "",
};

export default function MembrosPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [minhaEquipe, setMinhaEquipe] = useState<Equipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("todos");

  async function loadUsers() {
    setLoading(true);
    const [data, equipes] = await Promise.all([
      getAllUsers(user?.igrejaId),
      getEquipes(user?.igrejaId),
    ]);
    setUsers(data);
    // Líder de equipe: descobre qual equipe ele lidera
    if (user?.roles?.includes("lider_equipe") && !user?.roles?.includes("pastor")) {
      const eq = equipes.find(e => e.liderId === user.uid) ?? null;
      setMinhaEquipe(eq);
    }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  function openNew() {
    setEditingUser(null);
    setForm(EMPTY);
    setShowModal(true);
  }

  function openEdit(u: AppUser) {
    setEditingUser(u);
    const instrs = u.instrumentos?.length
      ? u.instrumentos
      : u.instrumento ? [u.instrumento] : [];
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      roles: u.roles,
      instrumentos: instrs,
      instrumentoPrincipal: u.instrumentoPrincipal ?? u.instrumento ?? "",
      liderUid: u.liderUid ?? "",
      telefone: u.telefone ?? "",
    });
    setShowModal(true);
  }

  function toggleInstrumento(instr: Instrumento) {
    setForm(f => {
      const has = f.instrumentos.includes(instr);
      const novos = has ? f.instrumentos.filter(i => i !== instr) : [...f.instrumentos, instr];
      // se removeu o principal, limpa
      const principal = has && f.instrumentoPrincipal === instr ? "" : f.instrumentoPrincipal;
      // se só tem um, define como principal automaticamente
      const autoP = novos.length === 1 ? novos[0] : principal;
      return { ...f, instrumentos: novos, instrumentoPrincipal: autoP };
    });
  }

  function toggleRole(role: UserRole) {
    setForm(f => {
      const has = f.roles.includes(role);
      if (has && f.roles.length === 1) return f; // mínimo 1 role
      return {
        ...f,
        roles: has ? f.roles.filter(r => r !== role) : [...f.roles, role],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.name.length < 2) { toast.error("Nome obrigatório (mínimo 2 caracteres)"); return; }
    if (!form.email) { toast.error("E-mail inválido"); return; }
    if (form.roles.length === 0) { toast.error("Selecione ao menos um cargo"); return; }

    setSaving(true);
    try {
      const principal = (form.instrumentoPrincipal || form.instrumentos[0]) as Instrumento | undefined;
      const extras = {
        instrumento: principal,
        instrumentos: form.instrumentos.length > 0 ? form.instrumentos : undefined,
        instrumentoPrincipal: principal,
        telefone: form.telefone || undefined,
      };
      if (editingUser) {
        await updateUser(editingUser.uid, {
          name: form.name,
          roles: form.roles,
          liderUid: form.liderUid || undefined,
          ...extras,
        });
        toast.success("Membro atualizado!");
      } else {
        if (!form.password || form.password.length < 6) { toast.error("Senha obrigatória (mínimo 6 caracteres)"); setSaving(false); return; }
        const newUser = await registerUser(form.email, form.password, form.name, form.roles, form.liderUid || undefined, user?.igrejaId, extras);
        // Lider de equipe: adiciona automaticamente à sua equipe
        if (minhaEquipe && !user?.roles?.includes("pastor")) {
          await updateEquipe(minhaEquipe.id, {
            membros: [...minhaEquipe.membros, newUser.uid],
          });
          setMinhaEquipe(prev => prev ? { ...prev, membros: [...prev.membros, newUser.uid] } : prev);
        }
        toast.success("Membro cadastrado!");
      }
      setShowModal(false);
      await loadUsers();
    } catch (e: unknown) {
      const msg = (e as { code?: string })?.code === "auth/email-already-in-use"
        ? "E-mail já cadastrado"
        : "Erro ao salvar membro";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(u: AppUser) {
    await updateUser(u.uid, { ativo: !u.ativo });
    toast.success(u.ativo ? "Membro desativado" : "Membro ativado");
    await loadUsers();
  }

  const isPastor = user?.roles?.includes("pastor");
  const isLiderEquipe = user?.roles?.includes("lider_equipe") && !user?.roles?.includes("pastor");
  const canManage = isPastor || isLiderEquipe;
  const isOnlyMusico = !isPastor && !isLiderEquipe && !user?.roles?.includes("lider_celula");

  // Lider de equipe vê apenas os membros da sua equipe
  const usersVisiveis = isLiderEquipe && minhaEquipe
    ? users.filter(u => minhaEquipe.membros.includes(u.uid) || u.uid === user?.uid)
    : users;

  // Líder de Célula disponíveis para associar ao músico
  const lideresCelula = users.filter(u => u.roles.includes("lider_celula"));

  const filtered = usersVisiveis.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "todos" || u.roles.includes(filterRole as UserRole);
    return matchSearch && matchRole;
  });

  if (isOnlyMusico) {
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center text-gray-500">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  // Lider de equipe só pode atribuir o cargo músico
  const rolesDisponiveis: UserRole[] = isPastor
    ? ALL_ROLES
    : ["musico"];

  const showsInstrumento = form.roles.includes("musico");
  const showsLider = form.roles.includes("musico");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-primary-500" /> Membros
          </h1>
          <p className="text-gray-500 mt-1">
            {usersVisiveis.filter(u => u.ativo).length} membros ativos
            {isLiderEquipe && minhaEquipe && (
              <span className="ml-2 text-xs text-primary-500">· {minhaEquipe.name}</span>
            )}
          </p>
        </div>
        {canManage && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Novo Membro
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="input pl-9"
          />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input w-auto">
          <option value="todos">Todos os cargos</option>
          {ALL_ROLES.map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum membro encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cargos</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Instrumento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Líder de Célula</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  {canManage && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => {
                  const lider = lideresCelula.find(l => l.uid === u.liderUid);
                  return (
                    <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-primary-700 font-semibold text-xs">{u.name[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Mail size={10} /> {u.email}
                            </p>
                            {u.telefone && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Phone size={10} /> {u.telefone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map(r => (
                            <span key={r} className={`badge text-xs ${ROLE_COLORS[r]}`}>
                              {ROLE_LABELS[r]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {u.instrumentos?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {u.instrumentos.map(i => (
                              <span key={i} className={clsx("badge text-xs", i === (u.instrumentoPrincipal ?? u.instrumento) ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500")}>
                                {INSTRUMENTO_LABELS[i]}
                              </span>
                            ))}
                          </div>
                        ) : u.instrumento ? INSTRUMENTO_LABELS[u.instrumento] : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {lider ? (
                          <span className="flex items-center gap-1">
                            <UserCheck size={13} className="text-primary-500" />
                            {lider.name.split(" ")[0]}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${u.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            {isPastor && (
                              <button
                                onClick={() => toggleAtivo(u)}
                                className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                              >
                                {u.ativo
                                  ? <ToggleRight size={16} className="text-green-500" />
                                  : <ToggleLeft size={16} />}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">
                {editingUser ? "Editar Membro" : "Novo Membro"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Aviso lider de equipe */}
              {isLiderEquipe && minhaEquipe && !editingUser && (
                <div className="bg-primary-50 border border-primary-100 rounded-2xl px-4 py-3 text-sm text-primary-700 flex items-center gap-2">
                  <Users2 size={15} className="shrink-0" />
                  Este membro será adicionado automaticamente à <strong>{minhaEquipe.name}</strong>
                </div>
              )}
              {/* Nome */}
              <div>
                <label className="label">Nome completo</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="João da Silva"
                />
              </div>

              {/* Email */}
              <div>
                <label className="label">E-mail</label>
                <input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="input"
                  disabled={!!editingUser}
                  placeholder="joao@email.com"
                />
              </div>

              {/* Senha (apenas novo) */}
              {!editingUser && (
                <div>
                  <label className="label">Senha</label>
                  <input
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    type="password"
                    className="input"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

              {/* Telefone */}
              <div>
                <label className="label">Telefone</label>
                <input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  className="input"
                  placeholder="(11) 99999-9999"
                />
              </div>

              {/* Cargos (multi-select checkboxes) */}
              <div>
                <label className="label">Cargos</label>
                <p className="text-xs text-gray-400 mb-2">Uma pessoa pode acumular mais de um cargo</p>
                <div className="grid grid-cols-2 gap-2">
                  {rolesDisponiveis.map(role => (
                    <label
                      key={role}
                      className={clsx(
                        "flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all select-none",
                        form.roles.includes(role)
                          ? "border-primary-300 bg-primary-50"
                          : "border-gray-100 bg-gray-50 hover:border-gray-200"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="accent-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Instrumentos (se músico) */}
              {showsInstrumento && (
                <div>
                  <label className="label">Instrumentos</label>
                  <p className="text-xs text-gray-400 mb-2">Selecione todos que toca. Clique em ★ para definir o principal.</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(INSTRUMENTO_LABELS) as [Instrumento, string][]).map(([v, l]) => {
                      const sel = form.instrumentos.includes(v);
                      const isPrincipal = form.instrumentoPrincipal === v;
                      return (
                        <div
                          key={v}
                          className={clsx(
                            "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none",
                            sel ? "border-primary-300 bg-primary-50" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                          )}
                          onClick={() => toggleInstrumento(v)}
                        >
                          <input type="checkbox" readOnly checked={sel} className="accent-primary-500 w-4 h-4 pointer-events-none" />
                          <span className="text-sm text-gray-700 flex-1">{l}</span>
                          {sel && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, instrumentoPrincipal: v })); }}
                              title="Definir como principal"
                              className={clsx("transition-colors", isPrincipal ? "text-amber-500" : "text-gray-300 hover:text-amber-400")}
                            >
                              <Star size={13} fill={isPrincipal ? "currentColor" : "none"} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {form.instrumentos.length > 1 && !form.instrumentoPrincipal && (
                    <p className="text-xs text-amber-600 mt-1.5">Clique em ★ para definir o instrumento principal</p>
                  )}
                  {form.instrumentoPrincipal && (
                    <p className="text-xs text-primary-600 mt-1.5">Principal: {INSTRUMENTO_LABELS[form.instrumentoPrincipal as Instrumento]}</p>
                  )}
                </div>
              )}

              {/* Líder de Célula (se músico) */}
              {showsLider && (
                <div>
                  <label className="label">Líder de Célula</label>
                  <select
                    value={form.liderUid}
                    onChange={e => setForm(f => ({ ...f, liderUid: e.target.value }))}
                    className="input"
                  >
                    <option value="">Sem líder associado</option>
                    {lideresCelula.map(l => (
                      <option key={l.uid} value={l.uid}>{l.name}</option>
                    ))}
                  </select>
                  {lideresCelula.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Nenhum Líder de Célula cadastrado ainda.</p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? "Salvando..." : editingUser ? "Salvar alterações" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
