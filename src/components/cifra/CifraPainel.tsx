"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Minus, Plus, Pencil, Maximize2, FileText, ExternalLink, Trash2, AArrowDown, AArrowUp, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { getCifrasDaMusica, salvarCifra, excluirCifra } from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import { transporTom } from "@/lib/cifra";
import type { AppUser, Cifra, Equipe, Musica } from "@/lib/types";
import CifraVisual from "./CifraVisual";
import CifraEditor from "./CifraEditor";
import { Esqueleto } from "@/components/ui/Esqueleto";

const TAMANHO_KEY = "cifra-tamanho";

/** Cifra da música por equipe: ver, trocar o tom na hora, editar e abrir na estante. */
export default function CifraPainel({
  musica, equipes, user, linksExternos,
}: {
  musica: Musica;
  equipes: Equipe[];          // equipes que o usuário pode ver
  user: AppUser;
  linksExternos: { nome: string; url: string }[];
}) {
  const isDiretor = user.roles.some(r => ["super_admin", "pastor", "diretor_musical"].includes(r));
  const [cifras, setCifras] = useState<Record<string, Cifra>>({});
  const [carregando, setCarregando] = useState(true);
  const [equipeId, setEquipeId] = useState(equipes[0]?.id ?? "");
  const [semitons, setSemitons] = useState(0);
  const [tamanho, setTamanho] = useState(16);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    try { const t = Number(localStorage.getItem(TAMANHO_KEY)); if (t >= 12 && t <= 32) setTamanho(t); } catch { /* sem storage */ }
  }, []);
  function mudarTamanho(d: number) {
    setTamanho(t => {
      const n = Math.min(32, Math.max(12, t + d));
      try { localStorage.setItem(TAMANHO_KEY, String(n)); } catch { /* sem storage */ }
      return n;
    });
  }

  useEffect(() => {
    getCifrasDaMusica(musica.id, user.igrejaId)
      .then(lista => {
        const mapa = Object.fromEntries(lista.map(c => [c.equipeId, c]));
        setCifras(mapa);
        // começa pela primeira equipe que já tem cifra
        const comCifra = equipes.find(e => mapa[e.id]);
        if (comCifra) setEquipeId(comCifra.id);
      })
      .catch(e => toast.error(mensagemErro(e, "Erro ao carregar a cifra")))
      .finally(() => setCarregando(false));
  }, [musica.id, user.igrejaId, equipes]);

  useEffect(() => { setSemitons(0); setEditando(false); }, [equipeId]);

  const equipe = equipes.find(e => e.id === equipeId);
  const cifra = cifras[equipeId];
  const podeEditar = !!equipe && (isDiretor || equipe.liderId === user.uid);
  const tomAtual = useMemo(() => (cifra?.tom ? transporTom(cifra.tom, semitons) : undefined), [cifra?.tom, semitons]);

  async function salvar(texto: string, tom?: string) {
    if (!equipe) return;
    setSalvando(true);
    try {
      const nova = {
        musicaId: musica.id, equipeId: equipe.id, equipeName: equipe.name,
        igrejaId: equipe.igrejaId ?? user.igrejaId, texto, tom, origem: cifra?.origem,
      };
      await salvarCifra(nova, { uid: user.uid, name: user.name });
      setCifras(c => ({ ...c, [equipe.id]: { ...nova, id: `${musica.id}__${equipe.id}`, updatedAt: new Date(), updatedBy: user.uid, updatedByName: user.name } as Cifra }));
      setEditando(false);
      setSemitons(0);
      toast.success("Cifra salva!");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar a cifra"));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!equipe || !confirm(`Excluir a cifra de "${musica.titulo}" da equipe ${equipe.name}?`)) return;
    try {
      await excluirCifra(musica.id, equipe.id);
      setCifras(c => { const n = { ...c }; delete n[equipe.id]; return n; });
      toast.success("Cifra excluída");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao excluir"));
    }
  }

  if (carregando) return <div className="p-4 space-y-2"><Esqueleto className="h-8 w-48" /><Esqueleto className="h-64 w-full" /></div>;

  return (
    <div className="p-4 space-y-4">
      {/* Equipes */}
      {equipes.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {equipes.map(e => (
            <button key={e.id} onClick={() => setEquipeId(e.id)}
              className={clsx("px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5",
                equipeId === e.id ? "bg-primary-500 text-white" : "bg-white/5 text-gray-600 hover:bg-white/10")}>
              {cifras[e.id] && <span className={clsx("w-1.5 h-1.5 rounded-full", equipeId === e.id ? "bg-white" : "bg-primary-400")} />}
              {e.name}
            </button>
          ))}
        </div>
      )}

      {equipes.length === 0 ? (
        <p className="text-sm text-gray-500">Você ainda não faz parte de nenhuma equipe. As cifras são organizadas por equipe.</p>
      ) : editando ? (
        <CifraEditor textoInicial={cifra?.texto ?? ""} tomInicial={cifra?.tom ?? musica.tom} salvando={salvando}
          onSalvar={salvar} onCancelar={() => setEditando(false)} />
      ) : cifra ? (
        <>
          {/* Barra de controles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
              <button onClick={() => setSemitons(s => s - 1)} className="p-1.5 rounded-lg hover:bg-white/10" title="Descer meio tom" aria-label="Descer meio tom"><Minus size={14} /></button>
              <span className="min-w-[3.5rem] text-center text-sm font-bold text-gray-900">{tomAtual ?? (semitons ? `${semitons > 0 ? "+" : ""}${semitons}` : "Tom")}</span>
              <button onClick={() => setSemitons(s => s + 1)} className="p-1.5 rounded-lg hover:bg-white/10" title="Subir meio tom" aria-label="Subir meio tom"><Plus size={14} /></button>
              {semitons !== 0 && (
                <button onClick={() => setSemitons(0)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400" title="Voltar ao tom original"><RotateCcw size={13} /></button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
              <button onClick={() => mudarTamanho(-2)} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Diminuir letra"><AArrowDown size={15} /></button>
              <button onClick={() => mudarTamanho(2)} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Aumentar letra"><AArrowUp size={15} /></button>
            </div>
            <div className="flex gap-2 ml-auto">
              <Link href={`/estante?musica=${musica.id}&equipe=${equipeId}${semitons ? `&tom=${semitons}` : ""}`} className="btn-secondary text-sm py-2">
                <Maximize2 size={14} /> Estante
              </Link>
              {podeEditar && (
                <>
                  <button onClick={() => setEditando(true)} className="btn-secondary text-sm py-2"><Pencil size={14} /> Editar</button>
                  <button onClick={excluir} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50" title="Excluir cifra"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          </div>

          {semitons !== 0 && (
            <p className="text-xs text-amber-600">Tom alterado só na sua tela. Para salvar no tom novo, use Editar.</p>
          )}

          <div className="rounded-2xl bg-black/10 border border-white/5 p-4 sm:p-5 overflow-x-auto">
            <CifraVisual texto={cifra.texto} tom={cifra.tom} semitons={semitons} tamanho={tamanho} />
          </div>
          <p className="text-[11px] text-gray-400">
            {cifra.updatedByName && `Atualizada por ${cifra.updatedByName}`}{cifra.origem && ` · ${cifra.origem}`}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center"><FileText size={26} className="text-primary-500" /></div>
          <p className="text-gray-700 text-sm font-medium">{equipe ? `A equipe ${equipe.name} ainda não tem cifra desta música` : "Sem cifra"}</p>
          {podeEditar && (
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={() => setEditando(true)} className="btn-primary text-sm"><Plus size={14} /> Escrever cifra</button>
              <Link href="/repertorio/importar-cifras" className="btn-secondary text-sm">Importar do Google Docs</Link>
            </div>
          )}
        </div>
      )}

      {/* Links antigos (Cifra Club, Google Docs da equipe) */}
      {linksExternos.length > 0 && !editando && (
        <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2">
          {linksExternos.map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 bg-white/5 rounded-lg px-2.5 py-1.5">
              <ExternalLink size={11} /> {l.nome}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
