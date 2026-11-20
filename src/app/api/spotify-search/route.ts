import { NextRequest, NextResponse } from "next/server";
import { usuarioAutenticado, termoBusca, type ResultadoBusca } from "@/lib/server/auth";

// Token de app (Client Credentials) — reaproveitado enquanto válido
let tokenCache: { token: string; expiraEm: number } | null = null;

async function spotifyToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiraEm > Date.now() + 60_000) return tokenCache.token;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  tokenCache = { token: data.access_token, expiraEm: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

export async function GET(req: NextRequest) {
  const q = termoBusca(req);
  if (!q) return NextResponse.json({ items: [] });

  if (!(await usuarioAutenticado(req))) {
    return NextResponse.json({ error: "Faça login para buscar no Spotify" }, { status: 401 });
  }

  const token = await spotifyToken();
  if (!token) {
    return NextResponse.json({ error: "Spotify não configurado (SPOTIFY_CLIENT_ID / SECRET)" }, { status: 500 });
  }

  const url = `https://api.spotify.com/v1/search?type=track&market=BR&limit=6&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) tokenCache = null;
    return NextResponse.json({ error: "Erro ao buscar no Spotify" }, { status: res.status });
  }

  const data = await res.json();

  const items: ResultadoBusca[] = (data.tracks?.items ?? []).map((t: {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string; width: number }[] };
    external_urls: { spotify: string };
  }) => {
    const imgs = [...(t.album?.images ?? [])].sort((a, b) => a.width - b.width);
    return {
      id:       t.id,
      title:    t.name,
      subtitle: `${t.artists.map(a => a.name).join(", ")} · ${t.album?.name ?? ""}`,
      thumb:    imgs[0]?.url ?? "",
      url:      t.external_urls.spotify,
    };
  });

  return NextResponse.json({ items });
}
