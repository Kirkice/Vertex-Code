import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@/utils/test-utils"

import { ChatRowContent } from "../ChatRow"

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { exists: () => true },
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: { type: "3rdParty", init: () => {} },
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		mcpServers: [],
		alwaysAllowMcp: false,
		currentCheckpoint: null,
		mode: "code",
		apiConfiguration: {},
		clineMessages: [],
		currentTaskItem: undefined,
	}),
}))

vi.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: () => ({ info: { supportsImages: true } }),
}))

const queryClient = new QueryClient()

describe("ChatRow mode handoff", () => {
	it("renders a readable handoff card", () => {
		render(
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={{
						ts: 1,
						type: "say",
						say: "mode_handoff",
						modeHandoff: {
							handoffId: "handoff-1",
							createdAt: 1,
							trigger: "user_mode_switch",
							fromMode: "code",
							toMode: "architect",
							fromProfile: "profile-a",
							toProfile: "profile-b",
							objective: "Implement mode handoff",
							completed: ["Added schema"],
							inProgress: ["Hooked into Task"],
							pending: ["Add UI polish"],
							constraints: [],
							touchedFiles: ["src/core/task/Task.ts"],
							openQuestions: [],
							recommendedNextStep: "Finish the remaining UI polish.",
						},
					}}
					isExpanded={false}
					isLast={false}
					isStreaming={false}
					onToggleExpand={() => {}}
					onSuggestionClick={() => {}}
					onBatchFileResponse={() => {}}
					onFollowUpUnmount={() => {}}
					isFollowUpAnswered={false}
				/>
			</QueryClientProvider>,
		)

		expect(screen.getByText("Mode Handoff")).toBeInTheDocument()
		expect(screen.getByText(/code/i)).toBeInTheDocument()
		expect(screen.getByText(/architect/i)).toBeInTheDocument()
		expect(screen.getByText("Implement mode handoff")).toBeInTheDocument()
		expect(screen.getByText("Added schema")).toBeInTheDocument()
		expect(screen.getByText("Hooked into Task")).toBeInTheDocument()
		expect(screen.getByText("Add UI polish")).toBeInTheDocument()
		expect(screen.getByText("Finish the remaining UI polish.")).toBeInTheDocument()
	})
})
