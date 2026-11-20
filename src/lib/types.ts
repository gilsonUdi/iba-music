// ── ROLES ─────────────────────────────────────────────────────────────────────
export type UserRole = "super_admin" | "pastor" | "diretor_musical" | "lider_equipe" | "lider_celula" | "musico";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:     "Super Admin",
  pastor:          "Pastor",
  diretor_musical: "Diretor Musical",
  lider_equipe:    "Líder de Equipe",
  lider_celula:    "Líder de Célula",
  musico:          "Músico",
};

/** Helper — verifica se o usuário possui um determinado papel */
export function hasRole(user: { roles: UserRole[] } | null | undefined, role: UserRole): boolean {
  return user?.roles?.includes(role) ?? false;
}

/** Retorna o label do papel mais alto do usuário (para exibição resumida) */
export function primaryRoleLabel(roles: UserRole[]): string {
  if (roles.includes("super_admin"))     return ROLE_LABELS.super_admin;
  if (roles.includes("pastor"))          return ROLE_LABELS.pastor;
  if (roles.includes("diretor_musical")) return ROLE_LABELS.diretor_musical;
  if (roles.includes("lider_equipe"))    return ROLE_LABELS.lider_equipe;
  if (roles.includes("lider_celula"))    return ROLE_LABELS.lider_celula;
  return ROLE_LABELS.musico;
}

// ── IGREJAS ───────────────────────────────────────────────────────────────────
export interface Igreja {
  id: string;
  name: string;
  cidade?: string;
  estado?: string;
  ativo: boolean;
  createdAt: Date;
}

// ── INSTRUMENTS ───────────────────────────────────────────────────────────────
export type Instrumento =
  | "violao"
  | "guitarra"
  | "baixo"
  | "bateria"
  | "teclado"
  | "vocal"
  | "saxofone"
  | "trompete"
  | "flauta"
  | "percussao"
  | "outro";

export const INSTRUMENTO_LABELS: Record<Instrumento, string> = {
  violao: "Violão",
  guitarra: "Guitarra",
  baixo: "Baixo",
  bateria: "Bateria",
  teclado: "Teclado",
  vocal: "Vocal",
  saxofone: "Saxofone",
  trompete: "Trompete",
  flauta: "Flauta",
  percussao: "Percussão",
  outro: "Outro",
};

// ── USERS ─────────────────────────────────────────────────────────────────────
export type EstadoCivil = "solteiro" | "casado" | "divorciado" | "viuvo";

export const ESTADO_CIVIL_LABELS: Record<EstadoCivil, string> = {
  solteiro:   "Solteiro(a)",
  casado:     "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo:      "Viúvo(a)",
};

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  roles: UserRole[];         // array — um usuário pode ter múltiplos papéis
  igrejaId?: string;         // undefined apenas para super_admin
  instrumento?: Instrumento;            // mantido para retrocompat
  instrumentos?: Instrumento[];         // lista completa de instrumentos
  instrumentoPrincipal?: Instrumento;   // instrumento principal (exibição / escalas)
  liderUid?: string;         // UID do líder de célula (legado: quando o líder tinha conta)
  celulaNome?: string;          // nome da célula
  liderCelulaNome?: string;     // nome do líder de célula
  liderCelulaTelefone?: string; // WhatsApp do líder de célula
  telefone?: string;
  estadoCivil?: EstadoCivil;
  senhaTemporaria?: boolean; // true quando o admin cria o usuário — força troca de senha no 1º login
  favoritas?: string[];      // IDs das músicas favoritas
  convite?: string;          // último convite usado para entrar numa equipe
  ativo: boolean;
  createdAt: Date;
}

// ── ESCALA ────────────────────────────────────────────────────────────────────
export type TipoCulto = "domingo" | "quarta" | "especial" | "ensaio";

export const CULTO_LABELS: Record<TipoCulto, string> = {
  domingo: "Domingo",
  quarta: "Quarta-Feira",
  especial: "Culto Especial",
  ensaio: "Ensaio",
};

