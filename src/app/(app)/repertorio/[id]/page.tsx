"use client";

import { useEffect, useState } from "react";
import { EsqueletoPagina } from "@/components/ui/Esqueleto";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getMusica, updateMusica, deleteMusica, getEquipes, getEscalas,
  enviarParaVotacao, setMusicaAtiva, setFavorita, getUser,
} from "@/lib/firestore";
import { formatarDuracao, type Musica, type Equipe } from "@/lib/types";
import { toast } from "sonner";
import { mensagemErro } from "@/lib/errors";
import {
  ArrowLeft, Youtube, FileText, Music2, ExternalLink,
  Pencil, Trash2, X, Save, Clock, Tag, Headphones, Search, Disc3,
  Star, Link2, Timer, RotateCcw, EyeOff, Eye, StickyNote, History,
} from "lucide-react";
import clsx from "clsx";
import MusicaCampos, { camposEditaveis, type MusicaForm } from "@/components/musica/MusicaCampos";
import CifraPainel from "@/components/cifra/CifraPainel";
import { getYouTubeId, getSpotifyTrackId, getDeezerTrackId, embedSpotify, embedDeezer } from "@/lib/plataformas";
import { diasSemTocar, textoUltimaVez, usoDasMusicas, type UsoMusica } from "@/lib/estatisticas";

/**
 * Retorna URL de embed do OneDrive SOMENTE se o link já for um embed real
 * (gerado via OneDrive → Compartilhar → Inserir). Links de compartilhamento
 * normais (?cid=...&id=...) bloqueiam iframe via X-Frame-Options.
 */
function getOneDriveEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("onedrive.live.com")) return null;
    if (u.searchParams.has("resid") && u.searchParams.has("authkey")) return url;
  } catch { /* inválido */ }
  return null;
}

function getGoogleDocsEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("docs.google.com")) return null;
    const base = u.pathname.replace(/\/(edit|view|preview|pub)(\/.*)?$/, "");
    return `https://docs.google.com${base}/preview`;
  } catch { /* inválido */ }
  return null;
}

/** Fonte de cifra ou VS: o link da própria música ou o arquivo geral da equipe. */
interface Fonte { id: string; nome: string; url: string; daEquipe: boolean }

type Aba = "youtube" | "ouvir" | "cifra" | "letra" | "vs" | "arquivos";

function BotaoAba({ ativo, tem, cor, onClick, children }: {
  ativo: boolean; tem: boolean; cor: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
        ativo ? `${cor} text-white shadow-sm`
          : tem ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
          : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-dashed border-gray-200"
      )}
    >
      {children}
      {!tem && <span className="text-[10px] ml-0.5 opacity-60">+</span>}
    </button>
  );
}

function Vazio({ icone, texto, sub, acao }: { icone: React.ReactNode; texto: string; sub?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">{icone}</div>
      <p className="text-gray-500 text-sm font-medium">{texto}</p>
      {sub && <p className="text-gray-400 text-xs">{sub}</p>}
      {acao}
    </div>
  );
}

