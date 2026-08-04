import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { type ExtensionMessage } from "@roo-code/types"

import TranslationProvider from "./i18n/TranslationContext"
import { MarketplaceViewStateManager } from "./components/marketplace/MarketplaceViewStateManager"

import { vscode } from "./utils/vscode"
import { telemetryClient } from "./utils/TelemetryClient"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "./utils/sourceMapInitializer"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import ChatView, { ChatViewRef } from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView, { SettingsViewRef } from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeViewProvider"
import { MarketplaceView } from "./components/marketplace/MarketplaceView"
import GraphicsWorkspace from "./components/graphics/GraphicsWorkspace"
import { CheckpointRestoreDialog } from "./components/chat/CheckpointRestoreDialog"
import { DeleteMessageDialog, EditMessageDialog } from "./components/chat/MessageModificationConfirmationDialog"
import ErrorBoundary from "./components/ErrorBoundary"
import { useAddNonInteractiveClickListener } from "./components/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "./components/ui/standard-tooltip"
import { Button } from "./components/ui"
import { ThemeProvider } from "./themes"

type Tab = "settings" | "history" | "chat" | "marketplace"

const normalizeTab = (tab: string): Tab => {
	// The former full-screen Graphics tab was replaced by an overlay HUD.
	// Extension actions from an older bundle may still target it, so keep Chat
	// visible instead of entering a tab state with no corresponding view.
	if (tab === "graphics") return "chat"

	return tab === "settings" || tab === "history" || tab === "marketplace" ? tab : "chat"
}

interface DeleteMessageDialogState {
	isOpen: boolean
	messageTs: number
	hasCheckpoint: boolean
}

interface EditMessageDialogState {
	isOpen: boolean
	messageTs: number
	text: string
	hasCheckpoint: boolean
	images?: string[]
}

// Memoize dialog components to prevent unnecessary re-renders
const MemoizedDeleteMessageDialog = React.memo(DeleteMessageDialog)
const MemoizedEditMessageDialog = React.memo(EditMessageDialog)
const MemoizedCheckpointRestoreDialog = React.memo(CheckpointRestoreDialog)
const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, Tab>> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	historyButtonClicked: "history",
	marketplaceButtonClicked: "marketplace",
}

