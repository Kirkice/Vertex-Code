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
				"common:desmos.loading": "Loading plot...",
				"common:desmos.render_error": "Failed to render function",
				"common:desmos.export": "Export as SVG",
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

// Mock mathjs
vi.mock("mathjs", () => {
	const mockCompile = (expr: string) => ({
		evaluate: (scope: { x: number }) => {
			try {
				if (expr === "x") return scope.x
				if (expr === "x^2") return scope.x * scope.x
				if (expr.includes("?")) {
					const parts = expr.split("?")
					const condPart = parts[0].trim()
					const rest = parts[1].split(":")
					const expr1 = rest[0].trim()
					const expr2 = rest.slice(1).join(":").trim()
					if (condPart.includes("<=")) {
						const [left, right] = condPart.split("<=")
						const leftVal = left.trim() === "x" ? scope.x : parseFloat(left)
						const rightVal = parseFloat(right)
						if (leftVal <= rightVal) return evalExpr(expr1, scope.x)
						else return evalExpr(expr2, scope.x)
					}
					if (condPart.includes(">")) {
						const [left, right] = condPart.split(">")
						const leftVal = left.trim() === "x" ? scope.x : parseFloat(left)
						const rightVal = parseFloat(right)
						if (leftVal > rightVal) return evalExpr(expr1, scope.x)
						else return evalExpr(expr2, scope.x)
					}
				}
				return scope.x
			} catch {
				return NaN
			}
		},
	})

	const mockAll = { create: () => ({ compile: mockCompile }) }

	return {
		create: () => ({ compile: mockCompile }),
		all: mockAll,
	}
})

function evalExpr(expr: string, x: number): number {
	if (expr === "x") return x
	if (expr === "x/12.92") return x / 12.92
	if (expr.includes("^")) {
		const parts = expr.split("^")
		const base = parts[0].trim()
		const exp = parseFloat(parts[1].trim().replace(/[()]/g, ""))
		const baseVal = evalExpr(base, x)
		return Math.pow(baseVal, exp)
	}
	return x
}

describe("DesmosBlock", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Configuration Validation", () => {
		it("should render plot container for valid config", async () => {
			const validConfig = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
			})

			const { container } = render(<DesmosBlock code={validConfig} />)

			await waitFor(() => {
				expect(container.querySelector("svg")).toBeInTheDocument()
			})
		})

		it("should show error for invalid JSON", async () => {
			const invalidJson = "{ invalid json }"

			render(<DesmosBlock code={invalidJson} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
			})
		})

		it("should show error when version is missing", async () => {
			const config = JSON.stringify({
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
			})
		})

		it("should show error when version is not 1", async () => {
			const config = JSON.stringify({
				version: 2,
				expressions: [{ latex: "y = x^2" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
			})
		})

		it("should show error when expressions array is empty", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
			})
		})

		it("should show error when expression latex is missing", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ color: "#ff0000" }],
			})

			render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
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
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
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
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
			})
		})
	})

	describe("Successful Rendering", () => {
		it("should render SVG with valid configuration", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
			})

			const { container } = render(<DesmosBlock code={config} />)

			await waitFor(() => {
				expect(container.querySelector("svg")).toBeInTheDocument()
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

		it("should render SVG paths for expressions", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [
					{ latex: "y = x^2", color: "#ff0000" },
					{ latex: "y = x", color: "#00ff00" },
				],
			})

			const { container } = render(<DesmosBlock code={config} />)

			await waitFor(() => {
				const paths = container.querySelectorAll("svg path")
				expect(paths.length).toBeGreaterThanOrEqual(2)
			})
		})

		it("should render grid lines when showGrid is true", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
				options: { showGrid: true },
			})

			const { container } = render(<DesmosBlock code={config} />)

			await waitFor(() => {
				const lines = container.querySelectorAll("svg line")
				expect(lines.length).toBeGreaterThan(0)
			})
		})

		it("should render axis labels", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [{ latex: "y = x^2" }],
				options: { xAxisLabel: "X-Axis", yAxisLabel: "Y-Axis" },
			})

			const { container } = render(<DesmosBlock code={config} />)

			await waitFor(() => {
				const texts = container.querySelectorAll("svg text")
				const labels = Array.from(texts).map((t) => t.textContent)
				expect(labels).toContain("X-Axis")
				expect(labels).toContain("Y-Axis")
			})
		})

		it("should render expression labels", async () => {
			const config = JSON.stringify({
				version: 1,
				expressions: [
					{
						latex: "y = x^2",
						label: "Quadratic",
					},
				],
			})

			const { container } = render(<DesmosBlock code={config} />)

			await waitFor(() => {
				const texts = container.querySelectorAll("svg text")
				const labels = Array.from(texts).map((t) => t.textContent)
				expect(labels).toContain("Quadratic")
			})
		})
	})

	describe("Error Handling", () => {
		it("should expand error details when clicked", async () => {
			const invalidJson = "{ invalid }"

			render(<DesmosBlock code={invalidJson} />)

			await waitFor(() => {
				expect(screen.getByText("Failed to render function")).toBeInTheDocument()
			})

			fireEvent.click(screen.getByText("Failed to render function"))

			await waitFor(() => {
				expect(screen.getByTestId("code-block")).toBeInTheDocument()
			})
		})
	})
})
