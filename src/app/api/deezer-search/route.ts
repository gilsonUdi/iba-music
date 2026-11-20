import { NextRequest, NextResponse } from "next/server";
import { usuarioAutenticado, termoBusca, type ResultadoBusca } from "@/lib/server/auth";

// A API pública de busca do Deezer não exige chave, mas bloqueia chamadas do
// navegador (CORS) — por isso a busca passa pelo servidor.
export async function GET(req: NextRequest) {
  const q = termoBusca(req);
  if (!q) return NextResponse.json({ items: [] });

  if (!(await usuarioAutenticado(req))) {
    return NextResponse.json({ error: "Faça login para buscar no Deezer" }, { status: 401 });
  }

  const res = await fetch(`https://api.deezer.com/search?limit=6&q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Erro ao buscar no Deezer" }, { status: res.status });
  }

  const data = await res.json();
  if (data.error) {
    return NextResponse.json({ error: "Erro ao buscar no Deezer" }, { status: 502 });
  }

  const items: ResultadoBusca[] = (data.data ?? []).map((t: {
    id: number;
    title: string;
    link: string;
    artist: { name: string };
    album: { title: string; cover_small: string };
  }) => ({
    id:       String(t.id),
    title:    t.title,
    subtitle: `${t.artist?.name ?? ""} · ${t.album?.title ?? ""}`,
    thumb:    t.album?.cover_small ?? "",
    url:      t.link,
  }));

  return NextResponse.json({ items });
}
