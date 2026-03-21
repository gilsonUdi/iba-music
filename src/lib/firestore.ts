import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, orderBy,
  serverTimestamp, addDoc, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  AppUser, Equipe, Escala, Musica, Notificacao, Igreja,
  PrestacaoPergunta, PrestacaoResposta, PrestacaoControle,
  UserRole,
} from "./types";

// ── HELPERS ────────────────────────────────────────────────────────────────────
function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

// Remove campos undefined para o Firestore não rejeitar
function clean<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/**
 * Normaliza os campos de papel para o novo formato roles[].
 * Suporte a documentos antigos que usavam `role: string`.
 */
function normalizeRoles(d: Record<string, unknown>): UserRole[] {
  if (Array.isArray(d.roles) && d.roles.length > 0) return d.roles as UserRole[];
  if (typeof d.role === "string") return [d.role as UserRole];
  return ["musico"];
}

/** Filtra lista por igrejaId quando informado (super_admin não passa igrejaId → vê tudo) */
function byIgreja<T extends { igrejaId?: string }>(list: T[], igrejaId?: string): T[] {
  if (!igrejaId) return list; // super_admin ou sem restrição
  return list.filter(item => !item.igrejaId || item.igrejaId === igrejaId);
}

// ── IGREJAS ────────────────────────────────────────────────────────────────────
export async function getIgrejas(): Promise<Igreja[]> {
  const q = query(collection(db, "igrejas"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Igreja));
}

export async function createIgreja(data: Omit<Igreja, "id" | "createdAt">) {
  return addDoc(collection(db, "igrejas"), { ...clean(data), createdAt: serverTimestamp() });
}

export async function updateIgreja(id: string, data: Partial<Igreja>) {
  await updateDoc(doc(db, "igrejas", id), clean(data));
}

export async function deleteIgreja(id: string) {
  await deleteDoc(doc(db, "igrejas", id));
}

// ── USERS ──────────────────────────────────────────────────────────────────────
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    ...d,
    uid: snap.id,
    roles: normalizeRoles(d),
    createdAt: toDate(d.createdAt),
  } as AppUser;
}

export async function createUser(uid: string, data: Omit<AppUser, "uid" | "createdAt" | "ativo">) {
  const { ...rest } = data;
  await setDoc(doc(db, "users", uid), {
    ...clean(rest),
    roles: data.roles,
    ativo: true,
    createdAt: serverTimestamp(),
  });
}

export async function updateUser(uid: string, data: Partial<AppUser>) {
  await updateDoc(doc(db, "users", uid), clean(data));
}

export async function getAllMusicos(igrejaId?: string): Promise<AppUser[]> {
  const q = query(
    collection(db, "users"),
    where("roles", "array-contains", "musico"),
    where("ativo", "==", true)
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({
    ...d.data(),
    uid: d.id,
    roles: normalizeRoles(d.data() as Record<string, unknown>),
    createdAt: toDate(d.data().createdAt),
  } as AppUser));
  return igrejaId ? all.filter(u => !u.igrejaId || u.igrejaId === igrejaId) : all;
}

export async function getAllUsers(igrejaId?: string): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, "users"));
  const all = snap.docs.map(d => ({
    ...d.data(),
    uid: d.id,
    roles: normalizeRoles(d.data() as Record<string, unknown>),
    createdAt: toDate(d.data().createdAt),
  } as AppUser));
  // Nunca mostra super_admins na lista de membros de uma igreja
  const semSuperAdmin = all.filter(u => !u.roles.includes("super_admin"));
  return igrejaId
    ? semSuperAdmin.filter(u => !u.igrejaId || u.igrejaId === igrejaId)
    : semSuperAdmin;
}

export async function getMusicosByLider(liderUid: string): Promise<AppUser[]> {
  const q = query(collection(db, "users"), where("liderUid", "==", liderUid), where("ativo", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    ...d.data(),
    uid: d.id,
    roles: normalizeRoles(d.data() as Record<string, unknown>),
    createdAt: toDate(d.data().createdAt),
  } as AppUser));
}

