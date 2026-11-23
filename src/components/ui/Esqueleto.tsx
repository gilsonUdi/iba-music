import clsx from "clsx";

/** Bloco de esqueleto com brilho animado. */
export function Esqueleto({ className }: { className?: string }) {
  return <div className={clsx("esqueleto", className)} />;
}

/** Lista de cards carregando (substitui o "Carregando..."). */
export function EsqueletoLista({ itens = 4, grade = false }: { itens?: number; grade?: boolean }) {
  return (
    <div className={clsx("gap-3", grade ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col")} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: itens }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-3" style={{ animationDelay: `${i * 60}ms` }}>
          <Esqueleto className="w-11 h-11 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Esqueleto className="h-3.5 w-2/3" />
            <Esqueleto className="h-3 w-1/3" />
          </div>
          <Esqueleto className="h-6 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Página inteira carregando (cabeçalho + conteúdo). */
export function EsqueletoPagina() {
  return (
    <div className="max-w-4xl mx-auto space-y-5" aria-busy="true" aria-label="Carregando">
      <div className="flex items-center gap-3">
        <Esqueleto className="w-12 h-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Esqueleto className="h-6 w-1/2" />
          <Esqueleto className="h-3.5 w-1/4" />
        </div>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map(i => <Esqueleto key={i} className="h-9 w-24 rounded-xl" />)}
      </div>
      <Esqueleto className="h-72 w-full rounded-2xl" />
    </div>
  );
}
