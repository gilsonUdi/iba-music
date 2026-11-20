/**
 * Garante que uma cor (ex.: cor da equipe) fique legível sobre o fundo escuro:
 * cores muito escuras são misturadas com branco até atingir um brilho mínimo.
 */
export function corVisivel(hex: string | undefined, padrao = "#a78bfa"): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return padrao;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.45) return hex;
  const t = Math.min(0.75, (0.45 - lum) / (1 - lum) + 0.15); // quanto misturar com branco
  const mix = (c: number) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}
