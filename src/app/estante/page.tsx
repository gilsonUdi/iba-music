"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronLeft, ChevronRight, Minus, Plus, AArrowDown, AArrowUp, Play, Pause, RotateCcw, ListMusic,
  Expand, Shrink, Columns2, ScanLine, Hand,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { getCifra, getCifrasDaEquipe, getEscala, getMusica, getMusicas } from "@/lib/firestore";
import { semelhancaTitulo, semitonsEntre, transporTom } from "@/lib/cifra";
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

interface Preferencias { tamanho: number; ajustar: boolean; colunas: boolean; velocidade: number }
const PREF_KEY = "estante-preferencias";
const PADRAO: Preferencias = { tamanho: 22, ajustar: false, colunas: false, velocidade: 25 };

function lerPreferencias(): Preferencias {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") }; } catch { return PADRAO; }
}

/**
 * Estante: cifras em tela cheia para ensaio e culto.
 *   /estante?escala=ID                  → setlist da escala, cifras da equipe escalada
 *   /estante?musica=ID&equipe=ID&tom=N  → uma música
 *
 * Toque no meio da cifra: esconde/mostra os controles (modo palco).
 * Deslizar para os lados ou setas: troca de música. Espaço: rolagem automática.
 */
export default function EstantePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [folhas, setFolhas] = useState<Folha[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState("");
  const [atual, setAtual] = useState(0);
  const [semitons, setSemitons] = useState<number[]>([]);
  const [pref, setPref] = useState<Preferencias>(PADRAO);
  const [tamanhoAjustado, setTamanhoAjustado] = useState<number | null>(null);
  const [rolando, setRolando] = useState(false);
  const [palco, setPalco] = useState(false);          // controles escondidos
  const [mostrarLista, setMostrarLista] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [dicaPalco, setDicaPalco] = useState(false);
  const corpo = useRef<HTMLDivElement>(null);
  const medida = useRef<HTMLDivElement>(null);
  const toque = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => { setPref(lerPreferencias()); }, []);
  function mudarPref(m: Partial<Preferencias>) {
    setPref(p => {
      const n = { ...p, ...m };
      try { localStorage.setItem(PREF_KEY, JSON.stringify(n)); } catch { /* sem storage */ }
      return n;
    });
  }

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
            // Cifra da música do setlist; se não houver (cadastro duplicado ou música avulsa),
            // usa a cifra da equipe com o mesmo título
            const tituloItem = i.titulo || m?.titulo || "";
            const cifra = (i.musicaId ? cifras.find(c => c.musicaId === i.musicaId) : undefined)
              ?? cifras.find(c => {
                const mc = musicas.find(x => x.id === c.musicaId);
                return !!mc && !!tituloItem && semelhancaTitulo(mc.titulo, tituloItem) >= 0.92;
              });
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

  // Tela cheia do navegador
  useEffect(() => {
    const onFs = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* iPhone não permite: o modo palco resolve */ }
  }

  // Rolagem automática
  useEffect(() => {
    if (!rolando) return;
    let ultimo = performance.now();
    let resto = 0;
    let id = 0;
    const passo = (agora: number) => {
      const el = corpo.current;
      if (el) {
        resto += ((agora - ultimo) / 1000) * pref.velocidade;
        const px = Math.floor(resto);
        if (px > 0) { el.scrollTop += px; resto -= px; }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) setRolando(false);
      }
      ultimo = agora;
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [rolando, pref.velocidade]);

  const total = folhas?.length ?? 0;
  const folha = folhas?.[atual];
  const st = semitons[atual] ?? 0;

  // Ajustar à tela: maior letra em que a música inteira cabe sem rolar
  const calcularAjuste = useCallback(() => {
    const area = corpo.current, el = medida.current;
    if (!pref.ajustar || !area || !el || !folha) { setTamanhoAjustado(null); return; }
    const estilo = getComputedStyle(area);
    // desconta o padding e a linha do título acima da cifra
    const altura = area.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom) - 36;
    const alvo = el.firstElementChild as HTMLElement | null;
    if (!alvo || altura <= 0) return;
    // nunca abaixo de 16px: ilegível no palco; se não couber, a música rola
    const MINIMO = 16;
    let min = MINIMO, max = 48, melhor = MINIMO;
    for (let i = 0; i < 9; i++) {
      const meio = (min + max) / 2;
      alvo.style.fontSize = `${meio}px`;
      if (el.scrollHeight <= altura) { melhor = meio; min = meio; } else { max = meio; }
    }
    setTamanhoAjustado(Math.floor(melhor * 2) / 2);
  }, [pref.ajustar, folha]);

  useLayoutEffect(() => { calcularAjuste(); }, [calcularAjuste, st, pref.colunas, palco, mostrarLista, atual]);
  useEffect(() => {
    window.addEventListener("resize", calcularAjuste);
    return () => window.removeEventListener("resize", calcularAjuste);
  }, [calcularAjuste]);

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
      else if (e.key === "Escape") { if (palco) setPalco(false); else router.back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir, router, palco]);

  function mudarTamanho(d: number) {
    mudarPref({ tamanho: Math.min(48, Math.max(12, (tamanhoAjustado ?? pref.tamanho) + d)), ajustar: false });
  }
  function mudarTom(d: number) {
    setSemitons(s => s.map((v, i) => (i === atual ? v + d : v)));
  }

  function entrarPalco() {
    setPalco(true);
    setMostrarLista(false);
    setDicaPalco(true);
    setTimeout(() => setDicaPalco(false), 2200);
  }

  // Toque curto (sem arrastar) no meio da cifra alterna o modo palco; deslizar troca de música
  function onPointerDown(e: React.PointerEvent) { toque.current = { x: e.clientX, y: e.clientY, t: Date.now() }; setRolando(false); }
  function onPointerUp(e: React.PointerEvent) {
    const t = toque.current;
    toque.current = null;
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) { ir(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - t.t < 350) {
      if (palco) setPalco(false); else entrarPalco();
    }
  }

  const tomExibido = folha?.cifra?.tom ? transporTom(folha.cifra.tom, st) : undefined;
  const tamanho = tamanhoAjustado ?? pref.tamanho;
  const proxima = folhas?.[atual + 1];
  const estiloColunas = pref.colunas ? { columnCount: 2, columnGap: "2.5rem", columnRule: "1px solid rgba(255,255,255,0.08)" } : undefined;

  const btn = "p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15";

  return (
    <div className="fixed inset-0 flex flex-col bg-[#07040f] text-gray-900 select-none">
      {/* Barra superior */}
      {!palco && (
        <header className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-white/10 bg-black/40 backdrop-blur"
          style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}>
          <button onClick={() => router.back()} className={btn} aria-label="Fechar estante"><X size={22} /></button>
          <button onClick={() => total > 1 && setMostrarLista(v => !v)} className="flex-1 min-w-0 text-left px-1">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 truncate">{titulo}{total > 1 && ` · ${atual + 1}/${total}`}</p>
            <p className="font-bold truncate leading-tight" style={{ fontFamily: "Sora, sans-serif" }}>{folha?.titulo ?? " "}</p>
          </button>
          {total > 1 && (
            <button onClick={() => setMostrarLista(v => !v)} className={clsx(btn, mostrarLista && "bg-white/10")} aria-label="Ver setlist">
              <ListMusic size={21} />
            </button>
          )}
          <button onClick={entrarPalco} className={btn} aria-label="Modo palco: esconder controles" title="Modo palco">
            <Hand size={20} />
          </button>
          <button onClick={alternarTelaCheia} className={clsx(btn, "hidden sm:inline-flex")} aria-label="Tela cheia">
            {telaCheia ? <Shrink size={20} /> : <Expand size={20} />}
          </button>
        </header>
      )}

      {/* Lista do setlist */}
      {mostrarLista && folhas && !palco && (
        <nav className="shrink-0 max-h-[45vh] overflow-y-auto border-b border-white/10 bg-black/30">
          {folhas.map((f, i) => (
            <button key={i} onClick={() => { setAtual(i); setMostrarLista(false); corpo.current?.scrollTo({ top: 0 }); }}
              className={clsx("w-full text-left px-4 py-3 flex items-center gap-3 text-base", i === atual ? "bg-primary-500/20 text-gray-900" : "text-gray-600 active:bg-white/5")}>
              <span className="w-6 text-right text-gray-400 tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate">{f.titulo}</span>
              {!f.cifra && <span className="text-[11px] text-amber-500">sem cifra</span>}
            </button>
          ))}
        </nav>
      )}

      {/* Cifra */}
      <main
        ref={corpo}
        className={clsx("relative flex-1 overflow-y-auto", palco ? "px-4 sm:px-8 py-4" : "px-4 sm:px-8 py-5")}
        style={palco ? { paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" } : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {erro ? (
          <p className="text-center text-gray-400 mt-20">{erro}</p>
        ) : !folhas ? (
          <div className="max-w-3xl mx-auto space-y-3"><Esqueleto className="h-8 w-1/2" /><Esqueleto className="h-[60vh] w-full" /></div>
        ) : !folha ? (
          <p className="text-center text-gray-400 mt-20">O setlist desta escala está vazio.</p>
        ) : (
          <div className={clsx("mx-auto", pref.colunas ? "max-w-6xl" : "max-w-3xl", !pref.ajustar && "pb-[35vh]")}>
            {palco ? (
              <p className="text-xs text-gray-400 mb-2 truncate">
                {total > 1 && `${atual + 1}/${total} · `}<span className="text-gray-700 font-semibold">{folha.titulo}</span>{tomExibido && ` · ${tomExibido}`}
              </p>
            ) : (folha.artista || tomExibido) && (
              <p className="text-sm text-gray-400 mb-3">{folha.artista}{tomExibido && ` · Tom ${tomExibido}`}</p>
            )}
            {folha.cifra ? (
              <div style={estiloColunas}>
                <CifraVisual texto={folha.cifra.texto} tom={folha.cifra.tom} semitons={st} tamanho={tamanho} />
              </div>
            ) : folha.letra ? (
              <>
                <p className="text-xs text-amber-500 mb-3">Sem cifra para esta equipe — mostrando a letra.</p>
                <pre className="whitespace-pre-wrap font-sans text-gray-800" style={{ fontSize: tamanho, ...estiloColunas }}>{folha.letra}</pre>
              </>
            ) : (
              <p className="text-gray-400">Sem cifra nem letra cadastrada para esta música.</p>
            )}
          </div>
        )}


        {dicaPalco && (
          <div className="fixed left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black/85 border border-white/10 text-sm text-gray-800 animate-fade-in pointer-events-none whitespace-nowrap"
            style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            Toque na cifra para mostrar os controles
          </div>
        )}
      </main>

      {/* Cópia invisível (fora da rolagem) para medir o "ajustar à tela" */}
      {pref.ajustar && folha?.cifra && (
        <div aria-hidden className="fixed inset-x-0 top-0 h-0 overflow-hidden invisible pointer-events-none">
          <div className="px-4 sm:px-8">
            <div ref={medida} className={clsx("mx-auto", pref.colunas ? "max-w-6xl" : "max-w-3xl")} style={estiloColunas}>
              <CifraVisual texto={folha.cifra.texto} tom={folha.cifra.tom} semitons={st} tamanho={pref.tamanho} />
            </div>
          </div>
        </div>
      )}

      {/* Controles: linha 1 = navegação entre músicas; linha 2 = ferramentas */}
      {!palco && (
        <footer className="shrink-0 border-t border-white/10 bg-black/50 backdrop-blur"
          style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
          {total > 1 && (
            <div className="flex items-center gap-1 px-1.5 pt-1.5">
              <button onClick={() => ir(-1)} disabled={atual === 0} className="p-3 rounded-xl active:bg-white/10 disabled:opacity-25 shrink-0" aria-label="Música anterior">
                <ChevronLeft size={26} />
              </button>
              <button onClick={() => ir(1)} disabled={!proxima} className="flex-1 min-w-0 text-center px-2 py-1 rounded-xl active:bg-white/5 disabled:opacity-60">
                <p className="text-[10px] uppercase tracking-widest text-gray-400">{proxima ? "Próxima" : "Última música"}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{proxima?.titulo ?? folha?.titulo}</p>
              </button>
              <button onClick={() => ir(1)} disabled={!proxima} className="p-3 rounded-xl active:bg-white/10 disabled:opacity-25 shrink-0" aria-label="Próxima música">
                <ChevronRight size={26} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-1.5 px-2 py-1.5">
            <div className="flex items-center bg-white/5 rounded-xl">
              <button onClick={() => mudarTom(-1)} className={btn} aria-label="Descer meio tom"><Minus size={18} /></button>
              <span className="min-w-[2.4rem] text-center text-sm font-bold">{tomExibido ?? (st ? `${st > 0 ? "+" : ""}${st}` : "Tom")}</span>
              <button onClick={() => mudarTom(1)} className={btn} aria-label="Subir meio tom"><Plus size={18} /></button>
              {st !== (folha?.semitonsIniciais ?? 0) && (
                <button onClick={() => setSemitons(s => s.map((v, i) => (i === atual ? (folha?.semitonsIniciais ?? 0) : v)))} className={clsx(btn, "text-gray-400")} aria-label="Voltar ao tom"><RotateCcw size={15} /></button>
              )}
            </div>

            <div className="flex items-center bg-white/5 rounded-xl">
              <button onClick={() => mudarTamanho(-2)} className={btn} aria-label="Diminuir letra"><AArrowDown size={19} /></button>
              <button onClick={() => mudarPref({ ajustar: !pref.ajustar })} className={clsx(btn, pref.ajustar && "bg-primary-500 text-white hover:bg-primary-500")} aria-label="Ajustar à tela" title="Ajustar a música à tela">
                <ScanLine size={18} />
              </button>
              <button onClick={() => mudarTamanho(2)} className={btn} aria-label="Aumentar letra"><AArrowUp size={19} /></button>
            </div>

            <div className="flex items-center bg-white/5 rounded-xl">
              <button onClick={() => mudarPref({ colunas: !pref.colunas })} className={clsx(btn, "hidden min-[600px]:inline-flex", pref.colunas && "bg-primary-500 text-white hover:bg-primary-500")} aria-label="Duas colunas">
                <Columns2 size={18} />
              </button>
              <button onClick={() => setRolando(r => !r)} className={clsx(btn, rolando && "bg-primary-500 text-white hover:bg-primary-500", "disabled:opacity-30")} aria-label={rolando ? "Pausar rolagem" : "Rolar automaticamente"}>
                {rolando ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          </div>

          {rolando && (
            <div className="flex items-center gap-3 px-4 pb-1.5 text-xs text-gray-400">
              Velocidade
              <input type="range" min={8} max={80} value={pref.velocidade} onChange={e => mudarPref({ velocidade: Number(e.target.value) })}
                className="flex-1 accent-violet-500" aria-label="Velocidade da rolagem" />
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