// ── EQUIPES ────────────────────────────────────────────────────────────────────
export async function getEquipes(igrejaId?: string): Promise<Equipe[]> {
  const q = query(collection(db, "equipes"), orderBy("name"));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Equipe));
  return byIgreja(all, igrejaId);
}

export async function getEquipesByLider(liderId: string): Promise<Equipe[]> {
  const q = query(collection(db, "equipes"), where("liderId", "==", liderId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Equipe));
}

export async function createEquipe(data: Omit<Equipe, "id" | "createdAt">) {
  return addDoc(collection(db, "equipes"), { ...clean(data), createdAt: serverTimestamp() });
}

export async function updateEquipe(id: string, data: Partial<Equipe>) {
  await updateDoc(doc(db, "equipes", id), clean(data));
}

export async function deleteEquipe(id: string) {
  await deleteDoc(doc(db, "equipes", id));
}

export async function getMusica(id: string): Promise<Musica | null> {
  const snap = await getDoc(doc(db, "musicas", id));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id, createdAt: toDate(snap.data().createdAt) } as Musica;
}

// ── ESCALAS ────────────────────────────────────────────────────────────────────
export async function getEscalas(igrejaId?: string): Promise<Escala[]> {
  const q = query(collection(db, "escalas"), orderBy("data", "desc"));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Escala));
  return byIgreja(all, igrejaId);
}

export async function createEscala(data: Omit<Escala, "id" | "createdAt">) {
  return addDoc(collection(db, "escalas"), { ...clean(data), createdAt: serverTimestamp() });
}

export async function updateEscala(id: string, data: Partial<Escala>) {
  await updateDoc(doc(db, "escalas", id), data);
}

export async function deleteEscala(id: string) {
  await deleteDoc(doc(db, "escalas", id));
}

// ── MÚSICAS ────────────────────────────────────────────────────────────────────
function mapVotos(raw: Record<string, unknown>): Record<string, import("./types").MusicaVoto> {
  const result: Record<string, import("./types").MusicaVoto> = {};
  for (const [uid, v] of Object.entries(raw)) {
    const voto = v as Record<string, unknown>;
    result[uid] = { ...voto, votadoEm: toDate(voto.votadoEm) } as import("./types").MusicaVoto;
  }
  return result;
}

function mapMusica(d: { data(): Record<string, unknown>; id: string }): Musica {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    createdAt: toDate(data.createdAt),
    aprovadoEm: data.aprovadoEm ? toDate(data.aprovadoEm) : undefined,
    votos: data.votos ? mapVotos(data.votos as Record<string, unknown>) : undefined,
  } as Musica;
}

/** Retorna músicas aprovadas (ou sem status = retrocompat). Usada em repertório e setlists. */
export async function getMusicas(igrejaId?: string): Promise<Musica[]> {
  const q = query(collection(db, "musicas"), orderBy("titulo"));
  const snap = await getDocs(q);
  const all = snap.docs.map(mapMusica);
  const aprovadas = all.filter(m => !m.status || m.status === "aprovada");
  return byIgreja(aprovadas, igrejaId);
}

