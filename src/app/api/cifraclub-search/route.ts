import { NextRequest, NextResponse } from "next/server";
import { usuarioAutenticado, termoBusca, type ResultadoBusca } from "@/lib/server/auth";

/**
 * Busca cifras no Cifra Club pela Brave Search API (oficial), limitada ao site
 * cifraclub.com.br. Sem a chave BRAVE_SEARCH_API_KEY responde 501 e o app
 * cai na busca externa (abre o Google numa aba nova).
 */
export async function GET(req: NextRequest) {
  const q = termoBusca(req);
  if (!q) return NextResponse.json({ items: [] });

  if (!(await usuarioAutenticado(req))) {
    return NextResponse.json({ error: "Faça login para buscar cifras" }, { status: 401 });
  }

  const chave = process.env.BRAVE_SEARCH_API_KEY;
  if (!chave) {
    return NextResponse.json({ error: "Busca do Cifra Club não configurada", naoConfigurado: true }, { status: 501 });
  }

  const url = `https://api.search.brave.com/res/v1/web/search?count=10&country=BR&q=${encodeURIComponent(`site:cifraclub.com.br ${q}`)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": chave },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Erro ao buscar no Cifra Club" }, { status: res.status === 429 ? 429 : 502 });
  }

  const data = await res.json();
  const vistos = new Set<string>();
  const items: ResultadoBusca[] = [];

  for (const r of (data.web?.results ?? []) as { title?: string; url?: string; description?: string }[]) {
    // Só páginas de cifra: cifraclub.com.br/<artista>/<musica>/ (ignora letras, vídeos, listas)
    const m = r.url?.match(/^https?:\/\/(?:www\.)?cifraclub\.com\.br\/([^/?#]+)\/([^/?#]+)\/?(?:[?#].*)?$/);
    if (!m || ["letra", "videos", "discografia", "musicas", "simplificada"].includes(m[2])) continue;
    const link = `https://www.cifraclub.com.br/${m[1]}/${m[2]}/`;
    if (vistos.has(link)) continue;
    vistos.add(link);

    // Título vem como "Música - Artista - Cifra Club" (às vezes "Cifra de ...")
    const partes = (r.title ?? "").replace(/<[^>]+>/g, "").split(/\s+[-–|]\s+/).map(s => s.trim()).filter(Boolean);
    const semSite = partes.filter(p => !/cifra\s*club/i.test(p));
    const titulo = (semSite[0] ?? m[2].replace(/-/g, " ")).replace(/^(cifra|tablatura|tab)\s+(de|da|do)\s+/i, "");
    const artista = semSite[1] ?? m[1].replace(/-/g, " ");

    items.push({ id: link, title: titulo, subtitle: artista, thumb: "", url: link });
    if (items.length >= 6) break;
  }

  return NextResponse.json({ items });
}
