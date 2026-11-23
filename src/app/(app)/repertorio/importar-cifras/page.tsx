"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, FileDown, Link2, CheckCircle2, Plus, Ban, ChevronDown, ChevronUp, AlertTriangle, Loader2, Music2,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import {
  getEquipes, getMusicas, getCifrasDaEquipe, createMusica, salvarCifrasEmLote, getConfigRepertorio,
} from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import { lerTitulo, limparTextoImportado, semelhancaTitulo, tomMaiorDe, formatarTom } from "@/lib/cifra";
import type { Equipe, Musica, TomMusical } from "@/lib/types";
import CifraVisual from "@/components/cifra/CifraVisual";
import { EsqueletoLista } from "@/components/ui/Esqueleto";

type Acao = "vincular" | "criar" | "ignorar";

interface Linha {
  abaId: string;
  tituloAba: string;
  titulo: string;
  artista?: string;
  tom?: string;
  bpm?: number;
  texto: string;
  acao: Acao;
  musicaId?: string;
  confianca: number;     // 0–1, semelhança com a música vinculada
  jaTemCifra: boolean;   // a equipe já tem cifra para essa música
}

function melhorMusica(titulo: string, musicas: Musica[]): { m?: Musica; s: number } {
  let melhor: Musica | undefined, s = 0;
  for (const m of musicas) {
    const v = semelhancaTitulo(titulo, m.titulo);
    if (v > s) { s = v; melhor = m; }
  }
  return { m: melhor, s };
}