const StartupScreen = ({ timedOut }: { timedOut: boolean }) => {
	const hasExtensionHost = vscode.isExtensionHostAvailable
	const title = timedOut ? "Vertex 启动失败" : "Vertex 正在启动…"
	const message = timedOut
		? hasExtensionHost
			? "扩展宿主没有返回初始状态。请重新加载 Webview；如果仍然失败，请打开扩展开发者工具查看错误。"
			: "当前页面没有 VS Code Webview API，无法连接到扩展宿主。请在 VS Code 的扩展开发主机中打开此插件。"
		: "正在连接扩展宿主，请稍候…"

	return (
		<div
			style={{
				minHeight: "100vh",
				boxSizing: "border-box",
				padding: "32px 24px",
				background: "#000000",
				color: "#f3edf7",
				fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
			}}
		>
			<div style={{ maxWidth: 560, margin: "12vh auto 0" }}>
				<div style={{ color: "#f29bd7", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>VERTEX</div>
				<h1 style={{ margin: "16px 0 10px", fontSize: 24, fontWeight: 600 }}>{title}</h1>
				<p style={{ margin: 0, color: "#c9c0ce", lineHeight: 1.6 }}>{message}</p>
				{timedOut && (
					<button
						type="button"
						onClick={() => window.location.reload()}
						style={{
							marginTop: 24,
							padding: "8px 14px",
							border: "1px solid #f29bd7",
							borderRadius: 6,
							background: "transparent",
							color: "#f3edf7",
							cursor: "pointer",
						}}
					>
						重新加载
					</button>
				)}
			</div>
		</div>
	)
}

const App = () => {
	const {
		didHydrateState,
		showWelcome,
		settingsImportedAt,
		shouldShowAnnouncement,
		telemetrySetting,
		telemetryKey,
		machineId,
		renderContext,
		mdmCompliant,
		mode,
	} = useExtensionState()

	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [tab, setTab] = useState<Tab>("chat")
	const [graphicsWorkspaceOpen, setGraphicsWorkspaceOpen] = useState(false)
	const [currentSection, setCurrentSection] = useState<string | undefined>(undefined)
	const [currentMarketplaceTab, setCurrentMarketplaceTab] = useState<string | undefined>(undefined)
	const [startupTimedOut, setStartupTimedOut] = useState(false)
	const handledImportRef = useRef<number | undefined>(undefined)
	const previousModeRef = useRef<string | undefined>(undefined)

	useEffect(() => {
		if (didHydrateState) {
			return
		}

		const timeout = window.setTimeout(() => setStartupTimedOut(true), 5000)
		return () => window.clearTimeout(timeout)
	}, [didHydrateState])

	// Graphics mode suggestion state
	const [graphicsModeSuggestion, setGraphicsModeSuggestion] = useState<{ text: string; targetMode: string } | null>(
		null,
	)

	// Create a persistent state manager
	const marketplaceStateManager = useMemo(() => new MarketplaceViewStateManager(), [])

	const [deleteMessageDialogState, setDeleteMessageDialogState] = useState<DeleteMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		hasCheckpoint: false,
	})

	const [editMessageDialogState, setEditMessageDialogState] = useState<EditMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		text: "",
		hasCheckpoint: false,
		images: [],
	})

	const settingsRef = useRef<SettingsViewRef>(null)
	const chatViewRef = useRef<ChatViewRef>(null)

	const switchTab = useCallback(
		(newTab: Tab) => {
			if (mdmCompliant === false) {
				// Notify the user that authentication is required by their organization
				vscode.postMessage({ type: "showMdmAuthRequiredNotification" })
				return
			}

			setCurrentSection(undefined)

			if (settingsRef.current?.checkUnsaveChanges) {
				settingsRef.current.checkUnsaveChanges(() => setTab(newTab))
			} else {
				setTab(newTab)
			}
		},
		[mdmCompliant],
	)

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			if (message.type === "action" && message.action) {
				// Handle switchTab action with tab parameter. Legacy extension
				// bundles can still request the removed full-screen Graphics tab.
				if (message.action === "switchTab" && message.tab) {
					const requestedTab = message.tab
					const targetTab = normalizeTab(requestedTab)
					switchTab(targetTab)
					if (requestedTab === "graphics") {
						setGraphicsWorkspaceOpen(false)
					}
					// Extract targetSection from values if provided
					const targetSection = message.values?.section as string | undefined
					setCurrentSection(targetSection)
					setCurrentMarketplaceTab(undefined)
				} else {
					// Handle other actions using the mapping
					const newTab = tabsByMessageAction[message.action]
					const section = message.values?.section as string | undefined
					const marketplaceTab = message.values?.marketplaceTab as string | undefined

					if (newTab) {
						switchTab(newTab)
						setCurrentSection(section)
						setCurrentMarketplaceTab(marketplaceTab)

						// Request marketplace data immediately when switching in via
						// toolbar/action messages so we do not depend on mount timing.
						if (newTab === "marketplace") {
							vscode.postMessage({
								type: "fetchMarketplaceData",
							})
						}
					}
				}
			}

			if (message.type === "showDeleteMessageDialog" && message.messageTs) {
				setDeleteMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					hasCheckpoint: message.hasCheckpoint || false,
				})
			}

			if (message.type === "showEditMessageDialog" && message.messageTs && message.text) {
				setEditMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					text: message.text,
					hasCheckpoint: message.hasCheckpoint || false,
					images: message.images || [],
				})
			}

			if (message.type === "acceptInput") {
				chatViewRef.current?.acceptInput()
			}

			// Handle graphics mode suggestion from extension
			if (message.type === ("graphicsModeSuggestion" as any)) {
				const suggestionText = (message as any).text as string | undefined
				const targetMode = (message as any).targetMode as string | undefined
				if (suggestionText && targetMode) {
					// Show suggestion UI for user to confirm/reject
					setGraphicsModeSuggestion({ text: suggestionText, targetMode })
				}
			}
		},
		[switchTab],
	)

	useEvent("message", onMessage)

	useEffect(() => {
		if (!didHydrateState || showWelcome || mdmCompliant === false) {
			return
		}

		const previousMode = previousModeRef.current
		const enteredGraphicsMode = mode === "graphics" && previousMode !== "graphics"
		const leftGraphicsMode = mode !== "graphics" && previousMode === "graphics"
		previousModeRef.current = mode

		if (enteredGraphicsMode) {
			setCurrentSection(undefined)
			setTab("chat")
			setGraphicsWorkspaceOpen(false)
		} else if (leftGraphicsMode) {
			setGraphicsWorkspaceOpen(false)
		}
	}, [didHydrateState, mdmCompliant, mode, showWelcome])

	useEffect(() => {
		if (shouldShowAnnouncement && tab === "chat") {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement, tab])

	useEffect(() => {
		const isRecoverableTab = tab === "settings" || tab === "marketplace"

		if (showWelcome && settingsImportedAt && settingsImportedAt !== handledImportRef.current) {
			handledImportRef.current = settingsImportedAt
			if (!isRecoverableTab) {
				setCurrentSection("providers")
				setTab("settings")
			}
		}
	}, [showWelcome, settingsImportedAt, tab])

	useEffect(() => {
		if (didHydrateState) {
			telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, machineId)
		}
	}, [telemetrySetting, telemetryKey, machineId, didHydrateState])

	// Tell the extension that we are ready to receive messages.
	useEffect(() => vscode.postMessage({ type: "webviewDidLaunch" }), [])

	// Initialize source map support for better error reporting
	useEffect(() => {
		// Initialize source maps for better error reporting in production
		initializeSourceMaps()

		// Expose source map debugging utilities in production
		if (process.env.NODE_ENV === "production") {
			exposeSourceMapsForDebugging()
		}

		// Log initialization for debugging
		console.debug("App initialized with source map support")
	}, [])

	// Focus the WebView when non-interactive content is clicked (only in editor/tab mode)
	useAddNonInteractiveClickListener(
		useCallback(() => {
			// Only send focus request if we're in editor (tab) mode, not sidebar
			if (renderContext === "editor") {
				vscode.postMessage({ type: "focusPanelRequest" })
			}
		}, [renderContext]),
	)

	if (!didHydrateState) {
		return <StartupScreen timedOut={startupTimedOut} />
	}

	// Do not conditionally load ChatView, it's expensive and there's state we
	// don't want to lose (user input, disableInput, askResponse promise, etc.)
	const isSetupGatedTab = showWelcome && tab !== "settings" && tab !== "marketplace"

	return isSetupGatedTab ? (
		<WelcomeView />
	) : (
		<>
			{tab === "history" && <HistoryView onDone={() => switchTab("chat")} />}
			{tab === "marketplace" && (
				<MarketplaceView
					stateManager={marketplaceStateManager}
					onDone={() => switchTab("chat")}
					targetTab={currentMarketplaceTab as "mcp" | "mode" | "skill" | "knowledge" | undefined}
				/>
			)}
			{tab === "settings" && (
				<SettingsView ref={settingsRef} onDone={() => setTab("chat")} targetSection={currentSection} />
			)}
			{mode === "graphics" && tab === "chat" && !graphicsWorkspaceOpen && (
				<Button
					variant="secondary"
					size="sm"
					className="fixed right-4 top-3 z-40 rounded-full border border-vscode-focusBorder/50 bg-vscode-editor-background/90 px-3 shadow-xl shadow-black/25 backdrop-blur-xl"
					onClick={() => setGraphicsWorkspaceOpen(true)}>
					<span className="codicon codicon-dashboard text-vscode-focusBorder" />
					<span className="ml-1">Graphics HUD</span>
				</Button>
			)}
			{mode === "graphics" && tab === "chat" && graphicsWorkspaceOpen && (
				<GraphicsWorkspace onDone={() => setGraphicsWorkspaceOpen(false)} />
			)}
			{graphicsModeSuggestion && (
				<div className="fixed bottom-4 right-4 z-50 max-w-sm bg-vscode-editor-background border border-vscode-panel-border rounded-lg shadow-lg p-4">
					<div className="flex items-start gap-3">
						<span className="codicon codicon-lightbulb text-vscode-descriptionForeground text-lg mt-0.5"></span>
						<div className="flex-1">
							<p className="text-sm text-vscode-foreground mb-3">{graphicsModeSuggestion.text}</p>
							<div className="flex gap-2">
								<Button
									variant="primary"
									size="sm"
									onClick={() => {
										vscode.postMessage({
											type: "switchMode",
											mode: graphicsModeSuggestion.targetMode,
										} as any)
										switchTab("chat")
										setGraphicsModeSuggestion(null)
									}}>
									Switch to Graphics Mode
								</Button>
								<Button variant="secondary" size="sm" onClick={() => setGraphicsModeSuggestion(null)}>
									Dismiss
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
			<ChatView
				ref={chatViewRef}
				isHidden={tab !== "chat"}
				showAnnouncement={showAnnouncement}
				hideAnnouncement={() => setShowAnnouncement(false)}
			/>
			{deleteMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={deleteMessageDialogState.isOpen}
					type="delete"
					hasCheckpoint={deleteMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
							restoreCheckpoint,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedDeleteMessageDialog
					open={deleteMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
			{editMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={editMessageDialogState.isOpen}
					type="edit"
					hasCheckpoint={editMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							restoreCheckpoint,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedEditMessageDialog
					open={editMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							images: editMessageDialogState.images,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
		</>
	)
}

const queryClient = new QueryClient()

const AppWithProviders = () => (
	<ErrorBoundary>
		<ExtensionStateContextProvider>
			<ThemeProvider>
				<TranslationProvider>
					<QueryClientProvider client={queryClient}>
						<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
							<App />
						</TooltipProvider>
					</QueryClientProvider>
				</TranslationProvider>
			</ThemeProvider>
		</ExtensionStateContextProvider>
	</ErrorBoundary>
)

export default AppWithProviders
