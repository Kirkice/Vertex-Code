import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import DesmosBlock from "../DesmosBlock"

// Mock the vscode utility
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation context
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"common:desmos.loading": "Loading Desmos calculator...",
				"common:desmos.render_error": "Failed to Render Function",
				"common:desmos.export": "Export as PNG",
				"common:desmos.copy": "Copy configuration",
			}
			return translations[key] || key
		},
	}),
}))

// Mock the clipboard utility
vi.mock("@src/utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		showCopyFeedback: false,
		copyWithFeedback: vi.fn(),
	}),
}))

// Mock CodeBlock component
vi.mock("../CodeBlock", () => ({
	default: ({ source }: { source: string }) => <pre data-testid="code-block">{source}</pre>,
}))

// Mock Desmos API
const mockCalculator = {
	setExpression: vi.fn(),
	removeExpression: vi.fn(),
	setMathBounds: vi.fn(),
	setGraphSettings: vi.fn(),
	screenshot: vi.fn(() => "data:image/png;base64,mock"),
	getState: vi.fn(() => ({})),
	setState: vi.fn(),
	setBlank: vi.fn(),
	destroy: vi.fn(),
}

const mockDesmos = {
	GraphingCalculator: vi.fn(() => mockCalculator),
}

describe("DesmosBlock", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock window.Desmos
		;(window as any).Desmos = mockDesmos
	})

	describe("Configuration Validation", () => {
		it("should render loading state initially", () => {
			const validConfig = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={validConfig} />)
			expect(screen.getByText("Loading Desmos calculator...")).toBeInTheDocument()
		})

		it("should show error for invalid JSON", async () => {
			const invalidJson = "{ invalid json }"

			render(<DesmosBlock code={invalidJson} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})
		})

		it("should show error when version is missing", async () => {
			const config = JSON.stringify({
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})
		})

		it("should show error when version is not 1", async () => {
			const config = JSON.stringify({
				version: 2,
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})
		})

		it("should show error when expressions array is empty", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})
		})

		it("should show error when expression latex is missing", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ color: "#ff0000" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})
		})

		it("should show error when viewport xmin >= xmax", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
				viewport: { xmin: 10, xmax: -10 },
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})
		})

		it("should show error when viewport ymin >= ymax", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
				viewport: { ymin: 10, ymax: -10 },
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})
		})
	})

	describe("Successful Rendering", () => {
		it("should render calculator with valid configuration", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockDesmos.GraphingCalculator).toHaveBeenCalled()
			})
		})

		it("should render title when provided", async () => {
			const config = JSON.stringify({
				version: 1,
				title: "Test Function",
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Test Function")).toBeInTheDocument()
			})
		})

		it("should set expressions with correct colors", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [
					{ latex: "y = x^2", color: "#ff0000" },
					{ latex: "y = x", color: "#00ff00" },
				],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockCalculator.setExpression).toHaveBeenCalledTimes(2)
				expect(mockCalculator.setExpression).toHaveBeenCalledWith(
					expect.objectContaining({
						latex: "y = x^2",
						color: "#ff0000",
					}),
				)
				expect(mockCalculator.setExpression).toHaveBeenCalledWith(
					expect.objectContaining({
						latex: "y = x",
						color: "#00ff00",
					}),
				)
			})
		})

		it("should use default colors when not specified", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockCalculator.setExpression).toHaveBeenCalledWith(
					expect.objectContaining({
						color: "#c74440", // First default color
					}),
				)
			})
		})

		it("should set viewport when provided", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
				viewport: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 },
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockCalculator.setMathBounds).toHaveBeenCalledWith({
					left: -5,
					right: 5,
					top: 5,
					bottom: -5,
				})
			})
		})

		it("should set graph settings when provided", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
				options: {
					showGrid: false,
					showXAxis: true,
					showYAxis: false,
					xAxisLabel: "X",
					yAxisLabel: "Y",
				},
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockCalculator.setGraphSettings).toHaveBeenCalledWith({
					showGrid: false,
					showXAxis: true,
					showYAxis: false,
					xAxisLabel: "X",
					yAxisLabel: "Y",
					lockViewport: false,
				})
			})
		})

		it("should handle parametric domain", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [
					{
						latex: "(cos(t), sin(t))",
						parametricDomain: { min: 0, max: 6.28 },
					},
				],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockCalculator.setExpression).toHaveBeenCalledWith(
					expect.objectContaining({
						parametricDomain: { min: "0", max: "6.28" },
					}),
				)
			})
		})

		it("should handle line style", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [
					{
						latex: "y = x^2",
						lineStyle: { width: 3, opacity: 0.5, dashed: true },
					},
				],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockCalculator.setExpression).toHaveBeenCalledWith(
					expect.objectContaining({
						lineStyle: {
							width: 3,
							opacity: 0.5,
							style: "DASHED",
						},
					}),
				)
			})
		})

		it("should handle label", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [
					{
						latex: "y = x^2",
						label: "Quadratic",
					},
				],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockCalculator.setExpression).toHaveBeenCalledWith(
					expect.objectContaining({
						label: "Quadratic",
						showLabel: true,
					}),
				)
			})
		})
	})

	describe("Error Handling", () => {
		it("should show error when Desmos API fails to load", async () => {
			// Remove Desmos from window and simulate script load failure
			delete (window as any).Desmos

			const appendChildSpy = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
				const script = node as HTMLScriptElement
				queueMicrotask(() => {
					script.onerror?.(new Event("error") as any)
				})
				return node
			})

			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})

			appendChildSpy.mockRestore()
		})

		it("should expand error details when clicked", async () => {
			const invalidJson = "{ invalid }"

			render(<DesmosBlock code={invalidJson} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to Render Function")).toBeInTheDocument()
			})

			fireEvent.click(screen.getByText("Failed to Render Function"))

			await waitFor(() => {
				expect(screen.getByTestId("code-block")).toBeInTheDocument()
			})
		})
	})

	describe("Cleanup", () => {
		it("should destroy calculator on unmount", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
			})

			const { unmount } = render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(mockDesmos.GraphingCalculator).toHaveBeenCalled()
			})

			unmount()

			expect(mockCalculator.destroy).toHaveBeenCalled()
		})
	})
})