export default function ImportarCifrasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isDiretor = !!user?.roles?.some(r => ["super_admin", "pastor", "diretor_musical"].includes(r));
  const isPastor = !!user?.roles?.some(r => ["super_admin", "pastor"].includes(r));

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [liberacao, setLiberacao] = useState(false);
  const [equipeId, setEquipeId] = useState("");
  const [link, setLink] = useState("");
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [lendo, setLendo] = useState(false);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [origem, setOrigem] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getEquipes(user.igrejaId), getMusicas(), getConfigRepertorio()])
      .then(([eqs, ms, cfg]) => {
        const minhas = isDiretor ? eqs : eqs.filter(e => e.liderId === user.uid);
        setEquipes(minhas);
        setMusicas(ms.filter(m => m.ativo !== false));
        setLiberacao(cfg.liberacaoDireta);
        const primeira = minhas.find(e => e.cifraUrl) ?? minhas[0];
        if (primeira) { setEquipeId(primeira.id); setLink(primeira.cifraUrl ?? ""); }
      })
      .catch(e => toast.error(mensagemErro(e, "Erro ao carregar")))
      .finally(() => setCarregandoBase(false));
  }, [user, isDiretor]);

  const equipe = equipes.find(e => e.id === equipeId);

  function trocarEquipe(id: string) {
    setEquipeId(id);
    setLink(equipes.find(e => e.id === id)?.cifraUrl ?? "");
    setLinhas(null);
  }

  async function lerDocumento() {
    if (!equipe) { toast.error("Escolha a equipe"); return; }
    if (!link.trim()) { toast.error("Cole o link do Google Docs"); return; }
    setLendo(true);
    setLinhas(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/google-doc?url=${encodeURIComponent(link.trim())}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao ler o documento"); return; }
      if (!data.separadoPorAbas) {
        toast.info("Este documento não tem abas: ele veio como uma música só. Divida em abas no Google Docs (uma por música) para importar tudo de uma vez.");
      }
      const existentes = new Set((await getCifrasDaEquipe(equipe.id, user!.igrejaId)).map(c => c.musicaId));
      const novas: Linha[] = (data.abas as { id: string; titulo: string; texto: string }[]).map(a => {
        const lido = lerTitulo(a.titulo);
        const { m, s } = melhorMusica(lido.titulo, musicas);
        const vincula = !!m && s >= 0.8;
        return {
          abaId: a.id,
          tituloAba: a.titulo,
          ...lido,
          texto: limparTextoImportado(a.titulo, a.texto),
          acao: vincula ? "vincular" : "criar",
          musicaId: vincula ? m!.id : undefined,
          confianca: vincula ? s : 0,
          jaTemCifra: vincula ? existentes.has(m!.id) : false,
        };
      });
      setLinhas(novas.filter(l => l.texto.trim()));
      setOrigem(`Google Docs · ${data.tituloDoc ?? "documento"}`);
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao ler o documento"));
    } finally {
      setLendo(false);
    }
  }

  function alterar(abaId: string, mudanca: Partial<Linha>) {
    setLinhas(ls => ls?.map(l => l.abaId === abaId ? { ...l, ...mudanca } : l) ?? null);
  }

  // Músicas vinculadas por mais de uma aba (só a última seria salva)
  const repetidas = useMemo(() => {
    const cont = new Map<string, number>();
    linhas?.filter(l => l.acao === "vincular" && l.musicaId).forEach(l => cont.set(l.musicaId!, (cont.get(l.musicaId!) ?? 0) + 1));
    return new Set(Array.from(cont.entries()).filter(([, n]) => n > 1).map(([id]) => id));
  }, [linhas]);

  const resumo = {
    vincular: linhas?.filter(l => l.acao === "vincular" && l.musicaId).length ?? 0,
    criar: linhas?.filter(l => l.acao === "criar").length ?? 0,
    ignorar: linhas?.filter(l => l.acao === "ignorar").length ?? 0,
  };

  async function importar() {
    if (!linhas || !equipe || !user) return;
    if (repetidas.size) { toast.error("Há músicas vinculadas a mais de uma aba. Ajuste antes de importar."); return; }
    const alvo = linhas.filter(l => (l.acao === "vincular" && l.musicaId) || l.acao === "criar");
    if (!alvo.length) { toast.error("Nada para importar"); return; }
    const substitui = alvo.filter(l => l.acao === "vincular" && l.jaTemCifra).length;
    if (!confirm(`Importar ${alvo.length} cifra(s) para a equipe ${equipe.name}?` +
      (resumo.criar ? `\n${resumo.criar} música(s) nova(s) serão criadas no repertório.` : "") +
      (substitui ? `\n${substitui} cifra(s) já existentes serão substituídas.` : ""))) return;

    setSalvando(true);
    try {
      const aprovada = isPastor || liberacao;
      const cifras = [];
      for (const l of alvo) {
        let musicaId = l.musicaId;
        if (l.acao === "criar") {
          const ref = await createMusica({
            titulo: l.titulo, artista: l.artista || "Não informado",
            tom: (tomMaiorDe(l.tom) ?? "C") as TomMusical, bpm: l.bpm, tags: [], ativo: true,
            status: aprovada ? "aprovada" : "pendente", createdBy: user.uid, igrejaId: user.igrejaId,
          });
          musicaId = ref.id;
        }
        cifras.push({
          musicaId: musicaId!, equipeId: equipe.id, equipeName: equipe.name, igrejaId: equipe.igrejaId ?? user.igrejaId,
          texto: l.texto, tom: l.tom ? formatarTom(l.tom) : undefined, origem,
        });
      }
      await salvarCifrasEmLote(cifras, { uid: user.uid, name: user.name });
      toast.success(`${cifras.length} cifra(s) importada(s) para ${equipe.name}!`);
      if (!aprovada && resumo.criar) toast.info("As músicas novas foram para votação dos pastores.");
      router.push("/repertorio");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao importar"));
    } finally {
      setSalvando(false);
    }
  }

  const opcoesMusicas = useMemo(() => [...musicas].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")), [musicas]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/repertorio")} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl" aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileDown size={22} className="text-primary-500" /> Importar cifras</h1>
          <p className="text-sm text-gray-500">Do Google Docs da equipe — uma aba por música</p>
        </div>
      </div>

      {carregandoBase ? <EsqueletoLista itens={2} /> : equipes.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">Você não lidera nenhuma equipe. Peça ao diretor ou ao pastor para importar.</div>
      ) : (
        <section className="card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className="label">Equipe</label>
              <select value={equipeId} onChange={e => trocarEquipe(e.target.value)} className="input">
                {equipes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Link2 size={13} /> Link do Google Docs</label>
              <input value={link} onChange={e => setLink(e.target.value)} className="input" placeholder="https://docs.google.com/document/d/..." />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            O documento precisa estar em <strong>Compartilhar → Qualquer pessoa com o link (Leitor)</strong>. Cada aba vira uma música; o nome da aba traz o título e o tom (ex.: “Graça: D”).
          </p>
          <button onClick={lerDocumento} disabled={lendo} className="btn-primary">
            {lendo ? <><Loader2 size={16} className="animate-spin" /> Lendo as abas…</> : <><FileDown size={16} /> Ler documento</>}
          </button>
        </section>
      )}

      {lendo && <EsqueletoLista itens={5} />}

      {linhas && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="badge bg-green-100 text-green-700"><CheckCircle2 size={11} /> {resumo.vincular} vincular</span>
            <span className="badge bg-primary-100 text-primary-700"><Plus size={11} /> {resumo.criar} criar</span>
            <span className="badge bg-gray-100 text-gray-600"><Ban size={11} /> {resumo.ignorar} ignorar</span>
            <span className="text-xs text-gray-400 ml-auto">{linhas.length} abas lidas</span>
          </div>

          <div className="space-y-2 cascata">
            {linhas.map(l => {
              const musica = musicas.find(m => m.id === l.musicaId);
              const repetida = !!l.musicaId && repetidas.has(l.musicaId) && l.acao === "vincular";
              return (
                <div key={l.abaId} className={clsx("card overflow-hidden", l.acao === "ignorar" && "opacity-50", repetida && "border-amber-300/50")}>
                  <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <button onClick={() => setAberta(aberta === l.abaId ? null : l.abaId)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                        <Music2 size={17} className="text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{l.titulo}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {[l.tom && `Tom ${formatarTom(l.tom)}`, l.artista, l.bpm && `${l.bpm} BPM`].filter(Boolean).join(" · ") || l.tituloAba}
                        </p>
                      </div>
                      {aberta === l.abaId ? <ChevronUp size={16} className="text-gray-400 ml-auto" /> : <ChevronDown size={16} className="text-gray-400 ml-auto" />}
                    </button>

                    <div className="flex flex-col sm:items-end gap-1.5 sm:w-72 shrink-0">
                      <div className="flex gap-1 bg-white/5 rounded-xl p-0.5 self-stretch sm:self-end">
                        {(["vincular", "criar", "ignorar"] as Acao[]).map(a => (
                          <button key={a} onClick={() => alterar(l.abaId, { acao: a })}
                            className={clsx("flex-1 px-2.5 py-1 rounded-lg text-xs font-medium capitalize",
                              l.acao === a ? "bg-primary-500 text-white" : "text-gray-500 hover:text-gray-800")}>
                            {a}
                          </button>
                        ))}
                      </div>
                      {l.acao === "vincular" && (
                        <select
                          value={l.musicaId ?? ""}
                          onChange={e => alterar(l.abaId, { musicaId: e.target.value || undefined, confianca: 1, jaTemCifra: false })}
                          className="input py-1.5 text-xs">
                          <option value="">Escolha a música…</option>
                          {opcoesMusicas.map(m => <option key={m.id} value={m.id}>{m.titulo} — {m.artista}</option>)}
                        </select>
                      )}
                      {l.acao === "vincular" && musica && l.confianca < 1 && (
                        <p className="text-[11px] text-gray-400">Sugestão automática ({Math.round(l.confianca * 100)}% parecido)</p>
                      )}
                      {l.acao === "vincular" && l.jaTemCifra && <p className="text-[11px] text-amber-600">A equipe já tem cifra: será substituída</p>}
                      {repetida && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle size={11} /> Outra aba já está vinculada a esta música</p>}
                      {l.acao === "criar" && <p className="text-[11px] text-gray-400">Cria “{l.titulo}” no repertório</p>}
                    </div>
                  </div>
                  {aberta === l.abaId && (
                    <div className="border-t border-white/5 p-4 bg-black/10 max-h-96 overflow-y-auto">
                      <CifraVisual texto={l.texto} tom={l.tom} tamanho={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Barra de ação fixa */}
          <div className="fixed bottom-24 md:bottom-6 left-3 right-3 md:left-auto md:right-8 md:w-96 z-30">
            <button onClick={importar} disabled={salvando} className="btn-primary w-full py-3.5 text-base shadow-glow">
              {salvando ? <><Loader2 size={16} className="animate-spin" /> Importando…</> : <>Importar {resumo.vincular + resumo.criar} cifra(s)</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
