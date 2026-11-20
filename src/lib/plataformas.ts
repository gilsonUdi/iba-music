/** Plataformas de música/vídeo integradas ao repertório. */
export type Plataforma = "youtube" | "spotify" | "deezer";

export const PLATAFORMAS: Record<Plataforma, {
  nome: string;
  campo: "youtubeUrl" | "spotifyUrl" | "deezerUrl";
  rota: string;
  cor: string;       // classes do botão de busca
  vazio: string;     // placeholder quando nada foi escolhido
}> = {
  youtube: { nome: "YouTube", campo: "youtubeUrl", rota: "/api/youtube-search", cor: "bg-red-500 hover:brightness-110",     vazio: "Nenhum vídeo selecionado" },
  spotify: { nome: "Spotify", campo: "spotifyUrl", rota: "/api/spotify-search", cor: "bg-green-500 hover:brightness-110", vazio: "Nenhuma faixa selecionada" },
  deezer:  { nome: "Deezer",  campo: "deezerUrl",  rota: "/api/deezer-search",  cor: "bg-violet-500 hover:brightness-110", vazio: "Nenhuma faixa selecionada" },
};

export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1];
      return u.searchParams.get("v");
    }
  } catch { /* inválido */ }
  return null;
}

/** open.spotify.com/track/{id} (aceita também /intl-pt/track/{id}) */
export function getSpotifyTrackId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("spotify.com")) return null;
    const m = u.pathname.match(/\/track\/([A-Za-z0-9]+)/);
    return m?.[1] ?? null;
  } catch { /* inválido */ }
  return null;
}

/** deezer.com/track/{id} (aceita também /br/track/{id}) */
export function getDeezerTrackId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("deezer.com")) return null;
    const m = u.pathname.match(/\/track\/(\d+)/);
    return m?.[1] ?? null;
  } catch { /* inválido */ }
  return null;
}

export const embedSpotify = (id: string) => `https://open.spotify.com/embed/track/${id}`;
export const embedDeezer  = (id: string) => `https://widget.deezer.com/widget/auto/track/${id}`;
