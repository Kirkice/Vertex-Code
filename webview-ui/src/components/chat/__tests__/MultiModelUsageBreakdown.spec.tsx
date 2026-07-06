// npx vitest src/components/chat/__tests__/MultiModelUsageBreakdown.spec.tsx

import React from "react"
import { render, screen } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { MultiModelUsage } from "@roo-code/types"

import MultiModelUsageBreakdown from "../MultiModelUsageBreakdown"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: any) => {
			if (params?.defaultValue) return params.defaultValue
			return key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

const renderBreakdown = (usage: MultiModelUsage) => {
	const queryClient = new QueryClient()
	return render(
		<QueryClientProvider client={queryClient}>
			<MultiModelUsageBreakdown usage={usage} />
		</QueryClientProvider>,
	)
}

const makeUsage = (overrides: Partial<MultiModelUsage> = {}): MultiModelUsage => ({
	total: {
		totalTokensIn: 300,
		totalTokensOut: 150,
		totalCost: 0.045,
		contextTokens: 300,
	},
	byMode: [
		{ mode: "code", requestCount: 2, tokensIn: 200, tokensOut: 100, totalCost: 0.03 },
		{ mode: "architect", requestCount: 1, tokensIn: 100, tokensOut: 50, totalCost: 0.015 },
	],
	byProfile: [
		{ profile: "qwen", requestCount: 2, tokensIn: 200, tokensOut: 100, totalCost: 0.03 },
		{ profile: "gpt", requestCount: 1, tokensIn: 100, tokensOut: 50, totalCost: 0.015 },
	],
	currentEffectiveMode: "code",
	currentEffectiveProfile: "qwen",
	currentEffectiveModelId: "qwen-max",
	...overrides,
})

describe("MultiModelUsageBreakdown", () => {
	it("renders Top Cost Mode and Top Cost Profile when data exists", () => {
		renderBreakdown(makeUsage())
		expect(screen.getByText(/Top cost mode/)).toBeInTheDocument()
		expect(screen.getByText(/Top cost profile/)).toBeInTheDocument()
		// "code" appears in both Top Cost and By Mode table, so use getAllByText
		expect(screen.getAllByText("code").length).toBeGreaterThan(0)
	})

	it("renders By Mode table with mode names", () => {
		renderBreakdown(makeUsage())
		expect(screen.getByText("By Mode")).toBeInTheDocument()
		expect(screen.getAllByText("code").length).toBeGreaterThan(0)
		expect(screen.getByText("architect")).toBeInTheDocument()
	})

	it("renders By Profile table with profile names", () => {
		renderBreakdown(makeUsage())
		expect(screen.getByText("By Profile")).toBeInTheDocument()
		expect(screen.getByText("qwen")).toBeInTheDocument()
		expect(screen.getByText("gpt")).toBeInTheDocument()
	})

	it("renders request count and cost values", () => {
		renderBreakdown(makeUsage())
		// code mode has 2 requests (appears in both byMode and byProfile tables)
		expect(screen.getAllByText("2").length).toBeGreaterThan(0)
		// cost $0.0300 (appears in both tables)
		expect(screen.getAllByText("$0.0300").length).toBeGreaterThan(0)
	})

	it("does not render Top Cost when byMode is empty", () => {
		renderBreakdown(makeUsage({ byMode: [], byProfile: [] }))
		expect(screen.queryByText(/Top cost mode/)).not.toBeInTheDocument()
		expect(screen.queryByText("By Mode")).not.toBeInTheDocument()
		expect(screen.queryByText("By Profile")).not.toBeInTheDocument()
	})

	it("renders unknown bucket for items without mode/profile", () => {
		renderBreakdown(
			makeUsage({
				byMode: [{ requestCount: 1, tokensIn: 50, tokensOut: 25, totalCost: 0.01 }],
				byProfile: [{ requestCount: 1, tokensIn: 50, tokensOut: 25, totalCost: 0.01 }],
			}),
		)
		expect(screen.getAllByText("unknown").length).toBeGreaterThanOrEqual(2)
	})

	it("renders multiple modes in the table", () => {
		renderBreakdown(
			makeUsage({
				byMode: [
					{ mode: "code", requestCount: 3, tokensIn: 100, tokensOut: 50, totalCost: 0.01 },
					{ mode: "ask", requestCount: 2, tokensIn: 80, tokensOut: 40, totalCost: 0.02 },
					{ mode: "architect", requestCount: 1, tokensIn: 60, tokensOut: 30, totalCost: 0.03 },
				],
			}),
		)
		expect(screen.getAllByText("code").length).toBeGreaterThan(0)
		expect(screen.getByText("ask")).toBeInTheDocument()
		expect(screen.getAllByText("architect").length).toBeGreaterThan(0)
	})
})
