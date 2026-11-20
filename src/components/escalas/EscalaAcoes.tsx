"use client";

import Link from "next/link";
import { toast } from "sonner";
import { FileDown, Printer, Youtube, MessageCircle, Copy } from "lucide-react";
import type { Escala } from "@/lib/types";
import {
  baixarTexto, letrasParaProjecao, linkWhatsapp, mensagemEscalado, mensagemGrupo,
  playlistYoutube, type ItemResolvido,
} from "@/lib/exportar";
import { nomeCor } from "./PaletaPicker";

const btn = "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors";

/** Exportações da escala: PDF, playlist do YouTube, letras para projeção e WhatsApp. */
export default function EscalaAcoes({ escala, itens }: { escala: Escala; itens: ItemResolvido[] }) {
  const playlist = playlistYoutube(itens);
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  function exportarLetras() {
    const { texto, semLetra } = letrasParaProjecao(itens);
    if (!texto) { toast.error("Nenhuma música do setlist tem letra cadastrada"); return; }
    baixarTexto(`letras-${escala.data.slice(0, 10)}.txt`, texto);
    if (semLetra.length) toast.info(`Sem letra cadastrada: ${semLetra.join(", ")}`);
    else toast.success("Letras exportadas");
  }

  async function copiarMensagemGrupo() {
    const texto = mensagemGrupo(escala, itens, appUrl, (escala.paletaCores ?? []).map(nomeCor));
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem copiada — cole no grupo do WhatsApp");
    } catch {
      window.open(linkWhatsapp(texto), "_blank", "noopener");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/escalas/${escala.id}/imprimir`} className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-100`}>
        <Printer size={13} /> Imprimir / PDF
      </Link>
      {playlist && (
        <a href={playlist.url} target="_blank" rel="noopener" className={`${btn} border-red-100 text-red-600 hover:bg-red-50`}
          title={playlist.semVideo ? `${playlist.semVideo} música(s) sem vídeo ficaram de fora` : "Abre todas as músicas em sequência"}>
          <Youtube size={13} /> Playlist do ensaio ({playlist.total})
        </a>
      )}
      {itens.length > 0 && (
        <button type="button" onClick={exportarLetras} className={`${btn} border-purple-100 text-purple-600 hover:bg-purple-50`}
          title="Arquivo .txt com as letras, uma estrofe por slide (Holyrics e outros)">
          <FileDown size={13} /> Letras p/ projeção
        </button>
      )}
      <button type="button" onClick={copiarMensagemGrupo} className={`${btn} border-green-100 text-green-700 hover:bg-green-50`}>
        <Copy size={13} /> Mensagem p/ grupo
      </button>
    </div>
  );
}

/** Botão que abre o WhatsApp com o aviso de escala para um membro. */
export function AvisarWhatsapp({ nome, telefone, escala }: { nome: string; telefone?: string; escala: Escala }) {
  if (!telefone) return null;
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <a href={linkWhatsapp(mensagemEscalado(nome, escala, appUrl), telefone)} target="_blank" rel="noopener"
      className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title={`Avisar ${nome} no WhatsApp`}>
      <MessageCircle size={16} />
    </a>
  );
}
