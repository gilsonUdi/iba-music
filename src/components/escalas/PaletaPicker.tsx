"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Shirt, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { createPaletaModelo, deletePaletaModelo, getPaletasModelo } from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import type { PaletaModelo } from "@/lib/types";

export const CORES_ROUPAS = [
  { label: "Branco",       hex: "#FFFFFF", border: true },
  { label: "Prata",        hex: "#cbd5e1" },
  { label: "Cinza",        hex: "#6b7280" },
  { label: "Preto",        hex: "#111827" },
  { label: "Bege",         hex: "#d4b896" },
  { label: "Marrom",       hex: "#92400e" },
  { label: "Vinho",        hex: "#7c1d2b" },
  { label: "Vermelho",     hex: "#dc2626" },
  { label: "Rosa",         hex: "#f472b6" },
  { label: "Roxo",         hex: "#7c3aed" },
  { label: "Azul Marinho", hex: "#1e3a5f" },
  { label: "Azul",         hex: "#3b82f6" },
  { label: "Azul Claro",   hex: "#7dd3fc" },
  { label: "Turquesa",     hex: "#14b8a6" },
  { label: "Verde",        hex: "#16a34a" },
  { label: "Verde Oliva",  hex: "#65a30d" },
  { label: "Amarelo",      hex: "#fbbf24" },
  { label: "Laranja",      hex: "#f97316" },
  { label: "Dourado",      hex: "#d97706" },
];

/** Nome da cor da lista padrão, ou o próprio código (#RRGGBB) para cores livres. */
export function nomeCor(hex: string): string {
  return CORES_ROUPAS.find(c => c.hex.toLowerCase() === hex.toLowerCase())?.label ?? hex.toUpperCase();
}

export function PaletaResumo({ cores }: { cores: string[] }) {
  if (!cores.length) return null;
  return (
    <div className="flex items-center gap-1">
      <Shirt size={11} className="text-gray-400 shrink-0" />
      {cores.map(hex => (
        <span key={hex} title={nomeCor(hex)} className="w-4 h-4 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: hex }} />
      ))}
    </div>
  );
}

export default function PaletaPicker({
  selected,
  onChange,
  igrejaId,
  uid,
}: {
  selected: string[];
  onChange: (cores: string[]) => void;
  igrejaId?: string;
  uid: string;
}) {
  const [corLivre, setCorLivre] = useState("#7c3aed");
  const [modelos, setModelos] = useState<PaletaModelo[]>([]);
  const [nomeModelo, setNomeModelo] = useState("");

  useEffect(() => {
    getPaletasModelo(igrejaId).then(setModelos).catch(() => setModelos([]));
  }, [igrejaId]);

  function toggle(hex: string) {
    const h = hex.toLowerCase();
    const tem = selected.some(c => c.toLowerCase() === h);
    onChange(tem ? selected.filter(c => c.toLowerCase() !== h) : [...selected, hex]);
  }

  async function salvarModelo() {
    if (!nomeModelo.trim() || !selected.length) { toast.error("Dê um nome e escolha as cores"); return; }
    try {
      const ref = await createPaletaModelo({ nome: nomeModelo.trim(), cores: selected, igrejaId, createdBy: uid });
      setModelos(m => [...m, { id: ref.id, nome: nomeModelo.trim(), cores: selected, igrejaId, createdBy: uid }]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setNomeModelo("");
      toast.success("Modelo de paleta salvo");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar o modelo"));
    }
  }

  async function excluirModelo(m: PaletaModelo) {
    if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
    try {
      await deletePaletaModelo(m.id);
      setModelos(ms => ms.filter(x => x.id !== m.id));
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao excluir o modelo"));
    }
  }

  const livres = selected.filter(h => !CORES_ROUPAS.some(c => c.hex.toLowerCase() === h.toLowerCase()));

  return (
    <div className="space-y-3">
      {/* Modelos salvos */}
      {modelos.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Modelos salvos</p>
          <div className="flex flex-wrap gap-2">
            {modelos.map(m => (
              <span key={m.id} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full pl-1 pr-1 py-0.5">
                <button type="button" onClick={() => onChange(m.cores)} className="inline-flex items-center gap-1.5 pl-1 pr-1 text-xs font-medium text-gray-700">
                  <span className="flex -space-x-1">
                    {m.cores.slice(0, 5).map(c => <span key={c} className="w-3.5 h-3.5 rounded-full ring-1 ring-white" style={{ backgroundColor: c }} />)}
                  </span>
                  {m.nome}
                </button>
                <button type="button" onClick={() => excluirModelo(m)} className="text-gray-300 hover:text-red-500 p-0.5" aria-label={`Excluir modelo ${m.nome}`}>
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cores padrão */}
      <div className="grid grid-cols-10 gap-2">
        {CORES_ROUPAS.map(cor => {
          const sel = selected.some(c => c.toLowerCase() === cor.hex.toLowerCase());
          return (
            <button key={cor.hex} type="button" title={cor.label} onClick={() => toggle(cor.hex)}
              className={clsx("w-7 h-7 rounded-full transition-all", cor.border && "ring-1 ring-gray-200",
                sel ? "ring-2 ring-offset-2 ring-primary-500 scale-110" : "hover:scale-110")}
              style={{ backgroundColor: cor.hex }} />
          );
        })}
      </div>

      {/* Cor livre */}
      <div className="flex items-center gap-2">
        <input type="color" value={corLivre} onChange={e => setCorLivre(e.target.value)}
          className="w-10 h-9 rounded-lg border border-gray-200 cursor-pointer bg-white" aria-label="Escolher cor" />
        <input value={corLivre} onChange={e => setCorLivre(e.target.value)} className="input w-28 py-2 font-mono text-sm" placeholder="#RRGGBB" />
        <button type="button" onClick={() => {
          if (!/^#[0-9a-f]{6}$/i.test(corLivre)) { toast.error("Use o formato #RRGGBB"); return; }
          if (!selected.some(c => c.toLowerCase() === corLivre.toLowerCase())) onChange([...selected, corLivre]);
        }} className="btn-secondary text-sm flex items-center gap-1 py-2">
          <Plus size={13} /> Cor
        </button>
        {livres.length > 0 && <span className="text-xs text-gray-400">{livres.length} cor(es) livre(s)</span>}
      </div>

      {/* Selecionadas */}
      {selected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Paleta:</span>
            {selected.map(hex => (
              <span key={hex} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 rounded-full pl-1.5 pr-2.5 py-0.5">
                <span className="w-3 h-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: hex }} />
                {nomeCor(hex)}
                <button type="button" onClick={() => onChange(selected.filter(c => c !== hex))} className="ml-0.5 text-gray-400 hover:text-red-500" aria-label={`Remover ${nomeCor(hex)}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={nomeModelo} onChange={e => setNomeModelo(e.target.value)} className="input py-2 text-sm flex-1" placeholder="Salvar como modelo (ex: Santa Ceia)" />
            <button type="button" onClick={salvarModelo} className="btn-secondary text-sm flex items-center gap-1 py-2">
              <Save size={13} /> Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
