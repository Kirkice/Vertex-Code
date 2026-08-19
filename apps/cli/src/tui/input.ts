export type TuiInputAction =
  | { type: "text"; value: string }
  | { type: "submit" }
  | { type: "cancel" }
  | { type: "approve"; decision: "approve" | "always_allow" | "deny" }
  | { type: "history"; direction: "previous" | "next" }
  | { type: "backspace" }
  | { type: "newline" }

/** 将 raw mode 字节序列翻译为 controller 可消费的语义动作。 */
export function parseInputChunk(chunk: string): TuiInputAction[] {
  const actions: TuiInputAction[] = []
  for (const character of chunk) {
    if (character === "\u0003") actions.push({ type: "cancel" })
    else if (character === "\r" || character === "\n") actions.push({ type: "submit" })
    else if (character === "\u007f") actions.push({ type: "backspace" })
    else if (character === "\u001b") continue
    else if (character === "y") actions.push({ type: "approve", decision: "approve" })
    else if (character === "a") actions.push({ type: "approve", decision: "always_allow" })
    else if (character === "n") actions.push({ type: "approve", decision: "deny" })
    else actions.push({ type: "text", value: character })
  }
  return actions
}