export interface EscalaMembro {
  uid: string;
  name: string;
  instrumento: Instrumento;
  confirmado: boolean | null; // null = aguardando, true = confirmado, false = recusou
}

export interface Escala {
  id: string;
  data: string;          // ISO date string
  tipoCulto: TipoCulto;
  equipeId?: string;     // equipe que irá ministrar
  equipeName?: string;
  membros: EscalaMembro[];
  confirmacoes?: Record<string, boolean>; // uid → confirmou? (cada membro grava só a sua)
  observacoes?: string;
  setlist?: string[];    // IDs das músicas do repertório (legado e estatísticas)
  setlistItens?: SetlistItem[]; // setlist ordenado (repertório + avulsas)
  paletaCores?: string[]; // hex das cores de roupa combinadas
  igrejaId?: string;
  createdBy: string;
  createdAt: Date;
}

/** Item do setlist: música do repertório (musicaId) ou avulsa (só título). */
export interface SetlistItem {
  id: string;            // id único do item no setlist
  musicaId?: string;     // presente quando vem do repertório
  titulo: string;
  artista?: string;
  tom?: string;          // tom usado neste culto (sobrepõe o da música)
  link?: string;         // link de referência para músicas avulsas
  observacao?: string;
}

/** Itens do setlist da escala, convertendo o formato antigo (lista de IDs). */
export function itensDoSetlist(escala: Pick<Escala, "setlist" | "setlistItens">): SetlistItem[] {
  if (escala.setlistItens?.length) return escala.setlistItens;
  return (escala.setlist ?? []).map(id => ({ id, musicaId: id, titulo: "" }));
}

// ── REPERTÓRIO ────────────────────────────────────────────────────────────────
export type TomMusical = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";
export type MusicaStatus = "pendente" | "aprovada" | "rejeitada";

export interface MusicaVoto {
  pastorUid: string;
  pastorName: string;
  igrejaId?: string;
  pontuacao: number;    // 1–5 estrelas
  comentario?: string;
  votadoEm: Date;
}

export interface LinkExterno {
  titulo: string;
  url: string;
}

export interface Musica {
  id: string;
  titulo: string;
  artista: string;
  tom: TomMusical;            // tom usado pela igreja
  tomOriginal?: TomMusical;   // tom da gravação original
  bpm?: number;
  duracaoSeg?: number;        // duração em segundos
  observacoes?: string;       // observações de arranjo
  vsUrl?: string;             // VS / playback desta música
  links?: LinkExterno[];      // arquivos externos (Drive: versões, arranjos próprios)
  letra?: string;
  cifraUrl?: string;
  youtubeUrl?: string;
  spotifyUrl?: string;
  deezerUrl?: string;
  tags?: string[];
  igrejaId?: string;
  ativo: boolean;
  // Aprovação pastoral
  status?: MusicaStatus;          // undefined = aprovada (retrocompat)
  aprovacaoComentario?: string;   // comentário do pastor
  aprovadoPor?: string;           // uid do pastor
  aprovadoEm?: Date;
  votos?: Record<string, MusicaVoto>;   // pastorUid → voto
  mediaVotos?: number;                   // calculado ao fechar votação
  createdBy: string;
  createdAt: Date;
}

// ── NOTIFICAÇÕES ──────────────────────────────────────────────────────────────
export type NotificacaoTipo = "aviso" | "escala" | "ensaio" | "urgente";

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: NotificacaoTipo;
  destinatarios: "todos" | string[]; // "todos" ou array de UIDs
  lidos: string[];                   // UIDs de quem leu
  igrejaId?: string;
  createdBy: string;
  createdAt: Date;
}

// ── EQUIPES ───────────────────────────────────────────────────────────────────
export interface Equipe {
  id: string;
  name: string;
  descricao?: string;
  liderId?: string;    // opcional: a equipe pode estar sem líder
  liderName?: string;
  membros: string[];   // array de UIDs dos músicos
  cifraUrl?: string;   // Google Docs com todas as cifras da equipe
  vsUrl?: string;      // OneDrive com os VS (playbacks/stems) da equipe
  cor?: string;        // cor identificadora da equipe (hex)
  conviteId?: string;  // código do convite ativo (link de cadastro na equipe)
  igrejaId?: string;
  ativo: boolean;
  createdBy: string;
  createdAt: Date;
}

