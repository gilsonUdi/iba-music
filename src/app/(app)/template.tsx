/** Remonta a cada navegação: cada página entra com uma transição suave. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
