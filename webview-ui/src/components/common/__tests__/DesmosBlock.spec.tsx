import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import DesmosBlock from "../DesmosBlock"

const mockCalculator = vi.hoisted(() => ({
	setExpression: vi.fn(),
	setMathBounds: vi.fn(),
	updateSettings: vi.fn(),
	observe: vi.fn(),
	resize: vi.fn(),
	screenshot: vi.fn(() => "data:image/png;base64,test"),
	getState: vi.fn(() => ({ expressions: { list: [] } })),
	destroy: vi.fn(),
}))

const loadDesmos = vi.hoisted(() => vi.fn(async () => ({
	GraphingCalculator: vi.fn(() => mockCalculator),
})))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ desmosScriptUri: "desmos-test.js" }),
}))

vi.mock("@src/utils/desmosLoader", () => ({ loadDesmos }))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key === "common:desmos.render_error" ? "Failed to render function" : key,
	}),
}))

vi.mock("@src/utils/clipboard", () => ({
	useCopyToClipboard: () => ({ showCopyFeedback: false, copyWithFeedback: vi.fn() }),
}))

describe("DesmosBlock", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("initializes the native calculator with expressions and bounds", async () => {
		render(<DesmosBlock code={JSON.stringify({
			version: 1,
			expressions: [{ id: "parabola", latex: "y=x^2", color: "#c74440" }],
			viewport: { xmin: -5, xmax: 5, ymin: -2, ymax: 10 },
		})} />)

		await waitFor(() => expect(mockCalculator.setExpression).toHaveBeenCalledWith(expect.objectContaining({
			id: "parabola",
			latex: "y=x^2",
		})))
		expect(mockCalculator.setMathBounds).toHaveBeenCalledWith({ left: -5, right: 5, bottom: -2, top: 10 })
		expect(mockCalculator.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ expressions: false }))
	})

	it("switches from compact to expanded calculator settings", async () => {
		render(<DesmosBlock code={JSON.stringify({ version: 1, expressions: [{ latex: "y=x" }] })} />)
		await waitFor(() => expect(mockCalculator.updateSettings).toHaveBeenCalled())

		fireEvent.click(screen.getByRole("button", { name: "common:desmos.expand" }))
		await waitFor(() => expect(mockCalculator.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
			expressions: true,
			keypad: true,
			settingsMenu: true,
		})))
	})

	it("creates a native slider expression", async () => {
		render(<DesmosBlock code={JSON.stringify({
			version: 1,
			expressions: [{ latex: "y=a*x", slider: { variable: "a", min: 0, max: 5, step: 0.5, value: 1 } }],
		})} />)

		await waitFor(() => expect(mockCalculator.setExpression).toHaveBeenCalledWith(expect.objectContaining({
			latex: "a=1",
			sliderBounds: { min: "0", max: "5", step: "0.5" },
		})))
	})

	it("shows a validation error for malformed configuration", async () => {
		render(<DesmosBlock code="{ invalid json }" />)
		expect(await screen.findByText(/Failed to render function/)).toBeInTheDocument()
		expect(loadDesmos).not.toHaveBeenCalled()
	})

	it("exports the current calculator screenshot", async () => {
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
		render(<DesmosBlock code={JSON.stringify({ version: 1, expressions: [{ latex: "y=x" }] })} />)
		await waitFor(() => expect(mockCalculator.screenshot).not.toHaveBeenCalled())
		fireEvent.click(screen.getByRole("button", { name: "common:desmos.export" }))
		expect(mockCalculator.screenshot).toHaveBeenCalled()
		expect(openSpy).toHaveBeenCalledWith("data:image/png;base64,test", "_blank", "noopener,noreferrer")
		openSpy.mockRestore()
	})

	it("destroys the calculator when unmounted", async () => {
		const view = render(<DesmosBlock code={JSON.stringify({ version: 1, expressions: [{ latex: "y=x" }] })} />)
		await waitFor(() => expect(mockCalculator.setExpression).toHaveBeenCalled())
		view.unmount()
		expect(mockCalculator.destroy).toHaveBeenCalled()
	})
})