// ── PRESTAÇÃO DE CONTAS ───────────────────────────────────────────────────────
export type TipoPergunta = "texto" | "escala" | "sim_nao" | "multipla_escolha";

export interface OpcaoPergunta {
  id: string;
  label: string;
}

export type PublicoAlvoPergunta = "todos" | "casados" | "solteiros";

export const PUBLICO_ALVO_LABELS: Record<PublicoAlvoPergunta, string> = {
  todos:    "Para todos",
  casados:  "Apenas casados",
  solteiros: "Apenas solteiros",
};

export interface PrestacaoPergunta {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  opcoes?: OpcaoPergunta[];
  obrigatoria: boolean;
  publicoAlvo?: PublicoAlvoPergunta; // undefined = "todos" (retrocompat)
  igrejaId?: string;
  ordem: number;
  ativa: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface PrestacaoResposta {
  id: string;             // formato: {uid}_{YYYY-MM}
  uid: string;            // UID do músico
  musicoName: string;
  liderUid: string;       // UID do líder de célula que pode ver (quando ele tem conta)
  igrejaId?: string;      // o pastor da igreja vê as respostas
  mes: string;            // formato: YYYY-MM
  respostas: Record<string, string | number | string[]>; // perguntaId → resposta
  enviadoEm: Date;
}

// Controle mensal de quem respondeu
export interface PrestacaoControle {
  id: string;             // formato: YYYY-MM
  mes: string;
  responderam: string[];  // UIDs
  totalMusicos: number;
  prazo: string;          // ISO date (sempre dia 15)
  aberto: boolean;
}

// ── REPERTÓRIO DA EQUIPE ──────────────────────────────────────────────────────
export interface RepertorioEquipe {
  id: string;          // equipeId (um por equipe)
  equipeId: string;
  equipeName?: string;
  igrejaId: string;
  musicaIds: string[]; // IDs de músicas aprovadas selecionadas
  updatedAt: Date;
  createdAt: Date;
}

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
export interface ConfigRepertorio {
  /** true = líderes podem cadastrar músicas já aprovadas (carga inicial do repertório) */
  liberacaoDireta: boolean;
}

// ── PALETAS DE CORES (modelos salvos) ─────────────────────────────────────────
export interface PaletaModelo {
  id: string;
  nome: string;
  cores: string[];
  igrejaId?: string;
  createdBy: string;
}

// ── HELPERS DE DURAÇÃO ────────────────────────────────────────────────────────
/** 270 → "4:30" */
export function formatarDuracao(seg?: number): string {
  if (!seg && seg !== 0) return "";
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "4:30" → 270 ; "4" → 240 ; inválido → undefined */
export function lerDuracao(txt: string): number | undefined {
  const t = txt.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
}

// ── CIFRAS (uma por música e por equipe) ──────────────────────────────────────
export interface Cifra {
  id: string;            // `${musicaId}__${equipeId}`
  musicaId: string;
  equipeId: string;
  equipeName?: string;
  igrejaId?: string;
  texto: string;         // mapa da música (seções, acordes, marcas de tempo)
  tom?: string;          // tom desta versão (ex.: "D", "D#-")
  origem?: string;       // de onde veio (ex.: "Google Docs · Cifra EQ - D")
  updatedAt: Date;
  updatedBy: string;
  updatedByName?: string;
}

export const idCifra = (musicaId: string, equipeId: string) => `${musicaId}__${equipeId}`;

// ── CONVITES (link para o músico se cadastrar direto na equipe) ───────────────
export interface Convite {
  id: string;          // código aleatório que vai no link
  equipeId: string;
  equipeName: string;
  igrejaId?: string;
  ativo: boolean;
  createdBy: string;
  createdAt: Date;
}
