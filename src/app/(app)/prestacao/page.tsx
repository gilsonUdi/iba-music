"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getPrestacaoPerguntas, getPrestacaoResposta, savePrestacaoResposta,
  getMinhasRespostas,
} from "@/lib/firestore";
import type { PrestacaoPergunta, PrestacaoResposta } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ClipboardCheck, CheckCircle2, Lock, AlertCircle, Send, ChevronRight } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export default function PrestacaoPage() {
  const { user } = useAuth();
  const mes = format(new Date(), "yyyy-MM");
  const mesFormatado = format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  const prazo = `${mes}-15`;
  const prazoFormatado = format(parseISO(prazo), "dd 'de' MMMM", { locale: ptBR });
  const hoje = new Date();
  const diasRestantes = Math.ceil((parseISO(prazo).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  const atrasado = diasRestantes < 0;

  const [perguntas, setPerguntas] = useState<PrestacaoPergunta[]>([]);
  const [respostaExistente, setRespostaExistente] = useState<PrestacaoResposta | null>(null);
  const [historico, setHistorico] = useState<PrestacaoResposta[]>([]);
  const [expandedHist, setExpandedHist] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string | number | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [step, setStep] = useState(0); // 0 = intro, 1..N = perguntas, final = confirmação

  useEffect(() => {
    if (!user || !user.roles?.includes("musico")) { setLoading(false); return; }
    async function load() {
      const [perg, resp, hist] = await Promise.all([
        getPrestacaoPerguntas(),
        getPrestacaoResposta(user!.uid, mes),
        getMinhasRespostas(user!.uid),
      ]);
      setPerguntas(perg);
      setRespostaExistente(resp);
      setHistorico(hist);
      setLoading(false);
    }
    load();
  }, [user, mes]);

  async function handleEnviar() {
    // Validar obrigatórias
    const faltando = perguntas.filter(p => p.obrigatoria && !respostas[p.id] && respostas[p.id] !== 0);
    if (faltando.length > 0) {
      toast.error(`Responda todas as perguntas obrigatórias (${faltando.length} pendentes)`);
      return;
    }

    setEnviando(true);
    try {
      await savePrestacaoResposta(user!.uid, mes, {
        uid: user!.uid,
        musicoName: user!.name,
        liderUid: user!.liderUid ?? "",
        mes,
        respostas,
      });
      toast.success("Prestação de contas enviada com sucesso!");
      setStep(perguntas.length + 1); // tela de sucesso
      // Recarregar
      const resp = await getPrestacaoResposta(user!.uid, mes);
      setRespostaExistente(resp);
    } finally {
      setEnviando(false);
    }
  }

  // Pastores/líderes veem menu de navegação
  if (user?.roles?.includes("pastor")) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={24} className="text-primary-500" /> Prestação de Contas
          </h1>
          <p className="text-gray-500 mt-1">Gerencie o formulário mensal do ministério</p>
        </div>
        <div className="grid gap-4">
          <Link href="/prestacao/perguntas" className="card p-6 hover:shadow-md transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <ClipboardCheck size={22} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Gerenciar Perguntas</h2>
              <p className="text-sm text-gray-500 mt-0.5">Criar, editar e organizar as perguntas do formulário</p>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          <Link href="/prestacao/relatorio" className="card p-6 hover:shadow-md transition-shadow flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
              <CheckCircle2 size={22} className="text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Relatório de Respostas</h2>
              <p className="text-sm text-gray-500 mt-0.5">Ver quem respondeu e quem ainda não respondeu</p>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
        </div>
      </div>
    );
  }

  if (user?.roles?.includes("lider_celula")) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={24} className="text-primary-500" /> Prestação de Contas
          </h1>
          <p className="text-gray-500 mt-1">Acompanhe as prestações de contas da sua equipe</p>
        </div>
        <Link href="/prestacao/relatorio" className="card p-6 hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={22} className="text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">Ver Respostas da Minha Equipe</h2>
            <p className="text-sm text-gray-500 mt-0.5">Acompanhe quem já respondeu este mês</p>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Já respondeu
  if (respostaExistente) {
    const historicoAnteriores = historico.filter(h => h.mes !== mes);
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Prestação enviada!</h1>
          <p className="text-gray-500">
            Você já respondeu o formulário de <span className="capitalize font-medium">{mesFormatado}</span>.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Enviado em {format(respostaExistente.enviadoEm, "dd/MM/yyyy 'às' HH:mm")}
          </p>
          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-start gap-2 text-amber-700">
              <Lock size={15} className="shrink-0 mt-0.5" />
              <p className="text-sm">Suas respostas são <strong>confidenciais</strong> e visíveis apenas para você e seu líder de célula.</p>
            </div>
          </div>
        </div>

        {/* Histórico de meses anteriores */}
        {historicoAnteriores.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">Histórico de respostas</h2>
              <p className="text-xs text-gray-400 mt-0.5">Somente leitura — suas respostas anteriores</p>
            </div>
            <div className="divide-y divide-gray-50">
              {historicoAnteriores.map(h => {
                const isOpen = expandedHist === h.mes;
                const mesLabel = format(parseISO(`${h.mes}-01`), "MMMM 'de' yyyy", { locale: ptBR });
                return (
                  <div key={h.mes}>
                    <button
                      onClick={() => setExpandedHist(isOpen ? null : h.mes)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{mesLabel}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Enviado em {format(h.enviadoEm, "dd/MM/yyyy")}
                        </p>
                      </div>
                      <ChevronDown size={16} className={clsx("text-gray-400 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 bg-gray-50 border-t border-gray-100 space-y-4">
                        {perguntas.map(p => {
                          const valor = h.respostas[p.id];
                          return (
                            <div key={p.id}>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{p.texto}</p>
                              <p className="text-sm text-gray-800 bg-white rounded-xl px-4 py-3 border border-gray-100">
                                {Array.isArray(valor) ? valor.join(", ") : String(valor ?? "—")}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (perguntas.length === 0) {
    return (
      <div className="max-w-lg mx-auto card p-8 text-center text-gray-400">
        <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
        <p>Nenhuma pergunta cadastrada ainda.</p>
        <p className="text-sm mt-1">Aguarde seu pastor configurar o formulário.</p>
      </div>
    );
  }

  const totalSteps = perguntas.length;
  const progress = step === 0 ? 0 : Math.round((step / totalSteps) * 100);

  // Tela de sucesso
  if (step === totalSteps + 1) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enviado com sucesso!</h1>
          <p className="text-gray-500">Obrigado por responder sua prestação de contas de <span className="capitalize font-medium">{mesFormatado}</span>.</p>
          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-start gap-2 text-amber-700">
              <Lock size={15} className="shrink-0 mt-0.5" />
              <p className="text-sm">Suas respostas são <strong>confidenciais</strong> e visíveis apenas para você e seu líder.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela intro
  if (step === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-8">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ClipboardCheck size={30} className="text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Prestação de Contas</h1>
          <p className="text-center text-gray-500 mb-2 capitalize">{mesFormatado}</p>

          {atrasado ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">O prazo de <strong>{prazoFormatado}</strong> passou. Responda assim que possível.</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Prazo: <strong>{prazoFormatado}</strong>
                {diasRestantes > 0 ? ` (${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} restante${diasRestantes > 1 ? "s" : ""})` : " (hoje!)"}
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600">Este formulário tem <strong>{totalSteps} pergunta{totalSteps > 1 ? "s" : ""}</strong> sobre sua integridade e testemunho neste mês.</p>
            <div className="flex items-center gap-2 mt-3 text-amber-700">
              <Lock size={14} className="shrink-0" />
              <p className="text-xs">Suas respostas são <strong>confidenciais</strong>. Apenas você e seu líder poderão visualizá-las.</p>
            </div>
          </div>

          <button onClick={() => setStep(1)} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            Começar <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Perguntas
  const perguntaAtual = perguntas[step - 1];
  const resposta = respostas[perguntaAtual.id];

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>Pergunta {step} de {totalSteps}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="card p-8">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
          Prestação de contas · {mesFormatado}
        </p>
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {perguntaAtual.texto}
          {perguntaAtual.obrigatoria && <span className="text-red-500 ml-1">*</span>}
        </h2>

        {/* Tipos de resposta */}
        {perguntaAtual.tipo === "sim_nao" && (
          <div className="flex gap-3">
            {["Sim", "Não"].map(op => (
              <button
                key={op}
                onClick={() => setRespostas(r => ({ ...r, [perguntaAtual.id]: op }))}
                className={clsx(
                  "flex-1 py-4 rounded-xl border-2 font-medium transition-all",
                  resposta === op
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                )}
              >
                {op}
              </button>
            ))}
          </div>
        )}

        {perguntaAtual.tipo === "escala" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setRespostas(r => ({ ...r, [perguntaAtual.id]: n }))}
                  className={clsx(
                    "flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all",
                    resposta === n
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-gray-200 text-gray-600 hover:border-primary-300"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 px-1">
              <span>Ruim</span>
              <span>Ótimo</span>
            </div>
          </div>
        )}

        {perguntaAtual.tipo === "multipla_escolha" && (
          <div className="space-y-2">
            {perguntaAtual.opcoes?.map(op => (
              <button
                key={op.id}
                onClick={() => setRespostas(r => ({ ...r, [perguntaAtual.id]: op.label }))}
                className={clsx(
                  "w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all",
                  resposta === op.label
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                )}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}

        {perguntaAtual.tipo === "texto" && (
          <textarea
            value={typeof resposta === "string" ? resposta : ""}
            onChange={e => setRespostas(r => ({ ...r, [perguntaAtual.id]: e.target.value }))}
            className="input resize-none"
            rows={4}
            placeholder="Escreva sua resposta aqui..."
          />
        )}

        {/* Navegação */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary px-5">
              Voltar
            </button>
          )}
          {step < totalSteps ? (
            <button
              onClick={() => {
                if (perguntaAtual.obrigatoria && !respostas[perguntaAtual.id] && respostas[perguntaAtual.id] !== 0) {
                  toast.error("Esta pergunta é obrigatória");
                  return;
                }
                setStep(s => s + 1);
              }}
              className="btn-primary flex-1 py-3"
            >
              Próxima
            </button>
          ) : (
            <button
              onClick={handleEnviar}
              disabled={enviando}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
            >
              {enviando ? "Enviando..." : <><Send size={16} /> Enviar prestação de contas</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
