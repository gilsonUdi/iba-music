"use client";

import { useEffect, useState } from "react";
import { EsqueletoPagina } from "@/components/ui/Esqueleto";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getEscala, getMusicas } from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import { formatarDuracao, INSTRUMENTO_LABELS, type Escala } from "@/lib/types";
import { resolverSetlist, tituloEscala, type ItemResolvido } from "@/lib/exportar";
import { nomeCor } from "@/components/escalas/PaletaPicker";

/** Versão para impressão da escala (o navegador salva em PDF pelo "Imprimir"). */
export default function ImprimirEscalaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [escala, setEscala] = useState<Escala | null>(null);
  const [itens, setItens] = useState<ItemResolvido[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getEscala(id), getMusicas()])
      .then(([e, musicas]) => {
        if (!e) { toast.error("Escala não encontrada"); router.replace("/escalas"); return; }
        setEscala(e);
        setItens(resolverSetlist(e, musicas));
      })
      .catch(e => toast.error(mensagemErro(e, "Erro ao carregar a escala")));
  }, [id, user, router]);

  if (!escala) {
    return (
      <EsqueletoPagina />
    );
  }

  const duracaoTotal = itens.reduce((s, i) => s + (i.musica?.duracaoSeg ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Barra (não sai na impressão) */}
      <div className="flex items-center gap-2 mb-4 print:hidden">
        <button onClick={() => router.back()} className="btn-secondary flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} /> Voltar
        </button>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-1.5 text-sm">
          <Printer size={14} /> Imprimir / Salvar PDF
        </button>
        <p className="text-xs text-gray-400 hidden sm:block">Para PDF, escolha “Salvar como PDF” como impressora.</p>
      </div>

      <article className="tema-claro bg-white rounded-2xl p-6 sm:p-8 print:p-0 print:rounded-none text-gray-900 space-y-6">
        <header className="border-b border-gray-200 pb-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">IBA Music · Escala</p>
          <h1 className="text-2xl font-bold mt-1 capitalize">{tituloEscala(escala)}</h1>
          {escala.equipeName && <p className="text-sm text-gray-600 mt-1">Equipe: <strong>{escala.equipeName}</strong></p>}
        </header>

        {/* Setlist */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Setlist</h2>
          {itens.length === 0 ? (
            <p className="text-sm text-gray-500">Setlist não definido.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-300">
                  <th className="py-1.5 pr-2 w-8">#</th>
                  <th className="py-1.5 pr-2">Música</th>
                  <th className="py-1.5 pr-2 w-14">Tom</th>
                  <th className="py-1.5 pr-2 w-14">BPM</th>
                  <th className="py-1.5 w-16">Duração</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i, n) => (
                  <tr key={i.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-2 font-semibold text-gray-500">{n + 1}</td>
                    <td className="py-2 pr-2">
                      <p className="font-semibold">{i.titulo}</p>
                      {i.artista && <p className="text-xs text-gray-500">{i.artista}</p>}
                      {i.musica?.observacoes && <p className="text-xs text-gray-600 mt-0.5 italic">{i.musica.observacoes}</p>}
                    </td>
                    <td className="py-2 pr-2 font-bold">{i.tomFinal ?? "—"}</td>
                    <td className="py-2 pr-2">{i.musica?.bpm ?? "—"}</td>
                    <td className="py-2">{formatarDuracao(i.musica?.duracaoSeg) || "—"}</td>
                  </tr>
                ))}
              </tbody>
              {duracaoTotal > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-2 text-right text-xs text-gray-500">Tempo total estimado</td>
                    <td className="pt-2 font-semibold">{formatarDuracao(duracaoTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </section>

        {escala.observacoes && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">Instruções gerais</h2>
            <p className="text-sm whitespace-pre-wrap">{escala.observacoes}</p>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Escalados</h2>
            <ul className="text-sm space-y-1">
              {escala.membros.map(m => (
                <li key={m.uid} className="flex justify-between gap-2 border-b border-gray-100 pb-1">
                  <span>{m.name}</span>
                  <span className="text-gray-500">{INSTRUMENTO_LABELS[m.instrumento] ?? m.instrumento}</span>
                </li>
              ))}
            </ul>
          </div>
          {(escala.paletaCores ?? []).length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Roupas</h2>
              <ul className="text-sm space-y-1.5">
                {escala.paletaCores!.map(hex => (
                  <li key={hex} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-gray-300 print:[print-color-adjust:exact]" style={{ backgroundColor: hex }} />
                    {nomeCor(hex)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </article>
    </div>
  );
}
