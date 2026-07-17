import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { X, ChevronsUpDown } from "lucide-react"
import { MarketplaceItemCard } from "./components/MarketplaceItemCard"
import { MarketplaceBulkInstallModal } from "./components/MarketplaceBulkInstallModal"
import { MarketplaceViewStateManager } from "./MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useStateManager } from "./useStateManager"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { IssueFooter } from "./IssueFooter"
import { MarketplaceItem } from "@roo-code/types"

const UNGROUPED_ITEMS_KEY = "__marketplace_ungrouped__"

export interface MarketplaceListViewProps {
	stateManager: MarketplaceViewStateManager
	allTags: string[]
	filteredTags: string[]
	filterByType?: "mcp" | "mode" | "skill" | "knowledge"
}

export function MarketplaceListView({ stateManager, allTags, filteredTags, filterByType }: MarketplaceListViewProps) {
	const [state, manager] = useStateManager(stateManager)
	const { t } = useAppTranslation()
	const { cloudUserInfo, cwd } = useExtensionState()
	const [isTagPopoverOpen, setIsTagPopoverOpen] = React.useState(false)
	const [tagSearch, setTagSearch] = React.useState("")
	const allItems = state.displayItems || []
	const organizationMcps = state.displayOrganizationMcps || []
	const installedMetadata = state.installedMetadata
	const [bulkInstallGroup, setBulkInstallGroup] = React.useState<{
		name: string
		items: MarketplaceItem[]
	} | null>(null)

	// NOTE: installed metadata is already synchronized into the state manager via handleMessage("state"/"marketplaceData")
	// in MarketplaceViewStateManager; avoid dispatching UPDATE_FILTERS here to prevent render loops.

	// Filter items by type if specified
	const items = filterByType ? allItems.filter((item) => item.type === filterByType) : allItems
	const orgMcps = filterByType === "mcp" ? organizationMcps : []

	const isEmpty = items.length === 0 && orgMcps.length === 0

	const itemGroups = React.useMemo(() => {
		if (filterByType !== "skill" && filterByType !== "knowledge") {
			return []
		}

		const groups = new Map<
			string,
			{
				key: string
				name: string
				description?: string
				order: number
				items: MarketplaceItem[]
				remainingItems: MarketplaceItem[]
			}
		>()

		for (const item of items) {
			const hasGroup = (item.type === "skill" || item.type === "knowledge") && !!item.group
			// Items without an explicit group must share one flat grid. Treating
			// every item as its own group leaves a large empty column and places a
			// bulk-install button at the far edge of every card section.
			const groupId = hasGroup ? item.group!.id : UNGROUPED_ITEMS_KEY
			const groupName = hasGroup ? item.group!.name : ""
			const groupDescription = hasGroup ? item.group?.description : undefined
			const groupOrder = hasGroup ? item.group?.order ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
			const existing = groups.get(groupId)
			const isInstalled =
				!!installedMetadata?.project?.[item.id] || !!installedMetadata?.global?.[item.id]

			if (existing) {
				existing.items.push(item)
				if (!isInstalled) {
					existing.remainingItems.push(item)
				}
				continue
			}

			groups.set(groupId, {
				key: groupId,
				name: groupName,
				description: groupDescription,
				order: groupOrder,
				items: [item],
				remainingItems: isInstalled ? [] : [item],
			})
		}

		return Array.from(groups.values()).sort((a, b) => {
			if (a.key === UNGROUPED_ITEMS_KEY) return 1
			if (b.key === UNGROUPED_ITEMS_KEY) return -1
			if (a.order !== b.order) {
				return a.order - b.order
			}
			return a.name.localeCompare(b.name)
		})
	}, [filterByType, installedMetadata, items])

	// Compute statistics
	const installedCount = items.filter((item) => {
		return !!installedMetadata?.project?.[item.id] || !!installedMetadata?.global?.[item.id]
	}).length
	const availableCount = items.length - installedCount

	return (
		<>
			<div className="mb-4">
				<div className="relative">
					<Input
						type="text"
						placeholder={
							filterByType === "mcp"
								? t("marketplace:filters.search.placeholderMcp")
								: filterByType === "mode"
									? t("marketplace:filters.search.placeholderMode")
									: filterByType === "skill"
										? "Search skills..."
										: filterByType === "knowledge"
											? "Search knowledge..."
											: t("marketplace:filters.search.placeholder")
						}
						value={state.filters.search}
						onChange={(e) =>
							manager.transition({
								type: "UPDATE_FILTERS",
								payload: { filters: { search: e.target.value } },
							})
						}
					/>
				</div>
				<div className="mt-2 flex gap-2">
					<Select
						value={state.filters.installed}
						onValueChange={(value: "all" | "installed" | "not_installed") =>
							manager.transition({
								type: "UPDATE_FILTERS",
								payload: { filters: { installed: value } },
							})
						}>
						<SelectTrigger className="flex-1 h-7">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("marketplace:filters.installed.all")}</SelectItem>
							<SelectItem value="installed">{t("marketplace:filters.installed.installed")}</SelectItem>
							<SelectItem value="not_installed">
								{t("marketplace:filters.installed.notInstalled")}
							</SelectItem>
						</SelectContent>
					</Select>
					{allTags.length > 0 && (
						<div className="flex-1">
							<Popover open={isTagPopoverOpen} onOpenChange={(open) => setIsTagPopoverOpen(open)}>
								<PopoverTrigger asChild>
									<Button
										variant="combobox"
										role="combobox"
										aria-expanded={isTagPopoverOpen}
										className="w-full justify-between h-7">
										<span className="truncate">
											{state.filters.tags.length > 0
												? state.filters.tags
														.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1))
														.join(", ")
												: t("marketplace:filters.tags.label")}
										</span>
										<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent
									className="w-[var(--radix-popover-trigger-width)] p-0"
									onClick={(e) => e.stopPropagation()}>
									<Command>
										<div className="relative">
											<CommandInput
												className="h-9 pr-8"
												placeholder={t("marketplace:filters.tags.placeholder")}
												value={tagSearch}
												onValueChange={setTagSearch}
											/>
											{tagSearch && (
												<Button
													variant="ghost"
													size="icon"
													className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
													onClick={() => setTagSearch("")}>
													<X className="h-4 w-4" />
												</Button>
											)}
										</div>
										<CommandList className="max-h-[200px] overflow-y-auto bg-vscode-dropdown-background divide-y divide-vscode-panel-border">
											<CommandEmpty className="p-2 text-sm text-vscode-descriptionForeground">
												{t("marketplace:filters.tags.noResults")}
											</CommandEmpty>
											<CommandGroup>
												{filteredTags.map((tag: string) => (
													<CommandItem
														key={tag}
														value={tag}
														onSelect={() => {
															const isSelected = state.filters.tags.includes(tag)
															manager.transition({
																type: "UPDATE_FILTERS",
																payload: {
																	filters: {
																		tags: isSelected
																			? state.filters.tags.filter(
																					(t) => t !== tag,
																				)
																			: [...state.filters.tags, tag],
																	},
																},
															})
														}}
														data-selected={state.filters.tags.includes(tag)}
														className="grid grid-cols-[1rem_1fr] gap-2 cursor-pointer text-sm capitalize"
														onMouseDown={(e) => {
															e.stopPropagation()
															e.preventDefault()
														}}>
														{state.filters.tags.includes(tag) ? (
															<span className="codicon codicon-check" />
														) : (
															<span />
														)}
														{tag}
													</CommandItem>
												))}
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
					)}
				</div>
				{state.filters.tags.length > 0 && (
					<div className="text-xs text-vscode-descriptionForeground mt-2 flex items-center justify-between">
						<div className="flex items-center">
							<span className="codicon codicon-tag mr-1"></span>
							{t("marketplace:filters.tags.selected")}
						</div>
						<Button
							className="shadow-none font-normal flex items-center gap-1 h-auto py-0.5 px-1.5 text-xs"
							size="sm"
							variant="secondary"
							onClick={(e) => {
								e.stopPropagation()
								manager.transition({
									type: "UPDATE_FILTERS",
									payload: { filters: { tags: [] } },
								})
							}}>
							<span className="codicon codicon-close"></span>
							{t("marketplace:filters.tags.clear")}
						</Button>
					</div>
				)}
			</div>

			{state.isFetching && isEmpty && (
				<div className="flex flex-col items-center justify-center py-12">
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-vscode-focusBorder border-t-transparent" />
					<span className="mt-3 text-xs text-vscode-descriptionForeground">{t("marketplace:items.refresh.refreshing")}</span>
				</div>
			)}

			{!state.isFetching && isEmpty && (
				<div className="flex flex-col items-center justify-center px-6 py-12 text-center">
					<div className="mb-4 text-4xl opacity-40">📦</div>
					<h3 className="mb-2 text-sm font-semibold text-vscode-foreground">{t("marketplace:items.empty.noItems")}</h3>
					<p className="max-w-sm text-xs leading-relaxed text-vscode-descriptionForeground">
						{t("marketplace:items.empty.adjustFilters")}
					</p>
					<div className="mt-4 space-y-2 text-left text-xs text-vscode-descriptionForeground">
						<div className="flex items-start gap-2">
							<span className="mt-0.5 shrink-0 text-[#7c3aed]">1.</span>
							<span>Try adjusting your search keywords</span>
						</div>
						<div className="flex items-start gap-2">
							<span className="mt-0.5 shrink-0 text-[#7c3aed]">2.</span>
							<span>Clear active tag filters</span>
						</div>
						<div className="flex items-start gap-2">
							<span className="mt-0.5 shrink-0 text-[#7c3aed]">3.</span>
							<span>Switch to a different category tab (MCP, Modes, or Skills)</span>
						</div>
					</div>
					<Button
						onClick={() =>
							manager.transition({
								type: "UPDATE_FILTERS",
								payload: { filters: { search: "", type: "", tags: [], installed: "all" } },
							})
						}
						className="mt-4 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground transition-colors">
						<span className="codicon codicon-clear-all mr-2"></span>
						{t("marketplace:items.empty.clearAllFilters")}
					</Button>
				</div>
			)}

			{!state.isFetching && !isEmpty && (
				<div className="pb-3">
					{/* Statistics Summary Bar - Cyber/tech style with emoji */}
					<div className="mb-3 flex items-center gap-4 text-xs text-vscode-descriptionForeground">
						<div className="flex items-center gap-1.5">
							<span className="text-[10px]">✅</span>
							<span style={{ color: "#00FF9C" }}>{installedCount}</span>
							<span>Installed</span>
						</div>
						<div className="flex items-center gap-1.5">
							<span className="text-[10px]">🟡</span>
							<span style={{ color: "#FFD060" }}>{availableCount}</span>
							<span>Available</span>
						</div>
						<div className="flex items-center gap-1.5">
							<span className="text-[10px]">⚡</span>
							<span style={{ color: "#00E5FF" }}>{items.length + orgMcps.length}</span>
							<span>Total</span>
						</div>
					</div>

					{orgMcps.length > 0 && (
						<div className="mb-6">
							<div className="flex items-center gap-2 mb-3 px-1">
								<span className="text-base">🏢</span>
								<h3 className="text-sm font-semibold text-vscode-foreground">
									{t("marketplace:sections.organizationMcps", {
										organization: cloudUserInfo?.organizationName,
									})}
								</h3>
								<div className="flex-1 h-px bg-vscode-input-border"></div>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
								{orgMcps.map((item) => (
									<MarketplaceItemCard
										key={`org-${item.id}`}
										item={item}
										filters={state.filters}
										setFilters={(filters) =>
											manager.transition({
												type: "UPDATE_FILTERS",
												payload: { filters },
											})
										}
										installed={{
											project: installedMetadata?.project?.[item.id],
											global: installedMetadata?.global?.[item.id],
										}}
									/>
								))}
							</div>
						</div>
					)}

					{items.length > 0 && (
						<div>
							{orgMcps.length > 0 && (
								<div className="flex items-center gap-2 mb-3 px-1">
									<span className="text-base">🌐</span>
									<h3 className="text-sm font-semibold text-vscode-foreground">
										{t("marketplace:sections.marketplace")}
									</h3>
									<div className="flex-1 h-px bg-vscode-input-border"></div>
								</div>
							)}
							{filterByType === "skill" || filterByType === "knowledge" ? (
								<div className="space-y-5">
									{itemGroups.map((group) => (
											<div key={group.key} className="space-y-3">
													{group.key !== UNGROUPED_ITEMS_KEY && (
														<div className="flex flex-wrap items-start justify-between gap-3 px-1">
															<div>
																<h3 className="text-base font-semibold text-vscode-foreground">{group.name}</h3>
																<div className="text-sm text-vscode-descriptionForeground">
																	{group.description || t("marketplace:sections.skillsGroupCount", { count: group.items.length })}
																</div>
															</div>
															{group.remainingItems.length > 0 && (
																<Button
																	size="sm"
																	variant="primary"
																	className="h-7 px-3 text-xs"
																	onClick={() =>
																		setBulkInstallGroup({
																			name: group.name,
																			items: group.remainingItems,
																		})
																	}>
																	{group.remainingItems.length === group.items.length
																		? t("marketplace:items.card.installAll")
																		: t("marketplace:items.card.installRemaining", {
																					count: group.remainingItems.length,
																			})}
																</Button>
															)}
														</div>
													)}
											<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
												{group.items.map((item) => (
													<MarketplaceItemCard
														key={item.id}
														item={item}
														filters={state.filters}
														setFilters={(filters) =>
															manager.transition({
																type: "UPDATE_FILTERS",
																payload: { filters },
															})
														}
														installed={{
															project: installedMetadata?.project?.[item.id],
															global: installedMetadata?.global?.[item.id],
														}}
													/>
												))}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
									{items.map((item) => (
										<MarketplaceItemCard
											key={item.id}
											item={item}
											filters={state.filters}
											setFilters={(filters) =>
												manager.transition({
													type: "UPDATE_FILTERS",
													payload: { filters },
												})
											}
											installed={{
												project: installedMetadata?.project?.[item.id],
												global: installedMetadata?.global?.[item.id],
											}}
										/>
									))}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<MarketplaceBulkInstallModal
				groupName={bulkInstallGroup?.name || ""}
				items={bulkInstallGroup?.items || []}
				isOpen={!!bulkInstallGroup}
				onClose={() => setBulkInstallGroup(null)}
				hasWorkspace={!!cwd}
			/>

			<IssueFooter />
		</>
	)
}
