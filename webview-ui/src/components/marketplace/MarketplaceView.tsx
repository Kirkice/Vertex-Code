import { useState, useEffect, useMemo, useContext } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Server, Users2, GraduationCap } from "lucide-react"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { MarketplaceViewStateManager } from "./MarketplaceViewStateManager"
import { useStateManager } from "./useStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { MarketplaceListView } from "./MarketplaceListView"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ExtensionStateContext } from "@/context/ExtensionStateContext"

interface MarketplaceViewProps {
	onDone?: () => void
	stateManager: MarketplaceViewStateManager
	targetTab?: "mcp" | "mode" | "skill"
}
export function MarketplaceView({ stateManager, onDone, targetTab }: MarketplaceViewProps) {
	const { t } = useAppTranslation()
	const [state, manager] = useStateManager(stateManager)
	const [hasReceivedInitialState, setHasReceivedInitialState] = useState(false)
	const extensionState = useContext(ExtensionStateContext)
	const [lastOrganizationSettingsVersion, setLastOrganizationSettingsVersion] = useState<number>(
		extensionState?.organizationSettingsVersion ?? -1,
	)

	useEffect(() => {
		const currentVersion = extensionState?.organizationSettingsVersion ?? -1
		if (currentVersion !== lastOrganizationSettingsVersion) {
			vscode.postMessage({
				type: "fetchMarketplaceData",
			})
		}
		setLastOrganizationSettingsVersion(currentVersion)
	}, [extensionState?.organizationSettingsVersion, lastOrganizationSettingsVersion])

	// Track when we receive the initial state
	useEffect(() => {
		// Check if we already have items (state might have been received before mount)
		if (state.allItems.length > 0 && !hasReceivedInitialState) {
			setHasReceivedInitialState(true)
		}
	}, [state.allItems, hasReceivedInitialState])

	useEffect(() => {
		if (targetTab && (targetTab === "mcp" || targetTab === "mode")) {
			manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: targetTab } })
		}
	}, [targetTab, manager])

	// Ensure marketplace state manager processes messages when component mounts
	useEffect(() => {
		// When the marketplace view first mounts, we need to trigger a state update
		// to ensure we get the current marketplace items. We do this by sending
		// a filter message with empty filters, which will cause the extension to
		// send back the full state including all marketplace items.
		if (!hasReceivedInitialState && state.allItems.length === 0) {
			// Fetch marketplace data on demand
			// Note: isFetching is already true by default for initial load
			vscode.postMessage({
				type: "fetchMarketplaceData",
			})
		}

		// Listen for state changes to know when initial data arrives
		const unsubscribe = manager.onStateChange((newState) => {
			// Mark as received initial state when we get any state update
			// This prevents infinite loops and ensures proper state handling
			if (!hasReceivedInitialState && (newState.allItems.length > 0 || newState.displayItems !== undefined)) {
				setHasReceivedInitialState(true)
			}
		})

		const handleVisibilityMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "webviewVisible" && message.visible === true) {
				// Data will be automatically fresh when panel becomes visible
				// No manual fetching needed since we removed caching
			}
		}

		window.addEventListener("message", handleVisibilityMessage)
		return () => {
			window.removeEventListener("message", handleVisibilityMessage)
			unsubscribe()
		}
	}, [manager, hasReceivedInitialState, state.allItems.length])

	// Memoize all available tags
	const allTags = useMemo(
		() => Array.from(new Set(state.allItems.flatMap((item) => item.tags || []))).sort(),
		[state.allItems],
	)

	// Memoize filtered tags
	const filteredTags = useMemo(() => allTags, [allTags])

	// Compute item counts for the active tab
	const activeItems = state.displayItems || []
	const activeFiltered = state.activeTab
		? activeItems.filter((item) => item.type === state.activeTab)
		: activeItems
	const totalCount = activeFiltered.length
	const installedCount = activeFiltered.filter((item) => {
		const installedMetadata = state.installedMetadata
		return !!installedMetadata?.project?.[item.id] || !!installedMetadata?.global?.[item.id]
	}).length

	const tabConfig = [
		{ id: "mcp" as const, label: "MCP", icon: Server },
		{ id: "mode" as const, label: "Modes", icon: Users2 },
		{ id: "skill" as const, label: "Skills", icon: GraduationCap },
	]

	return (
		<TooltipProvider delayDuration={300}>
			<Tab>
				<TabHeader className="flex flex-col sticky top-0 z-10 bg-vscode-sideBar-background">
					{/* Section Header - Graphics Providers style */}
					<div className="px-5 pt-6 pb-4">
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								className="px-1.5 -ml-2"
								onClick={() => onDone?.()}
								aria-label={t("settings:back")}>
								<ArrowLeft />
								<span className="sr-only">{t("settings:back")}</span>
							</Button>
							<div>
								<h3 className="text-[1.25em] font-semibold text-vscode-foreground m-0">
									{t("marketplace:title")}
								</h3>
								<p className="text-vscode-descriptionForeground text-sm mt-1 mb-0">
									{totalCount > 0
										? `${installedCount} of ${totalCount} item${totalCount !== 1 ? "s" : ""} installed`
										: "Browse and install MCP servers, modes, and skills."}
								</p>
							</div>
						</div>
					</div>

					{/* Pill-style Tab Selector */}
					<div className="px-5 pb-3">
						<div className="flex gap-1 rounded-md border border-vscode-panel-border bg-vscode-editor-background p-1">
							{tabConfig.map(({ id, label, icon: Icon }) => {
								const isActive = state.activeTab === id
								return (
									<button
										key={id}
										className={cn(
											"cursor-pointer flex items-center justify-center gap-1.5 flex-1 text-xs font-medium rounded-sm px-3 py-1.5 transition-all duration-200",
											isActive
												? "bg-vscode-button-background text-vscode-button-foreground shadow-sm"
												: "text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-list-hoverBackground",
										)}
										onClick={() =>
											manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: id } })
										}>
										<Icon className="size-3.5" />
										{label}
									</button>
								)
							})}
						</div>
					</div>
				</TabHeader>

				<TabContent className="px-5 py-2">
					{state.activeTab === "mcp" && (
						<MarketplaceListView
							stateManager={stateManager}
							allTags={allTags}
							filteredTags={filteredTags}
							filterByType="mcp"
						/>
					)}
					{state.activeTab === "mode" && (
						<MarketplaceListView
							stateManager={stateManager}
							allTags={allTags}
							filteredTags={filteredTags}
							filterByType="mode"
						/>
					)}
					{state.activeTab === "skill" && (
						<MarketplaceListView
							stateManager={stateManager}
							allTags={allTags}
							filteredTags={filteredTags}
							filterByType="skill"
						/>
					)}
				</TabContent>
			</Tab>
		</TooltipProvider>
	)
}