export default function RepertorioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [musica, setMusica] = useState<Musica | null>(null);
  const [minhasEquipes, setMinhasEquipes] = useState<Equipe[]>([]);
  const [equipesUsuario, setEquipesUsuario] = useState<Equipe[]>([]);
  const [uso, setUso] = useState<UsoMusica | undefined>();
  const [favorita, setFavoritaState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>("youtube");
  const [cifraSel, setCifraSel] = useState(0);
  const [vsSel, setVsSel] = useState(0);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<MusicaForm>({});
  const [saving, setSaving] = useState(false);

  const isPastor = user?.roles?.includes("pastor") || user?.roles?.includes("super_admin");
  const canEdit = isPastor || user?.roles?.includes("diretor_musical") || user?.roles?.includes("lider_equipe");

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const [m, todasEquipes, escalas, eu] = await Promise.all([
          getMusica(id), getEquipes(user!.igrejaId), getEscalas(user!.igrejaId), getUser(user!.uid),
        ]);
        if (!m) { router.replace("/repertorio"); return; }
        setMusica(m);
        setForm(m);
        setUso(usoDasMusicas(escalas)[m.id]);
        setFavoritaState(eu?.favoritas?.includes(m.id) ?? false);
        const uid = user!.uid;
        const verTodas = isPastor || user!.roles?.includes("diretor_musical");
        const equipes = verTodas
          ? todasEquipes
          : todasEquipes.filter(e => e.membros.includes(uid) || e.liderId === uid);
        setMinhasEquipes(equipes.filter(e => e.cifraUrl || e.vsUrl));
        setEquipesUsuario(equipes.filter(e => e.ativo !== false));
        if (m.youtubeUrl) setAba("youtube");
        else if (m.spotifyUrl || m.deezerUrl) setAba("ouvir");
        else if (m.cifraUrl || equipes.some(e => e.cifraUrl)) setAba("cifra");
        else setAba("letra");
      } catch (e) {
        toast.error(mensagemErro(e, "Erro ao carregar a música"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router, user]);

  async function handleSave() {
    if (!musica) return;
    if (!form.titulo?.trim() || !form.artista?.trim()) { toast.error("Título e artista são obrigatórios"); return; }
    setSaving(true);
    try {
      const dados = camposEditaveis(form);
      await updateMusica(musica.id, dados);
      setMusica({ ...musica, ...dados } as Musica);
      setEditando(false);
      toast.success("Música atualizada!");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar a música"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!musica || !confirm("Excluir esta música definitivamente?")) return;
    try {
      await deleteMusica(musica.id);
      toast.success("Música excluída");
      router.replace("/repertorio");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao excluir a música"));
    }
  }

  async function handleVotacao() {
    if (!musica || !confirm("Enviar esta música para votação dos pastores? Ela sai do repertório até ser aprovada.")) return;
    try {
      await enviarParaVotacao(musica.id);
      setMusica({ ...musica, status: "pendente", votos: undefined, mediaVotos: undefined });
      toast.success("Música enviada para votação");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao enviar para votação"));
    }
  }

  async function handleAtiva(ativo: boolean) {
    if (!musica) return;
    if (!ativo && !confirm("Retirar esta música do repertório? Ela deixa de aparecer nas listas e setlists, mas pode ser recolocada.")) return;
    try {
      await setMusicaAtiva(musica.id, ativo);
      setMusica({ ...musica, ativo });
      toast.success(ativo ? "Música recolocada no repertório" : "Música retirada do repertório");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao alterar a música"));
    }
  }

  async function toggleFavorita() {
    if (!musica || !user) return;
    const novo = !favorita;
    setFavoritaState(novo);
    try {
      await setFavorita(user.uid, musica.id, novo);
    } catch (e) {
      setFavoritaState(!novo);
      toast.error(mensagemErro(e, "Erro ao salvar favorita"));
    }
  }

  if (loading) {
    return (
      <EsqueletoPagina />
    );
  }

  if (!musica) return null;

  const videoId = musica.youtubeUrl ? getYouTubeId(musica.youtubeUrl) : null;
  const spotifyId = musica.spotifyUrl ? getSpotifyTrackId(musica.spotifyUrl) : null;
  const deezerId = musica.deezerUrl ? getDeezerTrackId(musica.deezerUrl) : null;

  const fontesCifra: Fonte[] = [
    ...(musica.cifraUrl ? [{ id: "musica", nome: "Desta música", url: musica.cifraUrl, daEquipe: false }] : []),
    ...minhasEquipes.filter(e => e.cifraUrl).map(e => ({ id: e.id, nome: e.name, url: e.cifraUrl!, daEquipe: true })),
  ];
  const fontesVS: Fonte[] = [
    ...(musica.vsUrl ? [{ id: "musica", nome: "Desta música", url: musica.vsUrl, daEquipe: false }] : []),
    ...minhasEquipes.filter(e => e.vsUrl).map(e => ({ id: e.id, nome: e.name, url: e.vsUrl!, daEquipe: true })),
  ];
  const cifra = fontesCifra[Math.min(cifraSel, fontesCifra.length - 1)];
  const vs = fontesVS[Math.min(vsSel, fontesVS.length - 1)];
  const links = musica.links ?? [];
  const dias = diasSemTocar(uso);
  const retirada = musica.ativo === false;

  const btnAdicionar = (txt: string) => canEdit && (
    <button onClick={() => setEditando(true)} className="btn-secondary text-sm flex items-center gap-1.5">
      <Pencil size={13} /> {txt}
    </button>
  );

  function SeletorFonte({ fontes, sel, setSel, cor }: { fontes: Fonte[]; sel: number; setSel: (n: number) => void; cor: string }) {
    if (fontes.length < 2) return null;
    return (
      <div className="flex gap-2 flex-wrap">
        {fontes.map((f, i) => (
          <button key={f.id} onClick={() => setSel(i)}
            className={clsx("px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
              sel === i ? `${cor} text-white` : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {f.nome}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors" aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 line-clamp-2 break-words">{musica.titulo}</h1>
          <p className="text-gray-500 text-sm">{musica.artista}</p>
        </div>
        {!editando && (
          <div className="flex gap-1 shrink-0">
            <button onClick={toggleFavorita} title={favorita ? "Remover das favoritas" : "Marcar como favorita"}
              className={clsx("p-2 rounded-xl transition-colors", favorita ? "text-amber-500 hover:bg-amber-50" : "text-gray-300 hover:text-amber-400 hover:bg-amber-50")}>
              <Star size={18} fill={favorita ? "currentColor" : "none"} />
            </button>
            {canEdit && (
              <button onClick={() => setEditando(true)} title="Editar" className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-colors">
                <Pencil size={18} />
              </button>
            )}
            {isPastor && (
              <button onClick={handleDelete} title="Excluir" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Avisos de status */}
      {retirada && (
        <div className="card p-3 bg-gray-50 text-sm text-gray-600 flex items-center gap-2">
          <EyeOff size={15} /> Esta música foi retirada do repertório.
        </div>
      )}
      {musica.status === "pendente" && (
        <div className="card p-3 bg-amber-50 text-sm text-amber-700 flex items-center gap-2">
          <Clock size={15} /> Aguardando votação dos pastores.
        </div>
      )}

      {/* Ações do pastor */}
      {isPastor && !editando && (
        <div className="flex flex-wrap gap-2">
          {musica.status !== "pendente" && (
            <button onClick={handleVotacao} className="btn-secondary text-sm flex items-center gap-1.5">
              <RotateCcw size={14} /> Enviar para votação
            </button>
          )}
          {retirada ? (
            <button onClick={() => handleAtiva(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Eye size={14} /> Recolocar no repertório
            </button>
          ) : (
            <button onClick={() => handleAtiva(false)} className="btn-secondary text-sm flex items-center gap-1.5 text-red-600">
              <EyeOff size={14} /> Retirar do repertório
            </button>
          )}
        </div>
      )}

      {/* Edição */}
      {editando ? (
        <div className="card p-5 space-y-4">
          <MusicaCampos form={form} setForm={setForm} />
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => { setForm(musica); setEditando(false); }} className="btn-secondary flex items-center gap-1.5 text-sm">
              <X size={14} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 text-sm">
              <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Informações */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="badge bg-primary-100 text-primary-700 font-bold px-3 py-1">Tom: {musica.tom}</span>
            {musica.tomOriginal && musica.tomOriginal !== musica.tom && (
              <span className="badge bg-gray-100 text-gray-600 px-3 py-1">Original: {musica.tomOriginal}</span>
            )}
            {musica.bpm && (
              <span className="badge bg-gray-100 text-gray-600 px-3 py-1 flex items-center gap-1"><Clock size={12} /> {musica.bpm} BPM</span>
            )}
            {musica.duracaoSeg && (
              <span className="badge bg-gray-100 text-gray-600 px-3 py-1 flex items-center gap-1"><Timer size={12} /> {formatarDuracao(musica.duracaoSeg)}</span>
            )}
            <span className={clsx("badge px-3 py-1 flex items-center gap-1",
              dias === undefined ? "bg-gray-100 text-gray-500" : dias > 60 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700")}>
              <History size={12} /> {textoUltimaVez(dias)}{uso?.vezes ? ` · ${uso.vezes}x` : ""}
            </span>
            {musica.tags?.map(t => (
              <span key={t} className="badge bg-gray-100 text-gray-400 px-3 py-1 flex items-center gap-1"><Tag size={11} /> {t}</span>
            ))}
          </div>

          {musica.observacoes && (
            <div className="card p-4 bg-amber-50/60 border-amber-100">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <StickyNote size={12} /> Observações de arranjo
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{musica.observacoes}</p>
            </div>
          )}

          {/* Abas */}
          <div className="flex gap-2 flex-wrap">
            <BotaoAba ativo={aba === "youtube"} tem={!!videoId} cor="bg-red-500" onClick={() => setAba("youtube")}><Youtube size={14} /> YouTube</BotaoAba>
            <BotaoAba ativo={aba === "ouvir"} tem={!!spotifyId || !!deezerId} cor="bg-green-500" onClick={() => setAba("ouvir")}><Disc3 size={14} /> Ouvir</BotaoAba>
            <BotaoAba ativo={aba === "cifra"} tem={fontesCifra.length > 0 || equipesUsuario.length > 0} cor="bg-primary-500" onClick={() => setAba("cifra")}><FileText size={14} /> Cifra</BotaoAba>
            <BotaoAba ativo={aba === "letra"} tem={!!musica.letra} cor="bg-purple-500" onClick={() => setAba("letra")}><Music2 size={14} /> Letra</BotaoAba>
            <BotaoAba ativo={aba === "vs"} tem={fontesVS.length > 0} cor="bg-green-500" onClick={() => setAba("vs")}><Headphones size={14} /> VS</BotaoAba>
            <BotaoAba ativo={aba === "arquivos"} tem={links.length > 0} cor="bg-blue-500" onClick={() => setAba("arquivos")}><Link2 size={14} /> Arquivos</BotaoAba>
          </div>

          <div className="card overflow-hidden">
            {aba === "youtube" && (videoId ? (
              <div className="p-4 space-y-3">
                <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
                  <iframe src={`https://www.youtube.com/embed/${videoId}`} title={musica.titulo}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen className="absolute inset-0 w-full h-full" />
                </div>
                <a href={musica.youtubeUrl!} target="_blank" rel="noopener" className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 w-fit">
                  <ExternalLink size={11} /> Abrir no YouTube
                </a>
              </div>
            ) : <Vazio icone={<Youtube size={26} className="text-red-300" />} texto="Nenhum link do YouTube adicionado" acao={btnAdicionar("Adicionar link")} />)}

            {aba === "ouvir" && (spotifyId || deezerId ? (
              <div className="p-4 space-y-4">
                {spotifyId && (
                  <div className="space-y-1.5">
                    <iframe src={embedSpotify(spotifyId)} title={`${musica.titulo} no Spotify`} height={152}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"
                      className="w-full rounded-2xl border-0" />
                    <a href={musica.spotifyUrl!} target="_blank" rel="noopener" className="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1 w-fit">
                      <ExternalLink size={11} /> Abrir no Spotify
                    </a>
                  </div>
                )}
                {deezerId && (
                  <div className="space-y-1.5">
                    <iframe src={embedDeezer(deezerId)} title={`${musica.titulo} no Deezer`} height={150}
                      allow="encrypted-media; clipboard-write" loading="lazy" className="w-full rounded-2xl border-0" />
                    <a href={musica.deezerUrl!} target="_blank" rel="noopener" className="text-xs text-gray-400 hover:text-violet-600 flex items-center gap-1 w-fit">
                      <ExternalLink size={11} /> Abrir no Deezer
                    </a>
                  </div>
                )}
              </div>
            ) : <Vazio icone={<Disc3 size={26} className="text-green-300" />} texto="Nenhuma faixa do Spotify ou Deezer adicionada" acao={btnAdicionar("Adicionar faixa")} />)}

            {aba === "cifra" && user && (
              <CifraPainel
                musica={musica}
                equipes={equipesUsuario}
                user={user}
                linksExternos={fontesCifra.map(f => ({ nome: f.daEquipe ? `Docs da equipe ${f.nome}` : "Link da cifra", url: f.url }))}
              />
            )}

            {aba === "letra" && (musica.letra ? (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans p-6 overflow-y-auto" style={{ maxHeight: "70vh" }}>{musica.letra}</pre>
            ) : <Vazio icone={<Music2 size={26} className="text-purple-300" />} texto="Nenhuma letra adicionada" acao={btnAdicionar("Adicionar letra")} />)}

            {aba === "vs" && (vs ? (
              <div className="p-4 space-y-3">
                <SeletorFonte fontes={fontesVS} sel={vsSel} setSel={setVsSel} cor="bg-green-500" />
                {getOneDriveEmbedUrl(vs.url) ? (
                  <>
                    <iframe src={getOneDriveEmbedUrl(vs.url)!} title={`VS — ${vs.nome}`}
                      className="w-full rounded-2xl border border-gray-100" style={{ height: "70vh", minHeight: "400px" }} allow="fullscreen" />
                    <a href={vs.url} target="_blank" rel="noopener" className="text-xs text-gray-400 hover:text-green-500 flex items-center gap-1 w-fit">
                      <ExternalLink size={11} /> Abrir no OneDrive
                    </a>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-5 text-center px-4">
                    <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center">
                      <Headphones size={38} className="text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-lg">VS · Playback</p>
                      <p className="text-gray-400 text-sm mt-1">{vs.daEquipe ? `Pasta da equipe ${vs.nome}` : "VS desta música"}</p>
                    </div>
                    <a href={vs.url} target="_blank" rel="noopener" className="btn-primary flex items-center gap-2 px-6 py-3 text-base">
                      <Headphones size={18} /> Abrir VS <ExternalLink size={14} className="opacity-75" />
                    </a>
                  </div>
                )}
              </div>
            ) : <Vazio icone={<Headphones size={26} className="text-green-300" />} texto="Nenhum VS configurado"
                  sub="Adicione o link do VS nesta música ou a pasta geral na página da equipe" acao={btnAdicionar("Adicionar VS")} />)}

            {aba === "arquivos" && (links.length ? (
              <div className="p-4 space-y-2">
                {links.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener"
                    className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                    <Link2 size={16} className="text-blue-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{l.titulo}</span>
                    <ExternalLink size={13} className="text-gray-400" />
                  </a>
                ))}
              </div>
            ) : <Vazio icone={<Link2 size={26} className="text-blue-300" />} texto="Nenhum arquivo adicionado"
                  sub="Links do Drive com versões ou arranjos próprios da igreja" acao={btnAdicionar("Adicionar arquivo")} />)}
          </div>
        </>
      )}
    </div>
  );
}
