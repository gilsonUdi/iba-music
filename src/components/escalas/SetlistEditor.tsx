"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Search, X, Music2, PenLine } from "lucide-react";
import clsx from "clsx";
import { TONS } from "@/components/musica/MusicaCampos";
import type { Musica, SetlistItem } from "@/lib/types";

function novoId() {
  return Math.random().toString(36).slice(2, 10);
}

function ItemOrdenavel({
  item, indice, musica, onChange, onRemove,
}: {
  item: SetlistItem;
  indice: number;
  musica?: Musica;
  onChange: (i: SetlistItem) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const titulo = item.titulo || musica?.titulo || "(música removida)";
  const artista = item.artista || musica?.artista;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("flex items-center gap-2 bg-white rounded-xl px-2 py-2 border",
        isDragging ? "border-primary-300 shadow-lg z-10 relative" : "border-gray-100")}
    >
      <button type="button" {...attributes} {...listeners}
        className="p-1.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none" aria-label={`Arrastar ${titulo}`}>
        <GripVertical size={16} />
      </button>
      <span className="text-xs font-bold text-gray-300 w-4 text-center">{indice + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
          {!item.musicaId && <PenLine size={11} className="text-amber-500 shrink-0" aria-label="Avulsa" />}
          {titulo}
        </p>
        {artista && <p className="text-xs text-gray-400 truncate">{artista}</p>}
      </div>
      <select
        value={item.tom ?? ""}
        onChange={e => onChange({ ...item, tom: e.target.value || undefined })}
        className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white"
        title="Tom neste culto"
      >
        <option value="">{musica?.tom ? `Tom ${musica.tom}` : "Tom"}</option>
        {TONS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <button type="button" onClick={onRemove} className="p-1.5 text-gray-300 hover:text-red-500" aria-label={`Remover ${titulo}`}>
        <X size={14} />
      </button>
    </div>
  );
}

/** Editor do setlist: músicas do repertório + avulsas, reordenáveis por arrastar. */
export default function SetlistEditor({
  musicas,
  itens,
  onChange,
}: {
  musicas: Musica[];
  itens: SetlistItem[];
  onChange: (itens: SetlistItem[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [avulsa, setAvulsa] = useState(false);
  const [av, setAv] = useState({ titulo: "", artista: "", link: "" });
  const ref = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = itens.findIndex(i => i.id === active.id);
    const para = itens.findIndex(i => i.id === over.id);
    onChange(arrayMove(itens, de, para));
  }

  const jaNoSetlist = new Set(itens.map(i => i.musicaId).filter(Boolean));
  const termo = busca.trim().toLowerCase();
  const opcoes = musicas.filter(m =>
    !jaNoSetlist.has(m.id) &&
    (!termo || m.titulo.toLowerCase().includes(termo) || m.artista.toLowerCase().includes(termo))
  ).slice(0, 50);

  function adicionarMusica(m: Musica) {
    onChange([...itens, { id: novoId(), musicaId: m.id, titulo: m.titulo, artista: m.artista }]);
    setBusca("");
  }

  function adicionarAvulsa() {
    if (!av.titulo.trim()) return;
    onChange([...itens, {
      id: novoId(), titulo: av.titulo.trim(),
      artista: av.artista.trim() || undefined, link: av.link.trim() || undefined,
    }]);
    setAv({ titulo: "", artista: "", link: "" });
    setAvulsa(false);
  }

  return (
    <div className="space-y-2">
      {itens.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={itens.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {itens.map((item, i) => (
                <ItemOrdenavel
                  key={item.id}
                  item={item}
                  indice={i}
                  musica={item.musicaId ? musicas.find(m => m.id === item.musicaId) : undefined}
                  onChange={novo => onChange(itens.map(x => x.id === item.id ? novo : x))}
                  onRemove={() => onChange(itens.filter(x => x.id !== item.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {itens.length > 1 && <p className="text-[11px] text-gray-400">Arraste pelo ícone ⋮⋮ para mudar a ordem.</p>}

      {/* Adicionar do repertório */}
      <div ref={ref} className="relative">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setAberto(true); }}
            onFocus={() => setAberto(true)}
            placeholder="Adicionar música do repertório..."
            className="input pl-8 text-sm py-2"
          />
        </div>
        {aberto && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto p-1">
            {opcoes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma música encontrada</p>
            ) : opcoes.map(m => (
              <button key={m.id} type="button" onClick={() => adicionarMusica(m)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-primary-50">
                <Music2 size={14} className="text-primary-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.titulo}</p>
                  <p className="text-xs text-gray-400 truncate">{m.artista}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">Tom {m.tom}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Avulsa */}
      {avulsa ? (
        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700">Música avulsa (só para este culto, não entra no repertório)</p>
          <input value={av.titulo} onChange={e => setAv({ ...av, titulo: e.target.value })} className="input py-2 text-sm" placeholder="Título *" autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <input value={av.artista} onChange={e => setAv({ ...av, artista: e.target.value })} className="input py-2 text-sm" placeholder="Artista" />
            <input value={av.link} onChange={e => setAv({ ...av, link: e.target.value })} className="input py-2 text-sm" placeholder="Link (YouTube...)" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAvulsa(false)} className="btn-secondary text-sm flex-1 py-2">Cancelar</button>
            <button type="button" onClick={adicionarAvulsa} disabled={!av.titulo.trim()} className="btn-primary text-sm flex-1 py-2">Adicionar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAvulsa(true)} className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1">
          <Plus size={14} /> Música avulsa
        </button>
      )}
    </div>
  );
}
