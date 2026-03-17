"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getNotificacoes, createNotificacao, marcarNotificacaoLida, getAllUsers } from "@/lib/firestore";
import type { Notificacao, NotificacaoTipo, AppUser } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Bell, Plus, X, CheckCheck, AlertTriangle, Info, Calendar, Users } from "lucide-react";
import clsx from "clsx";

const TIPO_CONFIG: Record<NotificacaoTipo, { label: string; color: string; icon: React.ElementType }> = {
  aviso: { label: "Aviso", color: "bg-blue-100 text-blue-700", icon: Info },
  escala: { label: "Escala", color: "bg-green-100 text-green-700", icon: Calendar },
  ensaio: { label: "Ensaio", color: "bg-purple-100 text-purple-700", icon: Users },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-700", icon: AlertTriangle },
};

export default function NotificacoesPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [tipo, setTipo] = useState<NotificacaoTipo>("aviso");
  const [destinatarios, setDestinatarios] = useState<"todos" | string[]>("todos");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [n, u] = await Promise.all([getNotificacoes(user?.igrejaId), getAllUsers(user?.igrejaId)]);
    setNotifs(n);
    setUsers(u);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const canCreate = user?.roles?.includes("pastor") || user?.roles?.includes("lider_equipe") || user?.roles?.includes("lider_celula");

  const minhasNotifs = notifs.filter(n => {
    const dest = n.destinatarios;
    return dest === "todos" || (Array.isArray(dest) && dest.includes(user!.uid));
  });

  async function handleMarcarLida(id: string) {
    await marcarNotificacaoLida(id, user!.uid);
    await load();
  }

  async function handleCreate() {
    if (!titulo.trim() || !mensagem.trim()) { toast.error("Preencha título e mensagem"); return; }
    setSaving(true);
    try {
      await createNotificacao({ titulo, mensagem, tipo, destinatarios, createdBy: user!.uid, igrejaId: user?.igrejaId });
      toast.success("Notificação enviada!");
      setShowModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function openNew() {
    setTitulo(""); setMensagem(""); setTipo("aviso"); setDestinatarios("todos");
    setShowModal(true);
  }

  const naoLidas = minhasNotifs.filter(n => !n.lidos.includes(user!.uid)).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell size={24} className="text-primary-500" /> Notificações
          </h1>
          <p className="text-gray-500 mt-1">
            {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}` : "Tudo em dia!"}
          </p>
        </div>
        {canCreate && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Enviar Aviso
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      ) : minhasNotifs.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nenhuma notificação</p>
        </div>
      ) : (
        <div className="space-y-3">
          {minhasNotifs.map(n => {
            const lida = n.lidos.includes(user!.uid);
            const TipoIcon = TIPO_CONFIG[n.tipo].icon;
            const autor = users.find(u => u.uid === n.createdBy);

            return (
              <div key={n.id} className={clsx("card p-5 transition-all", !lida && "border-l-4 border-l-primary-500")}>
                <div className="flex items-start gap-4">
                  <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", TIPO_CONFIG[n.tipo].color.replace("text-", "text-").replace("bg-", "bg-"))}>
                    <TipoIcon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx("badge", TIPO_CONFIG[n.tipo].color)}>{TIPO_CONFIG[n.tipo].label}</span>
                      {!lida && <span className="badge bg-primary-100 text-primary-700">Nova</span>}
                    </div>
                    <h3 className={clsx("font-semibold mt-1", lida ? "text-gray-600" : "text-gray-900")}>
                      {n.titulo}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{n.mensagem}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-gray-400">
                        {autor?.name} · {format(n.createdAt, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {!lida && (
                        <button
                          onClick={() => handleMarcarLida(n.id)}
                          className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1"
                        >
                          <CheckCheck size={12} /> Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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
              <h2 className="font-bold text-gray-900 text-lg">Enviar Notificação</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as NotificacaoTipo)} className="input">
                  {Object.entries(TIPO_CONFIG).map(([v, c]) => (
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Título</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} className="input" placeholder="Ex: Ensaio desta sexta" />
              </div>
              <div>
                <label className="label">Mensagem</label>
                <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} className="input resize-none" rows={4} placeholder="Detalhes da notificação..." />
              </div>
              <div>
                <label className="label">Destinatários</label>
                <select
                  value={typeof destinatarios === "string" ? "todos" : "selecionados"}
                  onChange={e => setDestinatarios(e.target.value === "todos" ? "todos" : [])}
                  className="input"
                >
                  <option value="todos">Todos os membros</option>
                  <option value="selecionados">Membros selecionados</option>
                </select>
              </div>
              {Array.isArray(destinatarios) && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {users.map(u => (
                    <label key={u.uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={destinatarios.includes(u.uid)}
                        onChange={e => {
                          setDestinatarios(prev =>
                            Array.isArray(prev)
                              ? e.target.checked ? [...prev, u.uid] : prev.filter(x => x !== u.uid)
                              : [u.uid]
                          );
                        }}
                        className="w-4 h-4 accent-primary-500"
                      />
                      <span className="text-sm text-gray-700">{u.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
