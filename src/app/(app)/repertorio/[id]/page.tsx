"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getMusica, updateMusica, deleteMusica, getEquipes } from "@/lib/firestore";
import type { Musica, TomMusical, Equipe } from "@/lib/types";
import { toast } from "sonner";
import {
  ArrowLeft, Youtube, FileText, Music2, ExternalLink,
  Pencil, Trash2, X, Save, Clock, Tag, Headphones,
} from "lucide-react";
import clsx from "clsx";

const TONS: TomMusical[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1];
      return u.searchParams.get("v");
    }
  } catch { /* invalid */ }
  return null;
}

/**
 * Retorna URL de embed do OneDrive SOMENTE se o link já for um embed real
 * (gerado via OneDrive → Compartilhar → Inserir). Links de compartilhamento
 * normais (?cid=...&id=...) bloqueiam iframe via X-Frame-Options.
 */
function getOneDriveEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("onedrive.live.com")) return null;
    // Somente links com resid+authkey são embeds reais do OneDrive
    if (u.searchParams.has("resid") && u.searchParams.has("authkey")) return url;
  } catch { /* invalid */ }
  return null;
}

function getGoogleDocsEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("docs.google.com")) return null;
    const base = u.pathname.replace(/\/(edit|view|preview|pub)(\/.*)?$/, "");
    return `https://docs.google.com${base}/preview`;
  } catch { /* invalid */ }
  return null;
}

type Aba = "youtube" | "cifra" | "letra" | "vs";