/** Retorna músicas pendentes de aprovação (todos os pastores votam em todas). */
export async function getMusicasPendentes(): Promise<Musica[]> {
  const q = query(collection(db, "musicas"), where("status", "==", "pendente"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(mapMusica);
}

/** Retorna todas as músicas criadas por um usuário (qualquer status). */
export async function getMusicasByLider(uid: string, igrejaId?: string): Promise<Musica[]> {
  const q = query(collection(db, "musicas"), where("createdBy", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const all = snap.docs.map(mapMusica);
  return byIgreja(all, igrejaId);
}

export async function createMusica(data: Omit<Musica, "id" | "createdAt">) {
  return addDoc(collection(db, "musicas"), { ...clean(data), createdAt: serverTimestamp() });
}

export async function updateMusica(id: string, data: Partial<Musica>) {
  await updateDoc(doc(db, "musicas", id), clean(data));
}

export async function deleteMusica(id: string) {
  await deleteDoc(doc(db, "musicas", id));
}

/** Retorna todos os pastores ativos de todas as igrejas (formato novo: roles array). */
export async function getAllPastores(): Promise<AppUser[]> {
  // Filtra diretamente no Firestore — compatível com a regra de segurança que permite
  // leitura de qualquer usuário com role "pastor" por qualquer membro autenticado
  const q = query(collection(db, "users"), where("roles", "array-contains", "pastor"));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({
      ...d.data(),
      uid: d.id,
      roles: normalizeRoles(d.data() as Record<string, unknown>),
      createdAt: toDate(d.data().createdAt),
    } as AppUser))
    .filter(u => u.ativo !== false); // inclui ativos (undefined = ativo por retrocompat)
}

/** Registra o voto de um pastor em uma música e auto-aprova quando todos votaram. */
export async function votarMusica(
  musicaId: string,
  pastor: { uid: string; name: string; igrejaId?: string },
  pontuacao: number,
  comentario: string
): Promise<void> {
  await updateDoc(doc(db, "musicas", musicaId), {
    [`votos.${pastor.uid}`]: clean({
      pastorUid: pastor.uid,
      pastorName: pastor.name,
      igrejaId: pastor.igrejaId,
      pontuacao,
      comentario: comentario || undefined,
      votadoEm: serverTimestamp(),
    }),
  });

  const [musicaSnap, pastores] = await Promise.all([
    getDoc(doc(db, "musicas", musicaId)),
    getAllPastores(),
  ]);

  const votos = (musicaSnap.data()?.votos ?? {}) as Record<string, { pontuacao: number }>;
  const todosVotaram = pastores.length > 0 && pastores.every(p => votos[p.uid]);

  if (todosVotaram) {
    const valores = Object.values(votos);
    const media = valores.reduce((s, v) => s + v.pontuacao, 0) / valores.length;
    const status: import("./types").MusicaStatus = media >= 3.5 ? "aprovada" : "rejeitada";
    await updateDoc(doc(db, "musicas", musicaId), { status, mediaVotos: media });
  }
}

/** Retorna os IDs das músicas do repertório de uma equipe. */
export async function getRepertorioEquipe(equipeId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, "repertorios_equipe", equipeId));
  return snap.exists() ? (snap.data().musicaIds ?? []) : [];
}

/** Salva o repertório de uma equipe. */
export async function setRepertorioEquipe(
  equipeId: string,
  equipeName: string,
  igrejaId: string,
  musicaIds: string[]
): Promise<void> {
  await setDoc(doc(db, "repertorios_equipe", equipeId), {
    equipeId,
    equipeName,
    igrejaId,
    musicaIds,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── NOTIFICAÇÕES ───────────────────────────────────────────────────────────────
export async function getNotificacoes(igrejaId?: string): Promise<Notificacao[]> {
  const q = query(collection(db, "notificacoes"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const limite = new Date();
  limite.setDate(limite.getDate() - 10); // visível por 10 dias
  const all = snap.docs
    .map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Notificacao))
    .filter(n => n.createdAt >= limite);
  return byIgreja(all, igrejaId);
}

export async function createNotificacao(data: Omit<Notificacao, "id" | "createdAt" | "lidos">) {
  return addDoc(collection(db, "notificacoes"), { ...data, lidos: [], createdAt: serverTimestamp() });
}

export async function marcarNotificacaoLida(id: string, uid: string) {
  const ref = doc(db, "notificacoes", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const lidos: string[] = snap.data().lidos || [];
  if (!lidos.includes(uid)) {
    await updateDoc(ref, { lidos: [...lidos, uid] });
  }
}

// ── PRESTAÇÃO DE CONTAS — PERGUNTAS ────────────────────────────────────────────
export async function getPrestacaoPerguntas(): Promise<PrestacaoPergunta[]> {
  const q = query(collection(db, "prestacao_perguntas"), where("ativa", "==", true), orderBy("ordem"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as PrestacaoPergunta));
}

export async function getAllPrestacaoPerguntas(): Promise<PrestacaoPergunta[]> {
  const q = query(collection(db, "prestacao_perguntas"), orderBy("ordem"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as PrestacaoPergunta));
}

export async function createPrestacaoPergunta(data: Omit<PrestacaoPergunta, "id" | "createdAt">) {
  return addDoc(collection(db, "prestacao_perguntas"), { ...data, createdAt: serverTimestamp() });
}

export async function updatePrestacaoPergunta(id: string, data: Partial<PrestacaoPergunta>) {
  await updateDoc(doc(db, "prestacao_perguntas", id), data);
}

export async function deletePrestacaoPergunta(id: string) {
  await deleteDoc(doc(db, "prestacao_perguntas", id));
}

// ── PRESTAÇÃO DE CONTAS — RESPOSTAS ────────────────────────────────────────────
export async function getPrestacaoResposta(uid: string, mes: string): Promise<PrestacaoResposta | null> {
  const id = `${uid}_${mes}`;
  const snap = await getDoc(doc(db, "prestacao_respostas", id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ...d, id: snap.id, enviadoEm: toDate(d.enviadoEm) } as PrestacaoResposta;
}

export async function savePrestacaoResposta(uid: string, mes: string, data: Omit<PrestacaoResposta, "id" | "enviadoEm">) {
  const id = `${uid}_${mes}`;
  await setDoc(doc(db, "prestacao_respostas", id), { ...data, enviadoEm: serverTimestamp() });
  await registrarRespostaNoControle(uid, mes);
}

export async function getMinhasRespostas(uid: string): Promise<PrestacaoResposta[]> {
  const q = query(
    collection(db, "prestacao_respostas"),
    where("uid", "==", uid),
    orderBy("mes", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, enviadoEm: toDate(d.data().enviadoEm) } as PrestacaoResposta));
}

export async function getRespostasByLider(liderUid: string, mes: string): Promise<PrestacaoResposta[]> {
  const q = query(
    collection(db, "prestacao_respostas"),
    where("liderUid", "==", liderUid),
    where("mes", "==", mes)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, enviadoEm: toDate(d.data().enviadoEm) } as PrestacaoResposta));
}

export async function getAllRespostasByMes(mes: string): Promise<PrestacaoResposta[]> {
  const q = query(collection(db, "prestacao_respostas"), where("mes", "==", mes));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, enviadoEm: toDate(d.data().enviadoEm) } as PrestacaoResposta));
}

// ── PRESTAÇÃO DE CONTAS — CONTROLE ─────────────────────────────────────────────
async function registrarRespostaNoControle(uid: string, mes: string) {
  const ref = doc(db, "prestacao_controle", mes);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const responderam: string[] = snap.data().responderam || [];
    if (!responderam.includes(uid)) {
      await updateDoc(ref, { responderam: [...responderam, uid] });
    }
  } else {
    const prazo = `${mes}-15`;
    await setDoc(ref, { mes, responderam: [uid], totalMusicos: 0, prazo, aberto: true });
  }
}

export async function getPrestacaoControle(mes: string): Promise<PrestacaoControle | null> {
  const snap = await getDoc(doc(db, "prestacao_controle", mes));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as PrestacaoControle;
}

export async function initPrestacaoControle(mes: string, totalMusicos: number) {
  const prazo = `${mes}-15`;
  await setDoc(doc(db, "prestacao_controle", mes), {
    mes, responderam: [], totalMusicos, prazo, aberto: true,
  }, { merge: true });
}
