"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getMusicas, createMusica } from "@/lib/firestore";
import type { Musica, TomMusical } from "@/lib/types";
import { toast } from "sonner";
import { Library, Plus, Search, X, Music2, Youtube, FileText, Clock } from "lucide-react";

const TONS: TomMusical[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const EMPTY: Omit<Musica, "id" | "createdAt" | "createdBy"> = {
  titulo: "", artista: "", tom: "G", bpm: undefined, letra: "", cifraUrl: "", youtubeUrl: "", tags: [], ativo: true,
};

export default function RepertorioPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setMusicas(await getMusicas(user?.igrejaId));
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
      const ref = await createMusica({ ...form, createdBy: user!.uid, igrejaId: user?.igrejaId });
      toast.success("Música adicionada ao repertório!");
      setShowModal(false);
      router.push(`/repertorio/${ref.id}`);
    } finally {
      setSaving(false);
    }
  }

  const filtered = musicas.filter(m =>
    m.titulo.toLowerCase().includes(search.toLowerCase()) ||
    m.artista.toLowerCase().includes(search.toLowerCase()) ||
    m.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const canEdit = user?.roles?.includes("pastor") || user?.roles?.includes("lider_equipe");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library size={24} className="text-primary-500" /> Repertório
          </h1>
          <p className="text-gray-500 mt-1">{musicas.length} músicas cadastradas</p>
        </div>
        {canEdit && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Adicionar Música
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, artista ou tag..." className="input pl-9" />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Music2 size={40} className="mx-auto mb-3 opacity-40" />
          <p>{search ? "Nenhuma música encontrada" : "Nenhuma música no repertório"}</p>
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
                  {m.tags.map(t => (
                    <span key={t} className="badge bg-gray-100 text-gray-500">{t}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                {m.cifraUrl && (
                  <span className="text-xs text-primary-500 flex items-center gap-1">
                    <FileText size={11} /> Cifra
                  </span>
                )}
                {m.youtubeUrl && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <Youtube size={11} /> YouTube
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-300">Ver detalhes →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal cadastro */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">Nova Música</h2>
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
                <label className="label">Letra</label>
                <textarea value={form.letra ?? ""} onChange={e => setForm(f => ({ ...f, letra: e.target.value }))} className="input resize-none" rows={5} placeholder="Cole a letra aqui..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Salvando..." : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