export default function RepertorioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [musica, setMusica] = useState<Musica | null>(null);
  const [minhasEquipes, setMinhasEquipes] = useState<Equipe[]>([]);
  const [equipeAtiva, setEquipeAtiva] = useState<Equipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>("youtube");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Partial<Musica>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = user?.roles?.includes("pastor") || user?.roles?.includes("lider_equipe");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [m, todasEquipes] = await Promise.all([getMusica(id), getEquipes()]);
      if (!m) { router.replace("/repertorio"); return; }
      setMusica(m);
      setForm(m);
      // filtra equipes que o usuário pertence (ou todas para pastor/líder)
      const uid = user?.uid ?? "";
      const isPastor = user?.roles?.includes("pastor");
      const equipesFiltradas = isPastor
        ? todasEquipes
        : todasEquipes.filter(e => e.membros.includes(uid) || e.liderId === uid);
      // inclui equipes com cifra OU VS
      const comConteudo = equipesFiltradas.filter(e => e.cifraUrl || e.vsUrl);
      setMinhasEquipes(comConteudo);
      setEquipeAtiva(comConteudo[0] ?? null);
      // define aba padrão
      if (m.youtubeUrl) setAba("youtube");
      else if (comConteudo.some(e => e.cifraUrl)) setAba("cifra");
      else if (comConteudo.some(e => e.vsUrl)) setAba("vs");
      else setAba("letra");
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function handleSave() {
    if (!musica) return;
    setSaving(true);
    try {
      await updateMusica(musica.id, form);
      setMusica({ ...musica, ...form });
      setEditando(false);
      toast.success("Música atualizada!");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!musica || !confirm("Remover esta música do repertório?")) return;
    await deleteMusica(musica.id);
    toast.success("Música removida");
    router.replace("/repertorio");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!musica) return null;

  const videoId = musica.youtubeUrl ? getYouTubeId(musica.youtubeUrl) : null;
  const temYoutube = !!videoId;
  const temCifra = minhasEquipes.some(e => e.cifraUrl);
  const temVS = minhasEquipes.some(e => e.vsUrl);
  const temLetra = !!musica.letra;
  const cifraEmbedUrl = equipeAtiva?.cifraUrl ? getGoogleDocsEmbedUrl(equipeAtiva.cifraUrl) : null;
  // equipe ativa para VS: preferência pela ativa se tiver vsUrl, senão primeira com vsUrl
  const equipeVS = (equipeAtiva?.vsUrl ? equipeAtiva : null) ?? minhasEquipes.find(e => e.vsUrl) ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          {editando ? (
            <input
              value={form.titulo ?? ""}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              className="input text-xl font-bold"
              placeholder="Título"
            />
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 truncate">{musica.titulo}</h1>
              <p className="text-gray-500 text-sm">{musica.artista}</p>
            </>
          )}
        </div>
        {canEdit && !editando && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setEditando(true)}
              className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-colors"
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
        {editando && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditando(false)} className="btn-secondary flex items-center gap-1.5 text-sm">
              <X size={14} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 text-sm">
              <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}
      </div>

      {/* Infos / Edit */}
      {editando ? (
        <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Artista/Ministério</label>
            <input value={form.artista ?? ""} onChange={e => setForm(f => ({ ...f, artista: e.target.value }))} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tom</label>
              <select value={form.tom ?? "G"} onChange={e => setForm(f => ({ ...f, tom: e.target.value as TomMusical }))} className="input">
                {TONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">BPM</label>
              <input type="number" value={form.bpm ?? ""} onChange={e => setForm(f => ({ ...f, bpm: e.target.value ? Number(e.target.value) : undefined }))} className="input" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Link do YouTube</label>
            <input value={form.youtubeUrl ?? ""} onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))} className="input" placeholder="https://youtube.com/..." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Tags (separadas por vírgula)</label>
            <input
              value={form.tags?.join(", ") ?? ""}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Letra</label>
            <textarea value={form.letra ?? ""} onChange={e => setForm(f => ({ ...f, letra: e.target.value }))} className="input resize-none" rows={6} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="badge bg-primary-100 text-primary-700 font-bold px-3 py-1">Tom: {musica.tom}</span>
          {musica.bpm && (
            <span className="badge bg-gray-100 text-gray-600 px-3 py-1 flex items-center gap-1">
              <Clock size={12} /> {musica.bpm} BPM
            </span>
          )}
          {musica.tags?.map(t => (
            <span key={t} className="badge bg-gray-100 text-gray-400 px-3 py-1 flex items-center gap-1">
              <Tag size={11} /> {t}
            </span>
          ))}
        </div>
      )}

      {/* Abas — sempre visíveis */}
      {!editando && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setAba("youtube")}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              aba === "youtube"
                ? "bg-red-500 text-white shadow-sm"
                : temYoutube
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-dashed border-gray-200"
            )}
          >
            <Youtube size={14} /> YouTube
            {!temYoutube && <span className="text-[10px] ml-0.5 opacity-60">+</span>}
          </button>

          <button
            onClick={() => setAba("cifra")}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              aba === "cifra"
                ? "bg-primary-500 text-white shadow-sm"
                : temCifra
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-dashed border-gray-200"
            )}
          >
            <FileText size={14} /> Cifra
            {!temCifra && <span className="text-[10px] ml-0.5 opacity-60">+</span>}
          </button>

          <button
            onClick={() => setAba("letra")}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              aba === "letra"
                ? "bg-purple-500 text-white shadow-sm"
                : temLetra
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-dashed border-gray-200"
            )}
          >
            <Music2 size={14} /> Letra
            {!temLetra && <span className="text-[10px] ml-0.5 opacity-60">+</span>}
          </button>

          <button
            onClick={() => setAba("vs")}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              aba === "vs"
                ? "bg-green-500 text-white shadow-sm"
                : temVS
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-dashed border-gray-200"
            )}
          >
            <Headphones size={14} /> VS
            {!temVS && <span className="text-[10px] ml-0.5 opacity-60">+</span>}
          </button>
        </div>
      )}

      {/* Conteúdo */}
      {!editando && (
        <div className="card overflow-hidden">
          {/* YouTube */}
          {aba === "youtube" && (
            temYoutube ? (
              <div className="p-4 space-y-3">
                <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={musica.titulo}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <a href={musica.youtubeUrl!} target="_blank" rel="noopener"
                  className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 w-fit">
                  <ExternalLink size={11} /> Abrir no YouTube
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                  <Youtube size={26} className="text-red-300" />
                </div>
                <p className="text-gray-500 text-sm">Nenhum link do YouTube adicionado</p>
                {canEdit && (
                  <button onClick={() => setEditando(true)} className="btn-secondary text-sm flex items-center gap-1.5">
                    <Pencil size={13} /> Adicionar link
                  </button>
                )}
              </div>
            )
          )}

          {/* Cifra */}
          {aba === "cifra" && (
            temCifra && equipeAtiva ? (
              <div className="p-4 space-y-3">
                {/* Seletor de equipe (se tiver mais de uma) */}
                {minhasEquipes.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {minhasEquipes.map(eq => (
                      <button
                        key={eq.id}
                        onClick={() => setEquipeAtiva(eq)}
                        className={clsx(
                          "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                          equipeAtiva.id === eq.id
                            ? "bg-primary-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        {eq.name}
                      </button>
                    ))}
                  </div>
                )}
                {/* Iframe ou link externo */}
                {cifraEmbedUrl ? (
                  <>
                    <iframe
                      src={cifraEmbedUrl}
                      title={`Cifras — ${equipeAtiva.name}`}
                      className="w-full rounded-2xl border border-gray-100"
                      style={{ height: "70vh", minHeight: "400px" }}
                    />
                    <a href={equipeAtiva.cifraUrl!} target="_blank" rel="noopener"
                      className="text-xs text-gray-400 hover:text-primary-500 flex items-center gap-1 w-fit">
                      <ExternalLink size={11} /> Abrir no Google Docs
                    </a>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <FileText size={40} className="text-gray-300" />
                    <p className="text-gray-500 text-sm">Este link não pode ser embutido. Abra diretamente:</p>
                    <a href={equipeAtiva.cifraUrl!} target="_blank" rel="noopener" className="btn-primary flex items-center gap-2">
                      <ExternalLink size={14} /> Abrir Cifras
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
                  <FileText size={26} className="text-primary-300" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Nenhuma cifra configurada</p>
                <p className="text-gray-400 text-xs">Adicione o link das cifras na página da equipe</p>
                <a href="/equipes" className="btn-secondary text-sm flex items-center gap-1.5">
                  <FileText size={13} /> Ir para Equipes
                </a>
              </div>
            )
          )}

          {/* Letra */}
          {aba === "letra" && (
            temLetra ? (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans p-6 overflow-y-auto" style={{ maxHeight: "70vh" }}>
                {musica.letra}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
                <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center">
                  <Music2 size={26} className="text-purple-300" />
                </div>
                <p className="text-gray-500 text-sm">Nenhuma letra adicionada</p>
                {canEdit && (
                  <button onClick={() => setEditando(true)} className="btn-secondary text-sm flex items-center gap-1.5">
                    <Pencil size={13} /> Adicionar letra
                  </button>
                )}
              </div>
            )
          )}

          {/* VS / Playbacks */}
          {aba === "vs" && (
            temVS && equipeVS ? (
              <div className="p-4 space-y-3">
                {/* Seletor de equipe se tiver mais de uma com VS */}
                {minhasEquipes.filter(e => e.vsUrl).length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {minhasEquipes.filter(e => e.vsUrl).map(eq => (
                      <button
                        key={eq.id}
                        onClick={() => setEquipeAtiva(eq)}
                        className={clsx(
                          "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                          equipeAtiva?.id === eq.id
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        {eq.name}
                      </button>
                    ))}
                  </div>
                )}
                {/* Embed ou painel de acesso */}
                {(() => {
                  const embedUrl = getOneDriveEmbedUrl(equipeVS.vsUrl!);
                  if (embedUrl) {
                    return (
                      <>
                        <iframe
                          src={embedUrl}
                          title={`VS · Playbacks — ${equipeVS.name}`}
                          className="w-full rounded-2xl border border-gray-100"
                          style={{ height: "70vh", minHeight: "400px" }}
                          allow="fullscreen"
                        />
                        <a href={equipeVS.vsUrl!} target="_blank" rel="noopener"
                          className="text-xs text-gray-400 hover:text-green-500 flex items-center gap-1 w-fit">
                          <ExternalLink size={11} /> Abrir no OneDrive
                        </a>
                      </>
                    );
                  }
                  return (
                    <div className="flex flex-col items-center justify-center py-10 gap-6 text-center px-4">
                      <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center">
                        <Headphones size={38} className="text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">VS · Playbacks</p>
                        <p className="text-gray-400 text-sm mt-1">{equipeVS.name}</p>
                        <p className="text-gray-400 text-xs mt-3 max-w-xs">
                          Os arquivos de stems e playbacks estão hospedados no OneDrive.
                          Clique para abrir a pasta diretamente.
                        </p>
                      </div>
                      <a
                        href={equipeVS.vsUrl!}
                        target="_blank"
                        rel="noopener"
                        className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
                      >
                        <Headphones size={18} /> Abrir pasta de VS
                        <ExternalLink size={14} className="opacity-75" />
                      </a>
                      <p className="text-xs text-gray-300">
                        O OneDrive não permite visualização incorporada em aplicativos externos.
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center">
                  <Headphones size={26} className="text-green-300" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Nenhum VS configurado</p>
                <p className="text-gray-400 text-xs">Adicione o link do OneDrive na página da equipe</p>
                <a href="/equipes" className="btn-secondary text-sm flex items-center gap-1.5">
                  <Headphones size={13} /> Ir para Equipes
                </a>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
