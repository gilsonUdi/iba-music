"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Calendar, Library, Users, Bell, ClipboardCheck, AlertCircle, CheckCircle2, XCircle,
  ChevronRight, Youtube, ListMusic, Sparkles, Plus, Users2, Maximize2,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import {
  getEscalas, getMusicas, getAllMusicos, getNotificacoes, getPrestacaoControle, confirmarPresenca,
} from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import { CULTO_LABELS, type Escala, type Musica, type Notificacao } from "@/lib/types";
import { playlistYoutube, resolverSetlist } from "@/lib/exportar";
import { PaletaResumo } from "@/components/escalas/PaletaPicker";
import { Esqueleto } from "@/components/ui/Esqueleto";

function textoContagem(data: string): string {
  const dias = differenceInCalendarDays(parseISO(data), new Date());
  if (dias <= 0) return "É hoje!";
  if (dias === 1) return "Amanhã";
  return `Faltam ${dias} dias`;
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [totalMusicos, setTotalMusicos] = useState(0);
  const [naoLidas, setNaoLidas] = useState<Notificacao[]>([]);
  const [prestacaoPendente, setPrestacaoPendente] = useState(false);
  const [respondendo, setRespondendo] = useState(false);

  const isLider = !!user?.roles?.some(r => ["pastor", "diretor_musical", "lider_equipe", "super_admin"].includes(r));

  async function load() {
    if (!user) return;
    try {
      const [esc, mus, musicos, notifs] = await Promise.all([
        getEscalas(user.igrejaId),
        getMusicas(),
        isLider ? getAllMusicos(user.igrejaId) : Promise.resolve([]),
        getNotificacoes(user.igrejaId),
      ]);
      setEscalas(esc);
      setMusicas(mus.filter(m => m.ativo !== false));
      setTotalMusicos(musicos.length);
      setNaoLidas(notifs.filter(n => {
        const dest = n.destinatarios;
        const relevante = dest === "todos" || (Array.isArray(dest) && dest.includes(user.uid));
        return relevante && !n.lidos.includes(user.uid);
      }));

      const deveResponder = (user.roles?.includes("musico") || user.roles?.includes("lider_equipe"))
        && !user.roles?.includes("pastor") && !user.roles?.includes("lider_celula");
      if (deveResponder) {
        const controle = await getPrestacaoControle(format(new Date(), "yyyy-MM"));
        setPrestacaoPendente(!!controle && !controle.responderam.includes(user.uid));
      }
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao carregar o início"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user]);

  // Próximas escalas (da mais próxima para a mais distante)
  const hoje = format(new Date(), "yyyy-MM-dd");
  const futuras = useMemo(
    () => escalas.filter(e => e.data.slice(0, 10) >= hoje).sort((a, b) => a.data.localeCompare(b.data)),
    [escalas, hoje],
  );
  // Destaque: a próxima em que estou escalado; senão a próxima da igreja
  const destaque = futuras.find(e => e.membros.some(m => m.uid === user?.uid)) ?? futuras[0] ?? null;
  const meuStatus = destaque?.membros.find(m => m.uid === user?.uid);
  const itens = destaque ? resolverSetlist(destaque, musicas) : [];
  const playlist = playlistYoutube(itens);
  const confirmados = destaque?.membros.filter(m => m.confirmado === true).length ?? 0;
  const outras = futuras.filter(e => e.id !== destaque?.id).slice(0, 3);

  async function responder(confirmado: boolean) {
    if (!destaque || !user) return;
    setRespondendo(true);
    try {
      await confirmarPresenca(destaque.id, user.uid, confirmado);
      toast.success(confirmado ? "Presença confirmada! 🎶" : "Ausência registrada");
      await load();
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao registrar sua resposta"));
    } finally {
      setRespondendo(false);
    }
  }

  const stats = [
    ...(isLider ? [{ href: "/membros", label: "Músicos ativos", valor: totalMusicos, icon: Users, cor: "from-sky-500 to-blue-500" }] : []),
    { href: "/repertorio", label: "Músicas", valor: musicas.length, icon: Library, cor: "from-violet-500 to-fuchsia-500" },
    { href: "/escalas", label: "Próximos cultos", valor: futuras.length, icon: Calendar, cor: "from-emerald-500 to-teal-500" },
    { href: "/notificacoes", label: "Avisos novos", valor: naoLidas.length, icon: Bell, cor: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Saudação */}
      <header className="pt-1">
        <p className="text-sm text-gray-400 capitalize">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-1">
          {saudacao()}, <span className="texto-neon">{user?.name.split(" ")[0]}</span>
        </h1>
      </header>

      {prestacaoPendente && (
        <Link href="/prestacao" className="card card-interativo p-4 flex items-center gap-3 border-amber-200/40 animate-fade-up">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">Prestação de contas pendente</p>
            <p className="text-sm text-gray-500">Responda o formulário deste mês até o dia 15.</p>
          </div>
          <ChevronRight size={18} className="text-amber-600" />
        </Link>
      )}

      {/* ── Próximo culto ── */}
      {loading ? (
        <Esqueleto className="h-64 w-full rounded-3xl" />
      ) : destaque ? (
        <section className="relative overflow-hidden rounded-3xl p-5 md:p-7 animate-fade-up"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.38), rgba(192,38,211,0.22) 55%, rgba(22,16,48,0.6))",
            border: "1px solid rgba(167,139,250,0.28)",
            boxShadow: "0 30px 60px -30px rgba(124,58,237,0.7)",
          }}>
          {/* luzes */}
          <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-violet-500/30 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-start gap-5">
            {/* data */}
            <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-1 shrink-0">
              <div className="w-20 h-20 rounded-3xl flex flex-col items-center justify-center bg-white/10 border border-white/15 backdrop-blur">
                <span className="text-3xl font-bold text-white leading-none" style={{ fontFamily: "Sora, sans-serif" }}>
                  {format(parseISO(destaque.data), "dd")}
                </span>
                <span className="text-xs uppercase tracking-widest text-white/70">{format(parseISO(destaque.data), "MMM", { locale: ptBR })}</span>
              </div>
              <div className="md:mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 flex items-center gap-1">
                  <Sparkles size={11} /> Próximo culto
                </p>
                <p className="text-lg font-bold text-white">{textoContagem(destaque.data)}</p>
              </div>
            </div>

            {/* detalhes */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-white capitalize">
                  {CULTO_LABELS[destaque.tipoCulto] ?? destaque.tipoCulto}
                  <span className="text-white/50 font-normal text-lg"> · {format(parseISO(destaque.data), "EEEE", { locale: ptBR })}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-white/75">
                  {destaque.equipeName && <span className="flex items-center gap-1"><Users2 size={14} /> {destaque.equipeName}</span>}
                  <span className="flex items-center gap-1"><CheckCircle2 size={14} /> {confirmados}/{destaque.membros.length} confirmados</span>
                  <PaletaResumo cores={destaque.paletaCores ?? []} />
                </div>
              </div>

              {/* minha presença */}
              {meuStatus && (
                meuStatus.confirmado === null ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-black/20 rounded-2xl p-3 border border-white/10">
                    <p className="text-sm text-white flex-1">Você está escalado(a). Vai participar?</p>
                    <div className="flex gap-2">
                      <button disabled={respondendo} onClick={() => responder(true)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:brightness-110">
                        <CheckCircle2 size={16} /> Confirmar
                      </button>
                      <button disabled={respondendo} onClick={() => responder(false)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold border border-white/15 hover:bg-white/15">
                        <XCircle size={16} /> Não poderei
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={clsx("inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full",
                    meuStatus.confirmado ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200")}>
                    {meuStatus.confirmado ? <><CheckCircle2 size={15} /> Presença confirmada</> : <><XCircle size={15} /> Você informou ausência</>}
                  </p>
                )
              )}

              {/* setlist */}
              {itens.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 mb-2 flex items-center gap-1">
                    <ListMusic size={12} /> Setlist
                  </p>
                  <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 cascata">
                    {itens.slice(0, 6).map((i, n) => (
                      <li key={i.id}>
                        <Link href={i.musicaId ? `/repertorio/${i.musicaId}` : "#"}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 transition-colors">
                          <span className="text-xs font-bold text-white/40 w-4">{n + 1}</span>
                          <span className="text-sm text-white truncate flex-1">{i.titulo}</span>
                          {i.tomFinal && <span className="text-[11px] font-bold text-white/80 bg-white/10 px-1.5 py-0.5 rounded-md">{i.tomFinal}</span>}
                        </Link>
                      </li>
                    ))}
                  </ol>
                  {itens.length > 6 && <p className="text-xs text-white/50 mt-1.5">+{itens.length - 6} músicas</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/escalas?abrir=${destaque.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-[#2a1260] text-sm font-semibold hover:brightness-95"
                  style={{ backgroundColor: "#fff" }}>
                  Ver escala <ChevronRight size={15} />
                </Link>
                {itens.length > 0 && (
                  <Link href={`/estante?escala=${destaque.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold border border-white/15 hover:bg-white/15">
                    <Maximize2 size={15} /> Estante
                  </Link>
                )}
                {playlist && (
                  <a href={playlist.url} target="_blank" rel="noopener"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold border border-white/15 hover:bg-white/15">
                    <Youtube size={15} /> Ouvir o setlist
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="card p-8 text-center">
          <Calendar size={36} className="mx-auto text-primary-500 mb-3" />
          <p className="font-semibold text-gray-900">Nenhum culto agendado</p>
          <p className="text-sm text-gray-500 mt-1">Quando uma escala for criada, ela aparece aqui.</p>
          {isLider && (
            <Link href="/escalas" className="btn-primary mt-4 inline-flex"><Plus size={16} /> Criar escala</Link>
          )}
        </section>
      )}

      {/* ── Números ── */}
      <section className={clsx("grid gap-3 cascata", stats.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3")}>
        {stats.map(({ href, label, valor, icon: Icon, cor }) => (
          <Link key={href} href={href} className="card card-interativo p-4 group">
            <div className={clsx("w-10 h-10 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg mb-3", cor)}>
              <Icon size={19} className="text-white" />
            </div>
            {loading ? <Esqueleto className="h-7 w-12" /> : (
              <p className="text-3xl font-bold text-gray-900 tabular-nums" style={{ fontFamily: "Sora, sans-serif" }}>{valor}</p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Próximos cultos */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Também vem aí</h2>
            <Link href="/escalas" className="text-sm text-primary-600 hover:text-primary-700">Ver todas</Link>
          </div>
          {outras.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum outro culto agendado.</p>
          ) : (
            <ul className="space-y-2 cascata">
              {outras.map(e => {
                const eu = e.membros.find(m => m.uid === user?.uid);
                return (
                  <li key={e.id}>
                    <Link href={`/escalas?abrir=${e.id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <div className="w-11 h-11 rounded-xl bg-primary-50 flex flex-col items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary-700 leading-none">{format(parseISO(e.data), "dd")}</span>
                        <span className="text-[10px] uppercase text-primary-600">{format(parseISO(e.data), "MMM", { locale: ptBR })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{CULTO_LABELS[e.tipoCulto] ?? e.tipoCulto}</p>
                        <p className="text-xs text-gray-400 truncate">{e.equipeName ?? "Sem equipe"}</p>
                      </div>
                      {eu && <span className="badge bg-primary-100 text-primary-700">Escalado</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Avisos */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Avisos</h2>
            <Link href="/notificacoes" className="text-sm text-primary-600 hover:text-primary-700">Ver todos</Link>
          </div>
          {naoLidas.length > 0 ? (
            <ul className="space-y-2 cascata">
              {naoLidas.slice(0, 3).map(n => (
                <li key={n.id}>
                  <Link href="/notificacoes" className="flex items-start gap-3 p-3 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-400 shadow-glow shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.mensagem}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Tudo em dia! Nenhum aviso novo.</p>
          )}
        </section>
      </div>

      {/* Atalhos para quem gerencia */}
      {isLider && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 cascata">
          {[
            { href: "/escalas", label: "Nova escala", icon: Calendar },
            { href: "/repertorio", label: "Adicionar música", icon: Library },
            { href: "/notificacoes", label: "Enviar aviso", icon: Bell },
            { href: "/prestacao", label: "Prestação de contas", icon: ClipboardCheck },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={label} href={href} className="card card-interativo p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                <Icon size={17} className="text-primary-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">{label}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
