// npx vitest src/components/chat/__tests__/TaskHeader.multi-model.spec.tsx

import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ProviderSettings, MultiModelUsage } from "@roo-code/types"

import TaskHeader, { TaskHeaderProps } from "../TaskHeader"

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

// Mock the vscode API
const { mockPostMessage } = vi.hoisted(() => ({
	mockPostMessage: vi.fn(),
}))
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: mockPostMessage,
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children }: { children: React.ReactNode }) => <div data-testid="vscode-badge">{children}</div>,
}))

const mockExtensionState: {
	apiConfiguration: ProviderSettings
	currentTaskItem: { id: string; mode?: string } | null
	clineMessages: any[]
} = {
	apiConfiguration: {
		apiProvider: "anthropic",
		apiKey: "test-api-key",
		apiModelId: "claude-3-opus-20240229",
	} as ProviderSettings,
	currentTaskItem: { id: "test-task-id", mode: "code" },
	clineMessages: [],
}

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockExtensionState,
}))

const defaultProps: TaskHeaderProps = {
	task: { type: "say", ts: Date.now(), text: "Test task", images: [] } as any,
	tokensIn: 100,
	tokensOut: 50,
	totalCost: 0.05,
	contextTokens: 200,
	buttonsDisabled: false,
	handleCondenseContext: vi.fn(),
}

const makeMultiModelUsage = (): MultiModelUsage => ({
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
	],
	currentEffectiveMode: "code",
	currentEffectiveProfile: "qwen",
	currentEffectiveModelId: "qwen-max",
})

const renderTaskHeader = (props: Partial<TaskHeaderProps> = {}) => {
	const queryClient = new QueryClient()
	return render(
		<QueryClientProvider client={queryClient}>
			<TaskHeader {...defaultProps} {...props} />
		</QueryClientProvider>,
	)
}

describe("TaskHeader - multi-model breakdown", () => {
	it("does not render MultiModelUsageBreakdown when collapsed", () => {
		renderTaskHeader({ multiModelUsage: makeMultiModelUsage() })
		// Collapsed by default — breakdown should not be visible
		expect(screen.queryByText("By Mode")).not.toBeInTheDocument()
	})

	it("renders MultiModelUsageBreakdown when expanded and byMode has data", () => {
		renderTaskHeader({ multiModelUsage: makeMultiModelUsage() })
		// Click to expand
		const taskText = screen.getByText("Test task")
		fireEvent.click(taskText)
		// Now breakdown should be visible
		expect(screen.getByText("By Mode")).toBeInTheDocument()
		expect(screen.getByText("By Profile")).toBeInTheDocument()
		expect(screen.getAllByText("code").length).toBeGreaterThan(0)
	})

	it("does not render breakdown when byMode is empty even if expanded", () => {
		const emptyUsage = makeMultiModelUsage()
		emptyUsage.byMode = []
		renderTaskHeader({ multiModelUsage: emptyUsage })
		fireEvent.click(screen.getByText("Test task"))
		expect(screen.queryByText("By Mode")).not.toBeInTheDocument()
	})

	it("does not render breakdown when multiModelUsage is undefined", () => {
		renderTaskHeader({ multiModelUsage: undefined })
		fireEvent.click(screen.getByText("Test task"))
		expect(screen.queryByText("By Mode")).not.toBeInTheDocument()
	})

	it("shows current Mode label in collapsed state", () => {
		renderTaskHeader({ multiModelUsage: makeMultiModelUsage() })
		// currentTaskItem.mode = "code", should appear in the model label
		expect(screen.getAllByText(/code/).length).toBeGreaterThan(0)
	})
})
