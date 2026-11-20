import type { NextRequest } from "next/server";

/**
 * Confere o ID token do Firebase (usuário logado) via Identity Toolkit.
 * Usado pelas rotas de busca para não expor as cotas/chaves das APIs externas.
 */
export async function usuarioAutenticado(req: NextRequest): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!idToken || !apiKey) return false;

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data.users) && data.users.length > 0;
}

/** Formato comum de resultado das buscas (YouTube, Spotify, Deezer). */
export interface ResultadoBusca {
  id: string;
  title: string;
  subtitle: string;
  thumb: string;
  url: string;
}

export function termoBusca(req: NextRequest): string {
  return req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
}
