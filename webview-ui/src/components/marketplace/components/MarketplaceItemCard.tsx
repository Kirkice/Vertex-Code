import React, { useMemo, useState, useEffect } from "react"
import { MarketplaceItem, TelemetryEventName } from "@roo-code/types"
import { vscode } from "@/utils/vscode"
import { telemetryClient } from "@/utils/TelemetryClient"
import { ViewState } from "../MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { isValidUrl } from "../../../utils/url"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StandardTooltip } from "@/components/ui"
import { MarketplaceInstallModal } from "./MarketplaceInstallModal"
import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui"

interface ItemInstalledMetadata {
	type: string
}

interface MarketplaceItemCardProps {
	item: MarketplaceItem
	filters: ViewState["filters"]
	setFilters: (filters: Partial<ViewState["filters"]>) => void
	installed: {
		project: ItemInstalledMetadata | undefined
		global: ItemInstalledMetadata | undefined
	}
}

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({ item, filters, setFilters, installed }) => {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()
	const [showInstallModal, setShowInstallModal] = useState(false)
	const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
	const [removeTarget, setRemoveTarget] = useState<"project" | "global">("project")
	const [removeError, setRemoveError] = useState<string | null>(null)

	// Listen for removal result messages
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "marketplaceRemoveResult" && message.slug === item.id) {
				if (message.success) {
					// Removal succeeded - refresh marketplace data
					vscode.postMessage({
						type: "fetchMarketplaceData",
					})
				} else {
					// Removal failed - show error message to user
					setRemoveError(message.error || t("marketplace:items.unknownError"))
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [item.id, t])

	const typeLabel = useMemo(() => {
		const labels: Partial<Record<MarketplaceItem["type"], string>> = {
			mode: t("marketplace:filters.type.mode"),
			mcp: t("marketplace:filters.type.mcpServer"),
			skill: "Skill",
			knowledge: "Knowledge",
		}
		return labels[item.type] ?? "N/A"
	}, [item.type, t])

	// Determine installation status
	const isInstalledGlobally = !!installed.global
	const isInstalledInProject = !!installed.project
	const isInstalled = isInstalledGlobally || isInstalledInProject

	const handleInstallClick = () => {
		// Send telemetry for install button click
		telemetryClient.capture(TelemetryEventName.MARKETPLACE_INSTALL_BUTTON_CLICKED, {
			itemId: item.id,
			itemType: item.type,
			itemName: item.name,
		})

		// Show modal for all item types (MCP and modes)
		setShowInstallModal(true)
	}

	// Determine color based on item type and installation status
	const typeColor = isInstalled
		? item.type === "mcp"
			? "#10b981"
			: item.type === "mode"
				? "#7c3aed"
				: "#3b82f6"
		: "#6b7280"

	return (
		<>
			<div className="relative overflow-hidden rounded-md border border-vscode-panel-border bg-vscode-editor-background transition-colors hover:bg-vscode-editor-foreground/5">
				{/* Left status color bar - Graphics Providers style */}
				<div className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: typeColor }} />

				<div className="pl-4 pr-3 py-3">
					<div className="flex gap-2 items-start justify-between">
						<div className="flex gap-2 items-start min-w-0">
							<div className="min-w-0">
								<h3 className="text-sm font-semibold text-vscode-foreground mt-0 mb-1 leading-none truncate">
									{item.type === "mcp" && item.url && isValidUrl(item.url) ? (
										<Button
											variant="link"
											className="p-0 h-auto text-sm font-semibold text-vscode-foreground hover:underline"
											onClick={() => vscode.postMessage({ type: "openExternal", url: item.url })}>
											{item.name}
										</Button>
									) : (
										item.name
									)}
								</h3>
								<AuthorInfo item={item} typeLabel={typeLabel} />
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							{/* Status Badge - Graphics Providers style */}
							<span
								className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
								style={{
									color: isInstalled ? "#10b981" : "#6b7280",
									backgroundColor: isInstalled ? "#10b98115" : "#6b728015",
									border: `1px solid ${isInstalled ? "#10b98130" : "#6b728030"}`,
								}}>
								<span style={{ fontSize: "10px" }}>●</span>
								{isInstalled ? t("marketplace:items.card.installed") : "Available"}
							</span>

							{isInstalled ? (
								<StandardTooltip
									content={
										isInstalledInProject
											? t("marketplace:items.card.removeProjectTooltip")
											: t("marketplace:items.card.removeGlobalTooltip")
									}>
									<Button
										size="sm"
										variant="secondary"
										className="text-xs h-5 py-0 px-2"
										onClick={() => {
											const target = isInstalledInProject ? "project" : "global"
											setRemoveTarget(target)
											setShowRemoveConfirm(true)
										}}>
										{t("marketplace:items.card.remove")}
									</Button>
								</StandardTooltip>
							) : (
								<Button
									size="sm"
									variant="primary"
									className="text-xs h-5 py-0 px-2"
									onClick={handleInstallClick}>
									{t("marketplace:items.card.install")}
								</Button>
							)}

							{removeError && (
								<div className="text-vscode-errorForeground text-sm mt-2">
									{t("marketplace:items.removeFailed", { error: removeError })}
								</div>
							)}
						</div>
					</div>

					<p className="my-2 text-xs text-vscode-foreground leading-relaxed">{item.description}</p>

					{/* Tags - CapabilityChip style */}
					{item.tags && item.tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-2">
							{item.tags.map((tag) => {
								const isActive = filters.tags.includes(tag)
								return (
									<StandardTooltip
										key={tag}
										content={
											isActive
												? t("marketplace:filters.tags.clear", { count: tag })
												: t("marketplace:filters.tags.clickToFilter")
										}>
										<button
											className={cn(
												"inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
												isActive
													? "border border-[#10b98130] bg-[#10b98115] text-[#10b981]"
													: "border border-[#6b728030] bg-transparent text-[#6b7280] hover:border-[#10b98130] hover:text-[#10b981]",
											)}
											onClick={() => {
												const newTags = isActive
													? filters.tags.filter((t: string) => t !== tag)
													: [...filters.tags, tag]
												setFilters({ tags: newTags })
											}}>
											{tag}
										</button>
									</StandardTooltip>
								)
							})}
						</div>
					)}
				</div>
			</div>

			{/* Installation Modal - Outside the clickable card */}
			<MarketplaceInstallModal
				item={item}
				isOpen={showInstallModal}
				onClose={() => setShowInstallModal(false)}
				hasWorkspace={!!cwd}
			/>

			{/* Remove Confirmation Dialog */}
			<AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{item.type === "mode"
								? t("marketplace:removeConfirm.mode.title")
								: item.type === "skill"
									? t("marketplace:removeConfirm.skill.title")
									: item.type === "knowledge"
										? t("marketplace:removeConfirm.knowledge.title")
										: t("marketplace:removeConfirm.mcp.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{item.type === "mode" ? (
								<>
									{t("marketplace:removeConfirm.mode.message", { modeName: item.name })}
									<div className="mt-2 text-sm">
										{t("marketplace:removeConfirm.mode.rulesWarning")}
									</div>
								</>
							) : item.type === "skill" ? (
								t("marketplace:removeConfirm.skill.message", { skillName: item.name })
							) : item.type === "knowledge" ? (
								t("marketplace:removeConfirm.knowledge.message", { knowledgeName: item.name })
							) : (
								t("marketplace:removeConfirm.mcp.message", { mcpName: item.name })
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("marketplace:removeConfirm.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								// Clear any previous error
								setRemoveError(null)

								vscode.postMessage({
									type: "removeInstalledMarketplaceItem",
									mpItem: item,
									mpInstallOptions: { target: removeTarget },
								})

								setShowRemoveConfirm(false)
							}}>
							{t("marketplace:removeConfirm.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

interface AuthorInfoProps {
	item: MarketplaceItem
	typeLabel: string
}

const AuthorInfo: React.FC<AuthorInfoProps> = ({ item, typeLabel }) => {
	const { t } = useAppTranslation()

	const handleOpenAuthorUrl = () => {
		if (item.authorUrl && isValidUrl(item.authorUrl)) {
			vscode.postMessage({ type: "openExternal", url: item.authorUrl })
		}
	}

	if (item.author) {
		return (
			<p className="text-sm text-vscode-descriptionForeground my-0">
				{typeLabel}{" "}
				{item.authorUrl && isValidUrl(item.authorUrl) ? (
					<Button
						variant="link"
						className="p-0 h-auto text-sm text-vscode-textLink hover:underline"
						onClick={handleOpenAuthorUrl}>
						{t("marketplace:items.card.by", { author: item.author })}
					</Button>
				) : (
					t("marketplace:items.card.by", { author: item.author })
				)}
			</p>
		)
	}
	return null
}
