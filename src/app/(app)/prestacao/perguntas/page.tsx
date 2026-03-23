"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAllPrestacaoPerguntas, createPrestacaoPergunta,
  updatePrestacaoPergunta, deletePrestacaoPergunta,
} from "@/lib/firestore";
import type { PrestacaoPergunta, TipoPergunta, OpcaoPergunta, PublicoAlvoPergunta } from "@/lib/types";
import { PUBLICO_ALVO_LABELS } from "@/lib/types";
import { toast } from "sonner";
import {
  ClipboardCheck, Plus, X, Pencil, Trash2, GripVertical,
  ToggleLeft, ToggleRight, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TIPO_LABELS: Record<TipoPergunta, string> = {
  texto: "Texto livre",
  escala: "Escala 1–10",
  sim_nao: "Sim / Não",
  multipla_escolha: "Múltipla escolha",
};

export default function PerguntasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [perguntas, setPerguntas] = useState<PrestacaoPergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPergunta, setEditingPergunta] = useState<PrestacaoPergunta | null>(null);

  // Form
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoPergunta>("texto");
  const [obrigatoria, setObrigatoria] = useState(true);
  const [publicoAlvo, setPublicoAlvo] = useState<PublicoAlvoPergunta>("todos");
  const [opcoes, setOpcoes] = useState<OpcaoPergunta[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && !user.roles?.includes("pastor")) { router.replace("/prestacao"); return; }
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    setPerguntas(await getAllPrestacaoPerguntas());
    setLoading(false);
  }

  function openNew() {
    setEditingPergunta(null);
    setTexto(""); setTipo("texto"); setObrigatoria(true); setPublicoAlvo("todos"); setOpcoes([]);
    setShowModal(true);
  }

  function openEdit(p: PrestacaoPergunta) {
    setEditingPergunta(p);
    setTexto(p.texto); setTipo(p.tipo); setObrigatoria(p.obrigatoria);
    setPublicoAlvo(p.publicoAlvo ?? "todos");
    setOpcoes(p.opcoes ?? []);
    setShowModal(true);
  }

  async function handleSave() {
    if (!texto.trim()) { toast.error("Digite o texto da pergunta"); return; }
    if (tipo === "multipla_escolha" && opcoes.length < 2) {
      toast.error("Adicione ao menos 2 opções para múltipla escolha");
      return;
    }
    setSaving(true);
    try {
      if (editingPergunta) {
        await updatePrestacaoPergunta(editingPergunta.id, { texto, tipo, obrigatoria, publicoAlvo, opcoes: tipo === "multipla_escolha" ? opcoes : [] });
        toast.success("Pergunta atualizada!");
      } else {
        await createPrestacaoPergunta({
          texto, tipo, obrigatoria, publicoAlvo, opcoes: tipo === "multipla_escolha" ? opcoes : [],
          ordem: perguntas.length + 1, ativa: true, createdBy: user!.uid,
        });
        toast.success("Pergunta criada!");
      }
      setShowModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta pergunta?")) return;
    await deletePrestacaoPergunta(id);
    toast.success("Pergunta excluída");
    await load();
  }

  async function toggleAtiva(p: PrestacaoPergunta) {
    await updatePrestacaoPergunta(p.id, { ativa: !p.ativa });
    toast.success(p.ativa ? "Pergunta desativada" : "Pergunta ativada");
    await load();
  }

  function addOpcao() {
    setOpcoes(prev => [...prev, { id: crypto.randomUUID(), label: "" }]);
  }

  function updateOpcao(id: string, label: string) {
    setOpcoes(prev => prev.map(o => o.id === id ? { ...o, label } : o));
  }

  function removeOpcao(id: string) {
    setOpcoes(prev => prev.filter(o => o.id !== id));
  }

  if (!user?.roles?.includes("pastor")) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/prestacao" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4">
          <ChevronLeft size={14} /> Prestação de contas
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck size={24} className="text-primary-500" /> Perguntas do Formulário
            </h1>
            <p className="text-gray-500 mt-1">{perguntas.filter(p => p.ativa).length} perguntas ativas</p>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nova Pergunta
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      ) : perguntas.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nenhuma pergunta cadastrada</p>
          <p className="text-sm mt-1">Clique em "Nova Pergunta" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {perguntas.map((p, i) => (
            <div key={p.id} className={`card p-5 ${!p.ativa ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <GripVertical size={16} className="text-gray-300" />
                  <span className="text-xs font-medium text-gray-400 w-5 text-center">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge bg-gray-100 text-gray-600">{TIPO_LABELS[p.tipo]}</span>
                    {p.obrigatoria && <span className="badge bg-red-100 text-red-600">Obrigatória</span>}
                    {(p.publicoAlvo === "casados") && <span className="badge bg-rose-100 text-rose-600">Apenas casados</span>}
                    {(p.publicoAlvo === "solteiros") && <span className="badge bg-sky-100 text-sky-600">Apenas solteiros</span>}
                    {!p.ativa && <span className="badge bg-gray-100 text-gray-400">Inativa</span>}
                  </div>
                  <p className="font-medium text-gray-900">{p.texto}</p>
                  {p.opcoes && p.opcoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.opcoes.map(o => (
                        <span key={o.id} className="badge bg-primary-50 text-primary-600">{o.label}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleAtiva(p)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title={p.ativa ? "Desativar" : "Ativar"}>
                    {p.ativa ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">
                {editingPergunta ? "Editar Pergunta" : "Nova Pergunta"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Pergunta</label>
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  className="input resize-none"
                  rows={3}
                  placeholder="Ex: Como está sua vida devocional este mês?"
                />
              </div>
              <div>
                <label className="label">Tipo de resposta</label>
                <select value={tipo} onChange={e => { setTipo(e.target.value as TipoPergunta); setOpcoes([]); }} className="input">
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Público alvo</label>
                <select value={publicoAlvo} onChange={e => setPublicoAlvo(e.target.value as PublicoAlvoPergunta)} className="input">
                  {(Object.entries(PUBLICO_ALVO_LABELS) as [PublicoAlvoPergunta, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {tipo === "multipla_escolha" && (
                <div>
                  <label className="label">Opções de resposta</label>
                  <div className="space-y-2">
                    {opcoes.map(o => (
                      <div key={o.id} className="flex gap-2">
                        <input
                          value={o.label}
                          onChange={e => updateOpcao(o.id, e.target.value)}
                          className="input flex-1"
                          placeholder="Opção..."
                        />
                        <button onClick={() => removeOpcao(o.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={addOpcao} className="text-sm text-primary-500 hover:text-primary-700 flex items-center gap-1">
                      <Plus size={13} /> Adicionar opção
                    </button>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={obrigatoria}
                  onChange={e => setObrigatoria(e.target.checked)}
                  className="w-4 h-4 accent-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Resposta obrigatória</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Salvando..." : editingPergunta ? "Salvar" : "Criar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
