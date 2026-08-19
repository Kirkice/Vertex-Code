/**
 * Vertex Code JellyFish 终端主题。
 *
 * 颜色令牌与 Webview 的 JellyFish 主题保持同源，但 TUI 只依赖 ANSI，
 * 不把 React、Tailwind 或 VS Code CSS 变量带入 CLI。
 */
export const jellyFish = {
  background: "#000000",
  foreground: "#EEEAF4",
  muted: "#7E7888",
  border: "#B366FF",
  primary: "#E84393",
  cyan: "#7DD3E8",
  success: "#00FF9C",
  warning: "#FFD060",
  error: "#FF3B6B",
  info: "#00E5FF",
  purple: "#BF7FFF",
  orange: "#FF8A3D",
} as const

export type ColorName = keyof typeof jellyFish

const ansi: Record<ColorName, number> = {
  background: 48,
  foreground: 97,
  muted: 90,
  border: 35,
  primary: 95,
  cyan: 96,
  success: 92,
  warning: 93,
  error: 91,
  info: 96,
  purple: 95,
  orange: 91,
}

/** TUI 的最小着色器；NO_COLOR 或非 TTY 时返回纯文本。 */
export function createPainter(enabled: boolean): Record<ColorName, (text: string) => string> {
  return Object.fromEntries(Object.keys(jellyFish).map((name) => [
    name,
    (text: string) => enabled ? `\u001b[${ansi[name as ColorName]}m${text}\u001b[0m` : text,
  ])) as Record<ColorName, (text: string) => string>
}
