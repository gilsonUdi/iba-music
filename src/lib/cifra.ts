/**
 * Motor das cifras no formato "mapa" usado pelas equipes:
 *
 *   IN: Gm. Bb. F. C.          ← seção com acordes
 *   V:No dia da angústia       ← seção com o começo da letra
 *   Gm Bb C                    ← linha de acordes
 *   R:A batalha
 *   Gm. Bb. F. C. 2x
 *
 * Marcas de tempo (. .. , ; ’ ”) e o menor escrito com hífen (E-) são preservados.
 * A troca de tom só altera acordes de linhas/segmentos reconhecidos como acordes,
 * para não mexer em palavras da letra ("A batalha", "Deixou"...).
 */

// ── Notas ──────────────────────────────────────────────────────────────────────
const SUSTENIDOS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BEMOIS     = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const INDICE: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, "B#": 0,
};
/** Tons em que se escreve com bemol (maiores e menores). */
const TONS_BEMOL = new Set(["F", "Bb", "Eb", "Ab", "Db", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

export function transporNota(nota: string, semitons: number, bemol = false): string {
  const i = INDICE[nota];
  if (i === undefined) return nota;
  const j = (((i + semitons) % 12) + 12) % 12;
  return (bemol ? BEMOIS : SUSTENIDOS)[j];
}

// ── Acordes ────────────────────────────────────────────────────────────────────
/** Um acorde: raiz + qualidade/extensões + baixo opcional (D/F#, Bm7, A4, E-, F°, C7M, G(9)). */
const ACORDE = String.raw`[A-G](?:#|b)?(?:m(?!a)|M|-|°|º|ø|\+|dim|aug|sus|add|maj)?(?:\d{1,2}|M|\+|-|°|sus\d?|add\d{1,2}|maj\d?)*(?:\([^)\s]{1,8}\))?(?:\/[A-G](?:#|b)?)?`;
const RE_ACORDE_INTEIRO = new RegExp(`^(?:${ACORDE})+$`);
/** Marcadores que podem aparecer junto dos acordes sem ser letra. */
const RE_MARCADOR = /^(?:\d+x|x\d+|rampa|tcl|bateria|baixo|solo|break|stop|n\.?c\.?|%|-|\||\/|:|\d+)$/i;
const SEPARADORES = /[.,;:’”'"…‘“()\[\]]+/;

/** Raiz/baixo dentro de um trecho de acordes (não pega letras de palavras). */
const RE_NOTA_NO_ACORDE = /(^|[^A-Za-z#])([A-G])([#b]?)(?!(?!m|maj|min|sus|add|dim|aug)[a-z])/g;

/** Diz se um trecho de texto é "só acordes" (com marcas de tempo e marcadores). */
export function ehTrechoDeAcordes(texto: string): boolean {
  const tokens = texto.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let acordes = 0, validos = 0, total = 0;
  for (const tk of tokens) {
    const partes = tk.split(SEPARADORES).filter(Boolean);
    if (!partes.length) { validos++; total++; continue; } // só pontuação (ex.: "..")
    for (const p of partes) {
      total++;
      if (RE_ACORDE_INTEIRO.test(p)) { acordes++; validos++; }
      else if (RE_MARCADOR.test(p)) validos++;
    }
  }
  return acordes > 0 && validos / total >= 0.75;
}

/** Transpõe todos os acordes de um trecho que JÁ se sabe ser de acordes. */
export function transporTrecho(trecho: string, semitons: number, bemol = false): string {
  if (!semitons) return trecho;
  return trecho.replace(RE_NOTA_NO_ACORDE, (_m, antes: string, letra: string, acid: string) =>
    antes + transporNota(letra + acid, semitons, bemol));
}

// ── Linhas ─────────────────────────────────────────────────────────────────────
export type TipoSecao = "intro" | "verso" | "pre" | "refrao" | "ponte" | "coro" | "inter" | "final" | "outro";

/** Siglas de seção aceitas como primeira palavra do rótulo. */
const PRIMEIRA_SIGLA = String.raw`IN\s*\/\s*V|INTRO|INTERL[UÚ]DIO|INTERL|INTER(?:-P)?|INT|INS|INSTRU(?:MENTAL)?|IN|SOLO|VERSO|V|PRE|PR|P-R|R|REFR[AÃ]O|PONTE|P|BRIDGE|CORO|C|TUR|TAG|RIFI?|RIFF|DIV(?:IS[AÃ]O)?|PARADA|PAUSA|MINISTRA[CÇ][AÃ]O|FINAL|FIM|SA[IÍ]DA|OUTRO|RAMPA|BATERIA|I`;
/**
 * Rótulo de seção no começo da linha, sempre terminado em ":"
 * (ex.: "V:", "R2:", "INT P1:", "INS Coro:", "P2,3:", "VERSO P:", "P TD Bda:").
 * O ":" evita confundir a seção "C" (coro) com o acorde C.
 */
const RE_ROTULO = new RegExp(
  String.raw`^\s*((?:${PRIMEIRA_SIGLA})[\d,]*(?:\s+[A-Za-zÀ-ú0-9,]{1,10}){0,3})\s*:\s*`,
  "i",
);
/** Rótulos por extenso que valem mesmo sem ":" quando abrem a linha. */
const RE_ROTULO_SOLTO = /^\s*(INSTRUMENTAL|INSTRU|SOLO|DIVIS[AÃ]O|PARADA|PAUSA|MINISTRA[CÇ][AÃ]O|CORO|REFR[AÃ]O|FINAL|RAMPA|INTERL[UÚ]DIO|VERSO)(?![A-Za-zÀ-ú])(.*)$/i;

export function tipoDaSecao(rotulo: string): TipoSecao {
  const r = rotulo.toUpperCase().trim().split(/[\s\d,]+/)[0].replace(/[^A-ZÃÇÍÚ\-\/]/g, "");
  if (/^(IN|INTRO|INV|IN\/V|I)$/.test(r)) return "intro";
  if (/^(V|VERSO)$/.test(r)) return "verso";
  if (/^(PR|PRE|P-R)$/.test(r)) return "pre";
  if (/^(R|REFRÃO|REFRAO)$/.test(r)) return "refrao";
  if (/^(P|PONTE|BRIDGE)$/.test(r)) return "ponte";
  if (/^(C|CORO|TAG)$/.test(r)) return "coro";
  if (/^(INTER|INTER-P|INTERL|INTERLÚDIO|INTERLUDIO|INT|INS|INSTRU|INSTRUMENTAL|SOLO|RIF|RIFI|RIFF|TUR|DIV|DIVISÃO|DIVISAO|RAMPA|BATERIA|PAUSA|PARADA)$/.test(r)) return "inter";
  if (/^(FINAL|FIM|SAÍDA|SAIDA)$/.test(r)) return "final";
  return "outro";
}

export interface LinhaCifra {
  tipo: "vazia" | "secao" | "acordes" | "texto";
  rotulo?: string;          // "V", "R2", "INTER"...
  secao?: TipoSecao;
  resto?: string;           // texto após o rótulo
  restoEhAcorde?: boolean;  // o resto é uma sequência de acordes?
  texto: string;            // linha original
}

export function analisarLinha(linha: string): LinhaCifra {
  if (!linha.trim()) return { tipo: "vazia", texto: linha };
  const m = linha.match(RE_ROTULO);
  if (m) {
    const rotulo = m[1].replace(/\s+/g, " ").trim();
    const resto = linha.slice(m[0].length);
    return { tipo: "secao", rotulo, secao: tipoDaSecao(m[1]), resto, restoEhAcorde: ehTrechoDeAcordes(resto), texto: linha };
  }
  const s = linha.match(RE_ROTULO_SOLTO);
  if (s && !ehTrechoDeAcordes(linha)) {
    return { tipo: "secao", rotulo: s[1], secao: tipoDaSecao(s[1]), resto: s[2], restoEhAcorde: ehTrechoDeAcordes(s[2]), texto: linha };
  }
  if (ehTrechoDeAcordes(linha)) return { tipo: "acordes", texto: linha };
  // Rótulo livre ("TD J: A#- F#") seguido só de acordes
  const g = linha.match(/^\s*([^:\d][^:]{0,13}):\s*(.+)$/);
  if (g && ehTrechoDeAcordes(g[2])) {
    return { tipo: "secao", rotulo: g[1].trim(), secao: "outro", resto: g[2], restoEhAcorde: true, texto: linha };
  }
  return { tipo: "texto", texto: linha };
}

/** Transpõe uma linha respeitando rótulos e letras. */
export function transporLinha(linha: string, semitons: number, bemol = false): string {
  if (!semitons) return linha;
  const a = analisarLinha(linha);
  if (a.tipo === "acordes") return transporTrecho(linha, semitons, bemol);
  if (a.tipo === "secao" && a.restoEhAcorde && a.resto) {
    return linha.slice(0, linha.length - a.resto.length) + transporTrecho(a.resto, semitons, bemol);
  }
  return linha;
}

// ── Tom ────────────────────────────────────────────────────────────────────────
/** Normaliza "D#-", "Gm", "A#" → { raiz, menor }. */
export function lerTom(tom?: string): { raiz: string; menor: boolean } | null {
  const m = tom?.trim().match(/^([A-G])([#b]?)\s*(m|-|min)?$/i);
  if (!m) return null;
  return { raiz: m[1].toUpperCase() + m[2], menor: !!m[3] };
}

export function formatarTom(tom?: string): string {
  const t = lerTom(tom);
  return t ? `${t.raiz}${t.menor ? "m" : ""}` : (tom ?? "");
}

export function transporTom(tom: string | undefined, semitons: number): string | undefined {
  const t = lerTom(tom);
  if (!t) return tom;
  const bemol = deveUsarBemol(t.raiz, t.menor, semitons);
  return transporNota(t.raiz, semitons, bemol) + (t.menor ? "m" : "");
}

/** Escolhe bemol ou sustenido conforme o tom de destino. */
export function deveUsarBemol(raiz: string, menor: boolean, semitons: number): boolean {
  const destinoS = transporNota(raiz, semitons, false) + (menor ? "m" : "");
  const destinoB = transporNota(raiz, semitons, true) + (menor ? "m" : "");
  return TONS_BEMOL.has(destinoB) && !TONS_BEMOL.has(destinoS) ? true : TONS_BEMOL.has(destinoS);
}

/** Transpõe a cifra inteira. */
export function transporCifra(texto: string, semitons: number, tom?: string): string {
  if (!semitons) return texto;
  const t = lerTom(tom);
  const bemol = t ? deveUsarBemol(t.raiz, t.menor, semitons) : false;
  return texto.split("\n").map(l => transporLinha(l, semitons, bemol)).join("\n");
}

/** Distância em semitons entre dois tons (ex.: G → A = 2). */
export function semitonsEntre(de?: string, para?: string): number {
  const a = lerTom(de), b = lerTom(para);
  if (!a || !b) return 0;
  const d = (INDICE[b.raiz] - INDICE[a.raiz] + 12) % 12;
  return d > 6 ? d - 12 : d;
}

/** Divide um trecho de acordes em pedaços, marcando quais são acordes (para destacar na tela). */
export function pedacosDeAcordes(trecho: string): { t: string; acorde: boolean }[] {
  const re = new RegExp(`(^|[\\s.,;:’”'"…‘“()\\[\\]])(${ACORDE})(?=$|[\\s.,;:’”'"…‘“()\\[\\]A-G])`, "g");
  const out: { t: string; acorde: boolean }[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trecho))) {
    const ini = m.index + m[1].length;
    if (ini > ultimo) out.push({ t: trecho.slice(ultimo, ini), acorde: false });
    out.push({ t: m[2], acorde: true });
    ultimo = ini + m[2].length;
    re.lastIndex = ultimo;
  }
  if (ultimo < trecho.length) out.push({ t: trecho.slice(ultimo), acorde: false });
  return out;
}

// ── Títulos das abas / músicas ─────────────────────────────────────────────────
export interface TituloLido {
  titulo: string;
  tom?: string;     // como escrito (ex.: "D#-")
  artista?: string;
  bpm?: number;
}

/**
 * Lê títulos nos formatos usados nos documentos das equipes:
 *   "A Batalha É do Senhor(F)-DT-120bpm"
 *   "Graça: D Israel Salazar" · "Eu e minha casa: D - DT" · "Vem me Buscar: D#- (F#)"
 *   "Gratidão: D Felipe R 156b" · "Ele é Exaltado: C-Fhop" · "É ele A#" · "Único fhop"
 */
export function lerTitulo(bruto: string): TituloLido {
  const s = bruto.replace(/\s+/g, " ").trim();
  const TOM = String.raw`[A-G][#b]?(?:m|-(?=\s|$|\())?`;

  let m = s.match(new RegExp(String.raw`^(.*?)\s*\((${TOM})\)\s*-\s*(.*?)\s*-\s*(\d{2,3})\s*bpm`, "i"));
  if (m) return { titulo: m[1].trim(), tom: m[2], artista: m[3].trim() || undefined, bpm: Number(m[4]) };

  m = s.match(new RegExp(String.raw`^(.*?)\s*:\s*(${TOM})(?![a-z#])\s*(.*)$`));
  if (m && m[1].trim()) {
    let resto = m[3];
    let bpm: number | undefined;
    const b = resto.match(/(\d{2,3})\s*b(?:pm)?\b/i);
    if (b) { bpm = Number(b[1]); resto = resto.replace(b[0], " "); }
    resto = resto.replace(/\([^)]*\)/g, " ").replace(/^[\s\-–]+|[\s\-–]+$/g, "").replace(/\s+/g, " ").trim();
    return { titulo: m[1].trim(), tom: m[2], artista: resto || undefined, bpm };
  }

  m = s.match(new RegExp(String.raw`^(.*\S)\s+(${TOM})$`));
  if (m) return { titulo: m[1].trim(), tom: m[2] };

  return { titulo: s };
}

/** Normaliza títulos para comparação (sem acento, minúsculo, só letras/números). */
export function normalizarTitulo(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

/** Semelhança 0–1 entre dois títulos (Dice sobre bigramas). */
export function semelhancaTitulo(a: string, b: string): number {
  const x = normalizarTitulo(a), y = normalizarTitulo(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const big = (s: string) => { const r: string[] = []; for (let i = 0; i < s.length - 1; i++) r.push(s.slice(i, i + 2)); return r; };
  const bx = big(x), by = big(y);
  const cont = new Map<string, number>();
  bx.forEach(g => cont.set(g, (cont.get(g) ?? 0) + 1));
  let comum = 0;
  by.forEach(g => { const n = cont.get(g) ?? 0; if (n > 0) { comum++; cont.set(g, n - 1); } });
  return (2 * comum) / (bx.length + by.length);
}

/** Raiz do tom em sustenidos (formato de Musica.tom: C, C#, D...). Tons menores devolvem a raiz. */
export function tomMaiorDe(tom?: string): string | undefined {
  const t = lerTom(tom);
  if (!t) return undefined;
  // Musica.tom usa notação com sustenidos (C, C#, D...)
  return transporNota(t.raiz, 0, false);
}

/**
 * Limpa o texto de uma aba importada: tira o título repetido na 1ª linha,
 * espaços nas pontas das linhas e excesso de linhas em branco.
 */
export function limparTextoImportado(titulo: string, texto: string): string {
  const linhas = texto.replace(/\r/g, "").replace(/ /g, " ").split("\n").map(l => l.replace(/\s+$/, ""));
  while (linhas.length && !linhas[0].trim()) linhas.shift();
  if (linhas.length && semelhancaTitulo(linhas[0], titulo) >= 0.8) linhas.shift();
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
