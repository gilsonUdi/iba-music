import { NextRequest, NextResponse } from "next/server";
import { usuarioAutenticado } from "@/lib/server/auth";

// Documentos grandes têm dezenas de abas: dá tempo de baixar todas.
export const maxDuration = 60;

interface Aba { id: string; titulo: string; texto: string }

const UA = "Mozilla/5.0 (compatible; IBAMusic/1.0)";

/** Lista as abas do documento a partir da página pública do editor. */
function lerAbas(html: string): { id: string; titulo: string; ordem: number }[] {
  const re = /\{"ty":"ac","d":\["(t\.[a-z0-9]+)",\[1,"((?:[^"\\]|\\.)*)"\],\[(\d+)\]\]\}/g;
  const vistas = new Map<string, { id: string; titulo: string; ordem: number }>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (vistas.has(m[1])) continue;
    let titulo = m[2];
    try { titulo = JSON.parse(`"${m[2]}"`); } catch { /* mantém bruto */ }
    vistas.set(m[1], { id: m[1], titulo, ordem: Number(m[3]) });
  }
  return Array.from(vistas.values()).sort((a, b) => a.ordem - b.ordem);
}

function tituloDoDocumento(html: string): string | undefined {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m?.[1].replace(/\s*-\s*Documentos Google\s*$|\s*-\s*Google Docs\s*$/i, "").trim() || undefined;
}

async function exportarTexto(docId: string, abaId?: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt${abaId ? `&tab=${abaId}` : ""}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store", redirect: "follow" });
  const tipo = res.headers.get("content-type") ?? "";
  if (!res.ok || tipo.includes("text/html")) throw new Error("privado");
  return (await res.text()).replace(/^﻿/, "").replace(/\r/g, "");
}

/** Executa tarefas com no máximo `n` ao mesmo tempo. */
async function emParalelo<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) { const k = i++; out[k] = await fn(itens[k]); }
  }));
  return out;
}

export async function GET(req: NextRequest) {
  if (!(await usuarioAutenticado(req))) {
    return NextResponse.json({ error: "Faça login para importar" }, { status: 401 });
  }

  // Só aceita documentos do Google Docs: a URL é remontada a partir do ID
  const link = req.nextUrl.searchParams.get("url") ?? "";
  const docId = link.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{20,})/)?.[1];
  if (!docId) {
    return NextResponse.json({ error: "Link inválido: use o link de um documento do Google Docs" }, { status: 400 });
  }

  try {
    const pagina = await fetch(`https://docs.google.com/document/d/${docId}/edit`, {
      headers: { "User-Agent": UA }, cache: "no-store",
    });
    const html = pagina.ok ? await pagina.text() : "";
    const abas = lerAbas(html);
    const tituloDoc = tituloDoDocumento(html);

    let resultado: Aba[];
    if (abas.length > 1) {
      resultado = await emParalelo(abas, 6, async a => ({ id: a.id, titulo: a.titulo, texto: await exportarTexto(docId, a.id) }));
    } else {
      // Sem abas (ou não foi possível listá-las): documento inteiro numa "aba" só
      resultado = [{ id: abas[0]?.id ?? "doc", titulo: abas[0]?.titulo ?? tituloDoc ?? "Documento", texto: await exportarTexto(docId) }];
    }
    return NextResponse.json({ docId, tituloDoc, separadoPorAbas: abas.length > 1, abas: resultado });
  } catch (e) {
    const privado = e instanceof Error && e.message === "privado";
    return NextResponse.json({
      error: privado
        ? "Não consegui abrir o documento. No Google Docs, clique em Compartilhar → Acesso geral → \"Qualquer pessoa com o link\" (Leitor)."
        : "Erro ao ler o documento do Google Docs",
    }, { status: privado ? 403 : 502 });
  }
}
