"use client";

import { useRef, useState } from "react";
import { Minus, Plus, Save, X, Eye, Pencil } from "lucide-react";
import clsx from "clsx";
import { formatarTom, transporCifra, transporTom } from "@/lib/cifra";
import CifraVisual from "./CifraVisual";

const SECOES = ["IN:", "V:", "PR:", "R:", "P:", "INTER:", "C:", "FINAL:"];

/** Editor da cifra: texto à esquerda, prévia colorida à direita (abas no celular). */
export default function CifraEditor({
  textoInicial, tomInicial, salvando, onSalvar, onCancelar,
}: {
  textoInicial: string;
  tomInicial?: string;
  salvando: boolean;
  onSalvar: (texto: string, tom?: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [tom, setTom] = useState(tomInicial ?? "");
  const [aba, setAba] = useState<"editar" | "previa">("editar");
  const area = useRef<HTMLTextAreaElement>(null);

  function inserir(trecho: string) {
    const el = area.current;
    if (!el) { setTexto(t => t + "\n" + trecho + " "); return; }
    const ini = el.selectionStart, fim = el.selectionEnd;
    const antes = texto.slice(0, ini);
    const prefixo = antes && !antes.endsWith("\n") ? "\n" : "";
    const novo = antes + prefixo + trecho + " " + texto.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      el.focus();
      const pos = ini + prefixo.length + trecho.length + 1;
      el.setSelectionRange(pos, pos);
    });
  }

  /** Troca o tom de verdade (altera o texto salvo). */
  function transpor(n: number) {
    setTexto(t => transporCifra(t, n, tom || undefined));
    if (tom) setTom(transporTom(tom, n) ?? tom);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button type="button" onClick={() => transpor(-1)} className="p-1.5 rounded-lg hover:bg-white/10" title="Descer meio tom"><Minus size={14} /></button>
          <input value={tom} onChange={e => setTom(e.target.value)} placeholder="Tom"
            className="w-14 text-center bg-transparent text-sm font-bold text-gray-900 focus:outline-none" />
          <button type="button" onClick={() => transpor(1)} className="p-1.5 rounded-lg hover:bg-white/10" title="Subir meio tom"><Plus size={14} /></button>
        </div>
        <div className="flex flex-wrap gap-1">
          {SECOES.map(s => (
            <button key={s} type="button" onClick={() => inserir(s)}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-700">{s}</button>
          ))}
        </div>
        <div className="flex md:hidden ml-auto bg-white/5 rounded-xl p-0.5">
          <button type="button" onClick={() => setAba("editar")} className={clsx("px-2.5 py-1 rounded-lg text-xs flex items-center gap-1", aba === "editar" ? "bg-primary-500 text-white" : "text-gray-500")}><Pencil size={12} /> Editar</button>
          <button type="button" onClick={() => setAba("previa")} className={clsx("px-2.5 py-1 rounded-lg text-xs flex items-center gap-1", aba === "previa" ? "bg-primary-500 text-white" : "text-gray-500")}><Eye size={12} /> Prévia</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <textarea
          ref={area}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          spellCheck={false}
          className={clsx("input font-mono text-sm leading-relaxed min-h-[55vh] resize-y", aba === "previa" && "hidden md:block")}
          placeholder={"IN: G. D. Em. C.\nV:Começo da letra\nG. D. Em. C.\nR:Começo do refrão\nC. D. G. 2x"}
        />
        <div className={clsx("rounded-xl border border-white/10 bg-black/10 p-4 overflow-y-auto max-h-[70vh]", aba === "editar" && "hidden md:block")}>
          {texto.trim() ? <CifraVisual texto={texto} tom={tom} tamanho={15} /> : <p className="text-sm text-gray-400">A prévia aparece aqui.</p>}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Use <strong>SIGLA:</strong> para seções (IN, V, PR, R, P, INTER, C…). Marcas de tempo (. .. , ;) e menor com hífen (E-) são aceitos. Os botões − / + trocam o tom de todos os acordes.
      </p>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className="btn-secondary text-sm"><X size={14} /> Cancelar</button>
        <button type="button" disabled={salvando || !texto.trim()} onClick={() => onSalvar(texto.trim(), tom.trim() ? formatarTom(tom.trim()) : undefined)} className="btn-primary text-sm">
          <Save size={14} /> {salvando ? "Salvando…" : "Salvar cifra"}
        </button>
      </div>
    </div>
  );
}
