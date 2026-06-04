import type { ClineMessage } from "@roo-code/types"

function safeJsonParse<T>(str: string, fallback: T): T {
	try { return JSON.parse(str) } catch { return fallback }
}

export const COMMAND_OUTPUT_STRING = "Output:"

/**
 * Consolidates sequences of command + command_output messages and use_mcp_server + mcp_server_response.
 */
export function combineCommandSequences(messages: ClineMessage[]): ClineMessage[] {
	const consolidatedMessages = new Map<number, ClineMessage>()
	const processedIndices = new Set<number>()

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		if (!msg) continue

		if (msg.type === "ask" && msg.ask === "use_mcp_server") {
			const responses: string[] = []
			let j = i + 1
			while (j < messages.length) {
				const nextMsg = messages[j]
				if (!nextMsg) { j++; continue }
				if (nextMsg.say === "mcp_server_response") {
					responses.push(nextMsg.text || "")
					processedIndices.add(j); j++
				} else if (nextMsg.type === "ask" && nextMsg.ask === "use_mcp_server") {
					break
				} else { j++ }
			}
			if (responses.length > 0) {
				const jsonObj = safeJsonParse<any>(msg.text || "{}", {})
				jsonObj.response = responses.join("\n")
				consolidatedMessages.set(msg.ts, { ...msg, text: JSON.stringify(jsonObj) })
			} else {
				consolidatedMessages.set(msg.ts, { ...msg })
			}
		} else if (msg.type === "ask" && msg.ask === "command") {
			let consolidatedText = msg.text || ""
			let j = i + 1
			let previous: { type: "ask" | "say"; text: string } | undefined
			let lastProcessedIndex = i
			while (j < messages.length) {
				const currentMsg = messages[j]
				if (!currentMsg) { j++; continue }
				const { type, ask, say, text = "" } = currentMsg
				if (type === "ask" && ask === "command") break
				if (ask === "command_output" || say === "command_output") {
					if (!previous) consolidatedText += `\n${COMMAND_OUTPUT_STRING}`
					const isDuplicate = previous && previous.type !== type && previous.text === text
					if (text.length > 0 && !isDuplicate) {
						if (previous && consolidatedText.length > consolidatedText.indexOf(COMMAND_OUTPUT_STRING) + COMMAND_OUTPUT_STRING.length) {
							consolidatedText += "\n"
						}
						consolidatedText += text
					}
					previous = { type, text }
					processedIndices.add(j)
					lastProcessedIndex = j
				}
				j++
			}
			consolidatedMessages.set(msg.ts, { ...msg, text: consolidatedText })
			if (lastProcessedIndex > i) i = lastProcessedIndex
		}
	}

	const result: ClineMessage[] = []
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		if (!msg) continue
		if (processedIndices.has(i)) continue
		if (msg.ask === "command_output" || msg.say === "command_output" || msg.say === "mcp_server_response") continue
		const consolidatedMsg = consolidatedMessages.get(msg.ts)
		result.push(consolidatedMsg ?? msg)
	}
	return result
}