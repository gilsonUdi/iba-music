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
export interface AppUser {
  uid: string;
  email: string;
  name: string;
  roles: UserRole[];         // array — um usuário pode ter múltiplos papéis
  igrejaId?: string;         // undefined apenas para super_admin
  instrumento?: Instrumento;            // mantido para retrocompat
  instrumentos?: Instrumento[];         // lista completa de instrumentos
  instrumentoPrincipal?: Instrumento;   // instrumento principal (exibição / escalas)
  liderUid?: string;         // UID do líder de célula (para músicos)
  telefone?: string;
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
  observacoes?: string;
  setlist?: string[];    // IDs das músicas
  paletaCores?: string[]; // hex das cores de roupa combinadas
  igrejaId?: string;
  createdBy: string;
  createdAt: Date;
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

export interface Musica {
  id: string;
  titulo: string;
  artista: string;
  tom: TomMusical;
  bpm?: number;
  letra?: string;
  cifraUrl?: string;
  youtubeUrl?: string;
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
  liderId: string;
  liderName: string;
  membros: string[];   // array de UIDs dos músicos
  cifraUrl?: string;   // Google Docs com todas as cifras da equipe
  vsUrl?: string;      // OneDrive com os VS (playbacks/stems) da equipe
  cor?: string;        // cor identificadora da equipe (hex)
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

export interface PrestacaoPergunta {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  opcoes?: OpcaoPergunta[];
  obrigatoria: boolean;
  ordem: number;
  ativa: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface PrestacaoResposta {
  id: string;             // formato: {uid}_{YYYY-MM}
  uid: string;            // UID do músico
  musicoName: string;
  liderUid: string;       // UID do líder de célula que pode ver
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
