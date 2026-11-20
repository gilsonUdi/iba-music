"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

/**
 * Modal do app: no celular sobe de baixo (bottom sheet) e fecha arrastando para baixo;
 * no desktop aparece centralizado. Fecha com Esc ou tocando fora.
 */
export default function Sheet({
  aberto,
  onFechar,
  children,
  className,
}: {
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  className?: string; // largura no desktop, ex.: "sm:max-w-lg"
}) {
  const painel = useRef<HTMLDivElement>(null);
  const inicioY = useRef<number | null>(null);
  const [arrasto, setArrasto] = useState(0);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", onKey);
    };
  }, [aberto, onFechar]);

  useEffect(() => { if (!aberto) setArrasto(0); }, [aberto]);

  if (!aberto || !montado) return null;

  // Arrastar para fechar: começa na alça ou no painel quando ele está no topo da rolagem
  function onTouchStart(e: React.TouchEvent) {
    const el = painel.current;
    const naAlca = (e.target as HTMLElement).closest("[data-alca]");
    if (naAlca || (el && el.scrollTop <= 0)) inicioY.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (inicioY.current === null) return;
    const dy = e.touches[0].clientY - inicioY.current;
    setArrasto(dy > 0 ? dy : 0);
  }
  function onTouchEnd() {
    if (inicioY.current === null) return;
    inicioY.current = null;
    if (arrasto > 110) onFechar();
    else setArrasto(0);
  }

  return createPortal(
    <div className="modal-overlay" onClick={onFechar} role="presentation">
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        className={clsx("modal-panel sm:max-w-lg", className)}
        style={arrasto ? { transform: `translateY(${arrasto}px)`, transition: "none" } : { transition: "transform .2s ease" }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="modal-alca" data-alca />
        {children}
      </div>
    </div>,
    document.body,
  );
}
