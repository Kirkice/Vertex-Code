import { describe, expect, it } from "vitest"

import { ApiStreamContentState } from "../apiStreamContentState"

describe("ApiStreamContentState", () => {
	it("accumulates text and formats reasoning headings", () => {
		const state = new ApiStreamContentState()

		expect(state.appendText("hello ")).toBe("hello ")
		expect(state.appendText("world")).toBe("hello world")
		expect(state.appendReasoning("Done.**Next**")).toBe("Done.\n\n**Next**")
		expect(state.reasoningMessage).toBe("Done.**Next**")
	})

	it("accumulates grounding sources without changing the caller array", () => {
		const state = new ApiStreamContentState()
		const sources = [{ title: "Docs", url: "https://example.com" }]

		state.addGroundingSources(sources)

		expect(state.pendingGroundingSources).toEqual(sources)
		expect(state.pendingGroundingSources).not.toBe(sources)
	})
})
