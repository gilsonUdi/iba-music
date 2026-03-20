import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ items: [] });

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

  const items = (data.items ?? []).map((item: {
    id: { videoId: string };
    snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } };
  }) => ({
    videoId:  item.id.videoId,
    title:    item.snippet.title,
    channel:  item.snippet.channelTitle,
    thumb:    item.snippet.thumbnails.default.url,
    url:      `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));

  return NextResponse.json({ items });
}
