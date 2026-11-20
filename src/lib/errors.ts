/** Converte erros do Firebase em mensagens amigáveis para o usuário. */
export function mensagemErro(e: unknown, padrao = "Algo deu errado. Tente novamente."): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Você não tem permissão para esta ação.";
  }
  if (code === "unavailable" || code === "auth/network-request-failed") {
    return "Sem conexão. Verifique sua internet e tente novamente.";
  }
  if (code === "auth/email-already-in-use") return "E-mail já cadastrado";
  console.error(e);
  return padrao;
}
