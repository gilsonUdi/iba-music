"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Youtube, Music, Loader2 } from "lucide-react";
import clsx from "clsx";
import { auth } from "@/lib/firebase";
import { PLATAFORMAS, type Plataforma } from "@/lib/plataformas";

interface Resultado {
  id: string;
  title: string;
  subtitle: string;
  thumb: string;
  url: string;
}

interface Props {
  plataforma: Plataforma;
  value: string;
  onChange: (url: string) => void;
  searchQuery?: string; // pré-popula a busca com título + artista
}

/** Busca uma música no YouTube, Spotify ou Deezer e devolve o link escolhido. */
export default function PlataformaSearch({ plataforma, value, onChange, searchQuery }: Props) {
  const cfg = PLATAFORMAS[plataforma];
  const Icone = plataforma === "youtube" ? Youtube : Music;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Pré-popula query ao abrir
  function handleOpen() {
    if (searchQuery && !query) setQuery(searchQuery);
    setOpen(true);
  }

  async function buscar(q: string) {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${cfg.rota}?q=${encodeURIComponent(q)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setResults([]); }
      else setResults(data.items ?? []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  function handleQuery(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(v), 600);
  }

  function select(result: Resultado) {
    onChange(result.url);
    setOpen(false);
    setResults([]);
    setQuery("");
  }

  function clear() {
    onChange("");
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          {value ? (
            <div className="input flex items-center gap-2 pr-8">
              <Icone size={14} className="text-gray-500 shrink-0" />
              <a href={value} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline truncate flex-1">
                {value}
              </a>
              <button type="button" onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          ) : (
            <input
              readOnly
              placeholder={cfg.vazio}
              className="input text-gray-400 cursor-pointer"
              onClick={handleOpen}
            />
          )}
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className={`flex items-center gap-2 px-4 py-2.5 ${cfg.cor} text-white rounded-2xl text-sm font-medium transition-colors shrink-0`}
          aria-label={`Buscar no ${cfg.nome}`}
        >
          <Icone size={15} /> Buscar
        </button>
      </div>

      {/* Painel de busca */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Campo de busca */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={e => handleQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && buscar(query)}
                placeholder="Ex: Oceans Hillsong, Quão Grande é o meu Deus..."
                className="input pl-9 pr-9 text-sm"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(""); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Resultados */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <Loader2 size={18} className="animate-spin" /> Buscando...
              </div>
            )}
            {!loading && error && (
              <div className="py-6 text-center text-red-500 text-sm px-4">{error}</div>
            )}
            {!loading && !error && results.length === 0 && query && (
              <div className="py-6 text-center text-gray-400 text-sm">Nenhum resultado encontrado</div>
            )}
            {!loading && !error && results.length === 0 && !query && (
              <div className="py-6 text-center text-gray-400 text-sm">
                Digite o nome da música para buscar
              </div>
            )}
            {results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => select(r)}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary-50 transition-colors text-left border-b border-gray-50 last:border-0"
                )}
              >
                <img src={r.thumb} alt="" className={`${plataforma === "youtube" ? "w-16" : "w-12"} h-12 rounded-lg object-cover shrink-0 bg-gray-100`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{r.subtitle}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-gray-100">
            <button type="button" onClick={() => setOpen(false)} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
