import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { itensDoSetlist, type Escala } from "./types";

export interface UsoMusica {
  vezes: number;
  ultima?: string; // data ISO (yyyy-MM-dd) da última vez que foi tocada
  datas: string[];
}

/** Escalas que já aconteceram (data até hoje). */
export function escalasRealizadas(escalas: Escala[], hoje = new Date()): Escala[] {
  const limite = format(hoje, "yyyy-MM-dd"); // data local (toISOString usaria UTC)
  return escalas.filter(e => e.data.slice(0, 10) <= limite);
}

/** Uso de cada música do repertório (por musicaId) nas escalas já realizadas. */
export function usoDasMusicas(escalas: Escala[], hoje = new Date()): Record<string, UsoMusica> {
  const uso: Record<string, UsoMusica> = {};
  for (const e of escalasRealizadas(escalas, hoje)) {
    const data = e.data.slice(0, 10);
    for (const item of itensDoSetlist(e)) {
      if (!item.musicaId) continue;
      const u = (uso[item.musicaId] ??= { vezes: 0, datas: [] });
      u.vezes++;
      u.datas.push(data);
      if (!u.ultima || data > u.ultima) u.ultima = data;
    }
  }
  return uso;
}

/** Dias desde a última vez tocada (undefined = nunca tocada). */
export function diasSemTocar(uso: UsoMusica | undefined, hoje = new Date()): number | undefined {
  if (!uso?.ultima) return undefined;
  return differenceInCalendarDays(hoje, parseISO(uso.ultima));
}

/** "hoje", "há 1 dia", "há 12 dias", "nunca tocada" */
export function textoUltimaVez(dias: number | undefined): string {
  if (dias === undefined) return "nunca tocada";
  if (dias === 0) return "tocada hoje";
  return `tocada há ${dias} dia${dias !== 1 ? "s" : ""}`;
}

export interface Ranking {
  chave: string;       // musicaId ou "avulsa:<titulo>"
  musicaId?: string;
  titulo: string;
  vezes: number;
}

/** Ranking das músicas mais tocadas num período [inicio, fim] (datas ISO). */
export function rankingPeriodo(escalas: Escala[], inicio: string, fim: string, hoje = new Date()): Ranking[] {
  const mapa = new Map<string, Ranking>();
  for (const e of escalasRealizadas(escalas, hoje)) {
    const data = e.data.slice(0, 10);
    if (data < inicio || data > fim) continue;
    for (const item of itensDoSetlist(e)) {
      const chave = item.musicaId ?? `avulsa:${item.titulo.trim().toLowerCase()}`;
      const r = mapa.get(chave) ?? { chave, musicaId: item.musicaId, titulo: item.titulo, vezes: 0 };
      r.vezes++;
      if (!r.titulo && item.titulo) r.titulo = item.titulo;
      mapa.set(chave, r);
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.vezes - a.vezes || a.titulo.localeCompare(b.titulo, "pt-BR"));
}
