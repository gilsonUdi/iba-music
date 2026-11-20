import { NextRequest, NextResponse } from "next/server";
import { usuarioAutenticado, termoBusca, type ResultadoBusca } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const q = termoBusca(req);
  if (!q) return NextResponse.json({ items: [] });

  if (!(await usuarioAutenticado(req))) {
    return NextResponse.json({ error: "Faça login para buscar no YouTube" }, { status: 401 });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key || key === "cole_sua_chave_aqui") {
    return NextResponse.json({ error: "YouTube API key não configurada" }, { status: 500 });
  }

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=6&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ error: "Erro ao buscar no YouTube" }, { status: res.status });
  }

  const data = await res.json();

  const items: ResultadoBusca[] = (data.items ?? []).map((item: {
    id: { videoId: string };
    snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } };
  }) => ({
    id:       item.id.videoId,
    title:    item.snippet.title,
    subtitle: item.snippet.channelTitle,
    thumb:    item.snippet.thumbnails.default.url,
    url:      `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));

  return NextResponse.json({ items });
}
