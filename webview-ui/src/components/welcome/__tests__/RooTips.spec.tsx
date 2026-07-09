import { act, render, screen } from "@/utils/test-utils"

import RooTips from "../RooTips"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === "chat:about") {
				return "Vertex AI is your dedicated agent for graphics rendering development."
			}

			if (key === "chat:aboutVariants.0") {
				return "Built for shaders, pipelines, and GPU workflows."
			}

			if (key === "chat:aboutVariants.1") {
				return "Your rendering workflow, amplified by AI."
			}

			if (key === "chat:aboutVariants.2") {
				return "From shader code to frame insight."
			}

			if (key === "chat:aboutVariants.3") {
				return "Render faster. Debug smarter."
			}

			if (key === "chat:aboutVariants.4") {
				return "Vertex AI is your dedicated agent for graphics rendering development."
			}

			return key
		},
	}),
}))

describe("RooTips", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it("renders the typewriter container and caret", () => {
		act(() => {
			render(<RooTips />)
		})

		expect(screen.getByTestId("roo-typed-copy")).toBeInTheDocument()
		expect(screen.getByTestId("roo-type-caret")).toBeInTheDocument()
	})

	it("types the about message progressively", () => {
		act(() => {
			render(<RooTips />)
		})

		act(() => {
			vi.advanceTimersByTime(42)
		})

		expect(screen.getByTestId("roo-typed-copy").textContent).toContain("B")
	})
})
