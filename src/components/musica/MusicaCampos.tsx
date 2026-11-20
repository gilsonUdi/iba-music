"use client";

import { useState } from "react";
import { ExternalLink, FileText, Headphones, Link2, Plus, Search, X, Youtube } from "lucide-react";
import PlataformaSearch from "@/components/PlataformaSearch";
import { formatarDuracao, lerDuracao, type LinkExterno, type Musica, type TomMusical } from "@/lib/types";

export const TONS: TomMusical[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export type MusicaForm = Partial<Omit<Musica, "id" | "createdAt">>;

/** Campos editáveis de uma música — usados no cadastro e na edição. */
export const CAMPOS_EDITAVEIS = [
  "titulo", "artista", "tom", "tomOriginal", "bpm", "duracaoSeg", "observacoes",
  "youtubeUrl", "spotifyUrl", "deezerUrl", "cifraUrl", "vsUrl", "links", "tags", "letra",
] as const;

export function camposEditaveis(form: MusicaForm): MusicaForm {
  const out: Record<string, unknown> = {};
  for (const k of CAMPOS_EDITAVEIS) out[k] = form[k];
  // remove links incompletos
  out.links = (form.links ?? []).filter(l => l.url.trim()).map(l => ({ titulo: l.titulo.trim() || "Arquivo", url: l.url.trim() }));
  return out as MusicaForm;
}

export default function MusicaCampos({
  form,
  setForm,
}: {
  form: MusicaForm;
  setForm: (fn: (f: MusicaForm) => MusicaForm) => void;
}) {
  const [duracaoTxt, setDuracaoTxt] = useState(formatarDuracao(form.duracaoSeg));
  const busca = [form.titulo, form.artista].filter(Boolean).join(" ");
  const set = <K extends keyof MusicaForm>(k: K, v: MusicaForm[K]) => setForm(f => ({ ...f, [k]: v }));

  function setLink(i: number, campo: keyof LinkExterno, valor: string) {
    setForm(f => {
      const links = [...(f.links ?? [])];
      links[i] = { ...links[i], [campo]: valor };
      return { ...f, links };
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Título *</label>
          <input value={form.titulo ?? ""} onChange={e => set("titulo", e.target.value)} className="input" placeholder="Nome da música" />
        </div>
        <div>
          <label className="label">Artista/Ministério *</label>
          <input value={form.artista ?? ""} onChange={e => set("artista", e.target.value)} className="input" placeholder="Ex: Hillsong, Gabriela Rocha..." />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Tom da igreja</label>
          <select value={form.tom ?? "G"} onChange={e => set("tom", e.target.value as TomMusical)} className="input">
            {TONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tom original</label>
          <select value={form.tomOriginal ?? ""} onChange={e => set("tomOriginal", (e.target.value || undefined) as TomMusical | undefined)} className="input">
            <option value="">—</option>
            {TONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">BPM</label>
          <input type="number" inputMode="numeric" value={form.bpm ?? ""} onChange={e => set("bpm", e.target.value ? Number(e.target.value) : undefined)} className="input" placeholder="120" />
        </div>
        <div>
          <label className="label">Duração</label>
          <input
            value={duracaoTxt}
            onChange={e => setDuracaoTxt(e.target.value)}
            onBlur={() => {
              const seg = lerDuracao(duracaoTxt);
              set("duracaoSeg", seg);
              setDuracaoTxt(formatarDuracao(seg));
            }}
            className="input"
            placeholder="4:30"
            inputMode="numeric"
          />
        </div>
      </div>

      <div>
        <label className="label flex items-center gap-1.5"><Youtube size={13} className="text-red-500" /> YouTube</label>
        <PlataformaSearch plataforma="youtube" value={form.youtubeUrl ?? ""} onChange={url => set("youtubeUrl", url)} searchQuery={busca} />
      </div>
      <div>
        <label className="label">Spotify</label>
        <PlataformaSearch plataforma="spotify" value={form.spotifyUrl ?? ""} onChange={url => set("spotifyUrl", url)} searchQuery={busca} />
      </div>
      <div>
        <label className="label">Deezer</label>
        <PlataformaSearch plataforma="deezer" value={form.deezerUrl ?? ""} onChange={url => set("deezerUrl", url)} searchQuery={busca} />
      </div>

      <div>
        <label className="label flex items-center gap-1.5"><FileText size={13} className="text-primary-500" /> Cifra</label>
        <PlataformaSearch plataforma="cifraclub" value={form.cifraUrl ?? ""} onChange={url => set("cifraUrl", url)} searchQuery={busca} />
        <input value={form.cifraUrl ?? ""} onChange={e => set("cifraUrl", e.target.value)}
          className="input mt-2 text-xs py-2" placeholder="…ou cole outro link (Google Docs, outro site)" />
      </div>

      <div>
        <label className="label flex items-center gap-1.5"><Headphones size={13} className="text-green-500" /> VS / Playback</label>
        <input value={form.vsUrl ?? ""} onChange={e => set("vsUrl", e.target.value)} className="input" placeholder="Link do VS desta música (OneDrive, Drive...)" />
      </div>

      <div>
        <label className="label flex items-center gap-1.5"><Link2 size={13} className="text-blue-500" /> Arquivos e versões (Drive)</label>
        <p className="text-xs text-gray-400 mb-2">Áudios de versões ou arranjos próprios da igreja</p>
        <div className="space-y-2">
          {(form.links ?? []).map((l, i) => (
            <div key={i} className="flex gap-2">
              <input value={l.titulo} onChange={e => setLink(i, "titulo", e.target.value)} className="input w-1/3" placeholder="Ex: Versão acústica" />
              <input value={l.url} onChange={e => setLink(i, "url", e.target.value)} className="input flex-1" placeholder="https://drive.google.com/..." />
              {l.url && (
                <a href={l.url} target="_blank" rel="noopener" className="p-2.5 text-gray-400 hover:text-primary-500" title="Abrir">
                  <ExternalLink size={15} />
                </a>
              )}
              <button type="button" onClick={() => setForm(f => ({ ...f, links: (f.links ?? []).filter((_, j) => j !== i) }))}
                className="p-2.5 text-gray-400 hover:text-red-500" aria-label="Remover link">
                <X size={15} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setForm(f => ({ ...f, links: [...(f.links ?? []), { titulo: "", url: "" }] }))}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            <Plus size={14} /> Adicionar link
          </button>
        </div>
      </div>

      <div>
        <label className="label">Tags (separadas por vírgula)</label>
        <input
          value={form.tags?.join(", ") ?? ""}
          onChange={e => set("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
          className="input"
          placeholder="Ceia, Culto de Jovens, Festivo, Adoração"
        />
        <p className="text-xs text-gray-400 mt-1">Cada tag vira uma aba de filtro no repertório</p>
      </div>

      <div>
        <label className="label">Observações de arranjo</label>
        <textarea value={form.observacoes ?? ""} onChange={e => set("observacoes", e.target.value)} className="input resize-none" rows={3}
          placeholder="Ex: intro só teclado, repetir refrão 2x no final, sobe meio tom na última..." />
      </div>

      <div>
        <label className="label">Letra</label>
        <textarea value={form.letra ?? ""} onChange={e => set("letra", e.target.value)} className="input resize-none" rows={6}
          placeholder="Cole a letra aqui (opcional). Separe as estrofes com uma linha em branco." />
      </div>
    </div>
  );
}
