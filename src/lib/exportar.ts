import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CULTO_LABELS, itensDoSetlist, type Escala, type Musica, type SetlistItem } from "./types";
import { getYouTubeId } from "./plataformas";

/** Item do setlist já combinado com a música do repertório (quando houver). */
export interface ItemResolvido extends SetlistItem {
  musica?: Musica;
  tomFinal?: string;
}

export function resolverSetlist(escala: Escala, musicas: Musica[]): ItemResolvido[] {
  return itensDoSetlist(escala).map(item => {
    const musica = item.musicaId ? musicas.find(m => m.id === item.musicaId) : undefined;
    return {
      ...item,
      musica,
      titulo: item.titulo || musica?.titulo || "(música removida)",
      artista: item.artista || musica?.artista,
      tomFinal: item.tom || musica?.tom,
    };
  });
}

export function tituloEscala(escala: Escala): string {
  const data = format(parseISO(escala.data), "dd/MM/yyyy (EEEE)", { locale: ptBR });
  const culto = CULTO_LABELS[escala.tipoCulto] ?? escala.tipoCulto;
  return `${culto} · ${data}`;
}

// ── YouTube ────────────────────────────────────────────────────────────────────
/**
 * Playlist temporária do YouTube com os vídeos do setlist, na ordem.
 * Não exige login nem API — mas o YouTube não permite dar nome a ela.
 */
export function playlistYoutube(itens: ItemResolvido[]): { url: string; total: number; semVideo: number } | null {
  const ids = itens
    .map(i => i.musica?.youtubeUrl ?? i.link)
    .map(u => (u ? getYouTubeId(u) : null))
    .filter((id): id is string => !!id);
  if (!ids.length) return null;
  return {
    url: `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`,
    total: ids.length,
    semVideo: itens.length - ids.length,
  };
}

// ── WhatsApp ───────────────────────────────────────────────────────────────────
/** Link wa.me: telefone vira só dígitos; números brasileiros sem DDI recebem 55. */
export function linkWhatsapp(texto: string, telefone?: string): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const numero = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function mensagemEscalado(nome: string, escala: Escala, appUrl: string): string {
  const primeiroNome = nome.split(" ")[0];
  const equipe = escala.equipeName ? ` com a equipe *${escala.equipeName}*` : "";
  return [
    `Olá, ${primeiroNome}! 🎶`,
    `Você foi escalado(a) para *${tituloEscala(escala)}*${equipe}.`,
    `Confirme sua presença no app: ${appUrl}/escalas`,
  ].join("\n");
}

export function mensagemGrupo(escala: Escala, itens: ItemResolvido[], appUrl: string, nomesCores: string[]): string {
  const linhas = [`*${tituloEscala(escala)}*`];
  if (escala.equipeName) linhas.push(`Equipe: ${escala.equipeName}`);
  if (escala.membros.length) {
    linhas.push("", "*Escalados*");
    escala.membros.forEach(m => linhas.push(`• ${m.name}`));
  }
  if (itens.length) {
    linhas.push("", "*Setlist*");
    itens.forEach((i, n) => linhas.push(`${n + 1}. ${i.titulo}${i.tomFinal ? ` (${i.tomFinal})` : ""}`));
  }
  if (nomesCores.length) linhas.push("", `*Roupas:* ${nomesCores.join(", ")}`);
  if (escala.observacoes) linhas.push("", `*Instruções:* ${escala.observacoes}`);
  linhas.push("", `Detalhes no app: ${appUrl}/escalas`);
  return linhas.join("\n");
}

// ── Holyrics / projeção ────────────────────────────────────────────────────────
/**
 * Texto com as letras do setlist: título e artista no topo de cada música,
 * estrofes separadas por linha em branco (cada estrofe vira um slide na importação).
 */
export function letrasParaProjecao(itens: ItemResolvido[]): { texto: string; semLetra: string[] } {
  const blocos: string[] = [];
  const semLetra: string[] = [];
  for (const i of itens) {
    const letra = i.musica?.letra?.trim();
    if (!letra) { semLetra.push(i.titulo); continue; }
    const normalizada = letra.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    blocos.push([i.titulo, i.artista ?? "", "", normalizada].join("\n"));
  }
  return { texto: blocos.join("\n\n\n"), semLetra };
}

export function baixarTexto(nomeArquivo: string, texto: string) {
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
