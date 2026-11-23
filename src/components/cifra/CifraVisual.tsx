"use client";

import { Fragment, useMemo } from "react";
import clsx from "clsx";
import { analisarLinha, pedacosDeAcordes, transporCifra, type TipoSecao } from "@/lib/cifra";

/** Cores das seções — as mesmas convenções dos documentos das equipes. */
export const COR_SECAO: Record<TipoSecao, string> = {
  intro:  "bg-violet-100 text-violet-700",
  verso:  "bg-orange-100 text-orange-700",
  pre:    "bg-rose-100 text-rose-700",
  refrao: "bg-red-100 text-red-700",
  ponte:  "bg-sky-100 text-sky-700",
  coro:   "bg-blue-100 text-blue-700",
  inter:  "bg-purple-100 text-purple-700",
  final:  "bg-emerald-100 text-emerald-700",
  outro:  "bg-gray-100 text-gray-700",
};

function Acordes({ trecho }: { trecho: string }) {
  return (
    <>
      {pedacosDeAcordes(trecho).map((p, i) =>
        p.acorde
          ? <span key={i} className="font-bold text-primary-700">{p.t}</span>
          : <span key={i} className="text-gray-400">{p.t}</span>,
      )}
    </>
  );
}

/**
 * Mostra a cifra no formato de mapa: seções coloridas, acordes destacados
 * e começo da letra em itálico. `semitons` transpõe só na exibição.
 */
export default function CifraVisual({
  texto, semitons = 0, tom, tamanho = 16, className,
}: {
  texto: string;
  semitons?: number;
  tom?: string;
  tamanho?: number; // px
  className?: string;
}) {
  const linhas = useMemo(
    () => transporCifra(texto, semitons, tom).split("\n").map(analisarLinha),
    [texto, semitons, tom],
  );

  return (
    <div className={clsx("font-mono leading-relaxed", className)} style={{ fontSize: tamanho }}>
      {linhas.map((l, i) => {
        if (l.tipo === "vazia") return <div key={i} className="h-[0.75em]" />;
        if (l.tipo === "secao") {
          return (
            <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-[0.5em] first:mt-0 break-inside-avoid-column">
              <span className={clsx("rounded-md px-1.5 py-0.5 font-sans font-bold text-[0.8em] tracking-wide", COR_SECAO[l.secao ?? "outro"])}>
                {l.rotulo}
              </span>
              {l.resto && (l.restoEhAcorde
                ? <span className="whitespace-pre-wrap"><Acordes trecho={l.resto} /></span>
                : <span className="font-sans italic text-gray-600 whitespace-pre-wrap">{l.resto}</span>)}
            </div>
          );
        }
        if (l.tipo === "acordes") {
          return <div key={i} className="whitespace-pre-wrap pl-1"><Acordes trecho={l.texto} /></div>;
        }
        return <Fragment key={i}><div className="font-sans text-gray-500 whitespace-pre-wrap text-[0.9em]">{l.texto}</div></Fragment>;
      })}
    </div>
  );
}
