"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronLeft, ChevronRight, Minus, Plus, AArrowDown, AArrowUp, Play, Pause, RotateCcw, ListMusic,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { getCifra, getCifrasDaEquipe, getEscala, getMusica, getMusicas } from "@/lib/firestore";
import { semitonsEntre, transporTom } from "@/lib/cifra";
import { itensDoSetlist, type Cifra, type Musica } from "@/lib/types";
import CifraVisual from "@/components/cifra/CifraVisual";
import { Esqueleto } from "@/components/ui/Esqueleto";

interface Folha {
  titulo: string;
  artista?: string;
  cifra?: Cifra;
  letra?: string;
  semitonsIniciais: number; // tom pedido no setlist x tom da cifra
}

const TAMANHO_KEY = "estante-tamanho";

/**
 * Estante: cifras em tela cheia para ensaio e culto.
 *   /estante?escala=ID                  → setlist da escala, cifras da equipe escalada
 *   /estante?musica=ID&equipe=ID&tom=N  → uma música
 */
export default function EstantePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [folhas, setFolhas] = useState<Folha[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState("");
  const [atual, setAtual] = useState(0);
  const [semitons, setSemitons] = useState<number[]>([]);
  const [tamanho, setTamanho] = useState(22);
  const [rolando, setRolando] = useState(false);
  const [velocidade, setVelocidade] = useState(25); // px/s
  const [mostrarLista, setMostrarLista] = useState(false);
  const corpo = useRef<HTMLDivElement>(null);
  const toqueX = useRef<number | null>(null);

  // Login
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [loading, user, router]);

  // Carrega as folhas
  useEffect(() => {
    if (!user) return;
    const q = new URLSearchParams(window.location.search);
    const escalaId = q.get("escala");
    const musicaId = q.get("musica");
    const equipeId = q.get("equipe") ?? "";
    (async () => {
      try {
        if (escalaId) {
          const escala = await getEscala(escalaId);
          if (!escala) { setErro("Escala não encontrada"); return; }
          const [musicas, cifras] = await Promise.all([
            getMusicas(),
            escala.equipeId ? getCifrasDaEquipe(escala.equipeId, user.igrejaId) : Promise.resolve([] as Cifra[]),
          ]);
          const lista: Folha[] = itensDoSetlist(escala).map(i => {
            const m: Musica | undefined = i.musicaId ? musicas.find(x => x.id === i.musicaId) : undefined;
            const cifra = i.musicaId ? cifras.find(c => c.musicaId === i.musicaId) : undefined;
            return {
              titulo: i.titulo || m?.titulo || "(música)",
              artista: i.artista || m?.artista,
              cifra,
              letra: m?.letra,
              semitonsIniciais: cifra?.tom && i.tom ? semitonsEntre(cifra.tom, i.tom) : 0,
            };
          });
          setTitulo(escala.equipeName ? `Setlist · ${escala.equipeName}` : "Setlist");
          setFolhas(lista);
          setSemitons(lista.map(f => f.semitonsIniciais));
        } else if (musicaId) {
          const [m, cifra] = await Promise.all([getMusica(musicaId), equipeId ? getCifra(musicaId, equipeId) : Promise.resolve(null)]);
          if (!m) { setErro("Música não encontrada"); return; }
          const n = Number(q.get("tom") ?? 0) || 0;
          setTitulo(cifra?.equipeName ?? "Estante");
          setFolhas([{ titulo: m.titulo, artista: m.artista, cifra: cifra ?? undefined, letra: m.letra, semitonsIniciais: n }]);
          setSemitons([n]);
        } else {
          setErro("Abra a estante a partir de uma escala ou de uma música.");
        }
      } catch {
        setErro("Não foi possível carregar as cifras.");
      }
    })();
    try { const t = Number(localStorage.getItem(TAMANHO_KEY)); if (t >= 14 && t <= 44) setTamanho(t); } catch { /* sem storage */ }
  }, [user]);

  // Tela sempre acesa enquanto a estante estiver aberta
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible") lock = await wl.request("screen");
      } catch { /* sem suporte */ }
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => { document.removeEventListener("visibilitychange", pedir); lock?.release().catch(() => {}); };
  }, []);

  // Rolagem automática
  useEffect(() => {
    if (!rolando) return;
    let ultimo = performance.now();
    let resto = 0;
    let id = 0;
    const passo = (agora: number) => {
      const el = corpo.current;
      if (el) {
        resto += ((agora - ultimo) / 1000) * velocidade;
        const px = Math.floor(resto);
        if (px > 0) { el.scrollTop += px; resto -= px; }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) setRolando(false);
      }
      ultimo = agora;
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [rolando, velocidade]);

  const total = folhas?.length ?? 0;
  const ir = useCallback((n: number) => {
    if (!total) return;
    setAtual(a => Math.min(total - 1, Math.max(0, a + n)));
    setRolando(false);
    corpo.current?.scrollTo({ top: 0 });
  }, [total]);

  // Teclado e pedal (setas trocam de música; PageUp/PageDown rolam a tela)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
      else if (e.key === " ") { e.preventDefault(); setRolando(r => !r); }
      else if (e.key === "PageDown" || e.key === "ArrowDown") { e.preventDefault(); corpo.current?.scrollBy({ top: (corpo.current.clientHeight * 0.8), behavior: "smooth" }); }
      else if (e.key === "PageUp" || e.key === "ArrowUp") { e.preventDefault(); corpo.current?.scrollBy({ top: -(corpo.current.clientHeight * 0.8), behavior: "smooth" }); }
      else if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir, router]);

  function mudarTamanho(d: number) {
    setTamanho(t => {
      const n = Math.min(44, Math.max(14, t + d));
      try { localStorage.setItem(TAMANHO_KEY, String(n)); } catch { /* sem storage */ }
      return n;
    });
  }
  function mudarTom(d: number) {
    setSemitons(s => s.map((v, i) => (i === atual ? v + d : v)));
  }

  const folha = folhas?.[atual];
  const st = semitons[atual] ?? 0;
  const tomExibido = folha?.cifra?.tom ? transporTom(folha.cifra.tom, st) : undefined;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#07040f] text-gray-900 select-none">
      {/* Barra superior */}
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/40 backdrop-blur"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/10" aria-label="Fechar estante"><X size={20} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-gray-400 truncate">{titulo}{total > 1 && ` · ${atual + 1}/${total}`}</p>
          <p className="font-bold truncate" style={{ fontFamily: "Sora, sans-serif" }}>{folha?.titulo ?? " "}</p>
        </div>
        {total > 1 && (
          <button onClick={() => setMostrarLista(v => !v)} className={clsx("p-2 rounded-xl hover:bg-white/10", mostrarLista && "bg-white/10")} aria-label="Ver setlist">
            <ListMusic size={19} />
          </button>
        )}
      </header>

      {/* Lista do setlist */}
      {mostrarLista && folhas && (
        <nav className="shrink-0 max-h-[40vh] overflow-y-auto border-b border-white/10 bg-black/30">
          {folhas.map((f, i) => (
            <button key={i} onClick={() => { setAtual(i); setMostrarLista(false); corpo.current?.scrollTo({ top: 0 }); }}
              className={clsx("w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm", i === atual ? "bg-primary-500/20 text-gray-900" : "text-gray-600 hover:bg-white/5")}>
              <span className="w-5 text-right text-gray-400 tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate">{f.titulo}</span>
              {!f.cifra && <span className="text-[10px] text-amber-500">sem cifra</span>}
            </button>
          ))}
        </nav>
      )}

      {/* Cifra */}
      <main
        ref={corpo}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6"
        onTouchStart={e => { toqueX.current = e.touches[0].clientX; setRolando(false); }}
        onTouchEnd={e => {
          if (toqueX.current === null) return;
          const dx = e.changedTouches[0].clientX - toqueX.current;
          toqueX.current = null;
          if (Math.abs(dx) > 80) ir(dx < 0 ? 1 : -1);
        }}
      >
        {erro ? (
          <p className="text-center text-gray-400 mt-20">{erro}</p>
        ) : !folhas ? (
          <div className="max-w-3xl mx-auto space-y-3"><Esqueleto className="h-8 w-1/2" /><Esqueleto className="h-[60vh] w-full" /></div>
        ) : !folha ? (
          <p className="text-center text-gray-400 mt-20">O setlist desta escala está vazio.</p>
        ) : (
          <div className="max-w-3xl mx-auto pb-[40vh]">
            {folha.artista && <p className="text-sm text-gray-400 mb-4">{folha.artista}{tomExibido && ` · Tom ${tomExibido}`}</p>}
            {folha.cifra ? (
              <CifraVisual texto={folha.cifra.texto} tom={folha.cifra.tom} semitons={st} tamanho={tamanho} />
            ) : folha.letra ? (
              <>
                <p className="text-xs text-amber-500 mb-3">Sem cifra para esta equipe — mostrando a letra.</p>
                <pre className="whitespace-pre-wrap font-sans text-gray-800" style={{ fontSize: tamanho }}>{folha.letra}</pre>
              </>
            ) : (
              <p className="text-gray-400">Sem cifra nem letra cadastrada para esta música.</p>
            )}
          </div>
        )}
      </main>

      {/* Controles */}
      <footer className="shrink-0 border-t border-white/10 bg-black/50 backdrop-blur px-2 py-2 flex items-center gap-1.5 justify-between"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <button onClick={() => ir(-1)} disabled={atual === 0} className="p-3 rounded-xl hover:bg-white/10 disabled:opacity-30" aria-label="Música anterior"><ChevronLeft size={22} /></button>

        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button onClick={() => mudarTom(-1)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Descer meio tom"><Minus size={16} /></button>
          <span className="min-w-[3rem] text-center text-sm font-bold">{tomExibido ?? (st ? `${st > 0 ? "+" : ""}${st}` : "Tom")}</span>
          <button onClick={() => mudarTom(1)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Subir meio tom"><Plus size={16} /></button>
          {st !== (folha?.semitonsIniciais ?? 0) && (
            <button onClick={() => setSemitons(s => s.map((v, i) => (i === atual ? (folha?.semitonsIniciais ?? 0) : v)))} className="p-2 rounded-lg hover:bg-white/10 text-gray-400" aria-label="Voltar ao tom"><RotateCcw size={14} /></button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button onClick={() => mudarTamanho(-2)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Diminuir letra"><AArrowDown size={17} /></button>
          <button onClick={() => mudarTamanho(2)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Aumentar letra"><AArrowUp size={17} /></button>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button onClick={() => setRolando(r => !r)} className={clsx("p-2 rounded-lg", rolando ? "bg-primary-500 text-white" : "hover:bg-white/10")} aria-label={rolando ? "Pausar rolagem" : "Rolar automaticamente"}>
            {rolando ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <input type="range" min={8} max={80} value={velocidade} onChange={e => setVelocidade(Number(e.target.value))}
            className="w-16 sm:w-24 accent-violet-500" aria-label="Velocidade da rolagem" />
        </div>

        <div className="flex sm:hidden items-center gap-0.5">
          <button onClick={() => mudarTamanho(-2)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Diminuir letra"><AArrowDown size={17} /></button>
          <button onClick={() => mudarTamanho(2)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Aumentar letra"><AArrowUp size={17} /></button>
        </div>

        <button onClick={() => ir(1)} disabled={atual >= total - 1} className="p-3 rounded-xl hover:bg-white/10 disabled:opacity-30" aria-label="Próxima música"><ChevronRight size={22} /></button>
      </footer>
    </div>
  );
}
