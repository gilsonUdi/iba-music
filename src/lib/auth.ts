import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  type User,
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { auth, firebaseConfig } from "./firebase";
import { createUser, getUser } from "./firestore";
import type { UserRole } from "./types";

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * Cria um novo usuário SEM alterar a sessão do usuário atual.
 *
 * Problema: createUserWithEmailAndPassword faz login automático, e o Firebase
 * compartilha o localStorage entre todas as instâncias de auth no mesmo tab.
 * Isso fazia o admin ser "substituído" pelo novo usuário criado.
 *
 * Solução: usar inMemoryPersistence na instância secundária para que ela nunca
 * grave no localStorage, preservando a sessão do admin intacta.
 */
export interface RegisterExtras {
  instrumento?: import("./types").Instrumento;
  instrumentos?: import("./types").Instrumento[];
  instrumentoPrincipal?: import("./types").Instrumento;
  telefone?: string;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  roles: UserRole[],
  liderUid?: string,
  igrejaId?: string,
  extras?: RegisterExtras
): Promise<User> {
  // Instância secundária com nome único para não conflitar
  const secondaryApp = initializeApp(firebaseConfig, `reg_${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  // CRÍTICO: inMemoryPersistence impede que o novo usuário seja gravado no
  // localStorage compartilhado, evitando sobrescrever a sessão do admin.
  await setPersistence(secondaryAuth, inMemoryPersistence);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await createUser(cred.user.uid, { email, name, roles, liderUid, igrejaId, ...extras });
    return cred.user;
  } finally {
    // Destrói a instância secundária — sessão principal continua intacta
    await deleteApp(secondaryApp);
  }
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export { getUser };
