/** The part of the pi theme that the render uses. */
export interface Painter {
  fg(color: string, text: string): string;
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function truecolor(match: RegExpExecArray, text: string): string {
  const [r, g, b] = match.slice(1).map((channel) => Number.parseInt(channel, 16));
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

/** Paints text with a theme token or a `#rrggbb` hex. Without a color the text stays as it is. */
export function paint(theme: Painter, color: string | undefined, text: string): string {
  if (!color) return text;
  const hex = HEX.exec(color);
  return hex ? truecolor(hex, text) : theme.fg(color, text);
}
