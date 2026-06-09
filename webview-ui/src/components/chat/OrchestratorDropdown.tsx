import React from "react"
import { Settings, Network, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip, ToggleSwitch } from "@/components/ui"

interface OrchestratorDropdownProps {
	disabled?: boolean
	triggerClassName?: string
}

export const OrchestratorDropdown = ({ disabled = false, triggerClassName = "" }: OrchestratorDropdownProps) => {
	const [open, setOpen] = React.useState(false)
	const portalContainer = useRooPortal("roo-portal")
	const { t } = useAppTranslation()
	const { orchestratorEnabled, orchestratorConfig, setOrchestratorEnabled } = useExtensionState()

	const handleOpenSettings = React.useCallback(
		() => window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "orchestrator" } }),
		[],
	)

	const handleToggle = React.useCallback(() => {
		setOrchestratorEnabled(!orchestratorEnabled)
	}, [orchestratorEnabled, setOrchestratorEnabled])

	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="orchestrator-dropdown-root">
			<StandardTooltip content={t("chat:orchestrator.tooltip")}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="orchestrator-dropdown-trigger"
					className={cn(
						"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						"max-[300px]:shrink-0",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					{!orchestratorEnabled ? (
						<X className="size-3 flex-shrink-0" />
					) : (
						<Network className="size-3 flex-shrink-0" />
					)}
					<span className="hidden min-[300px]:inline truncate min-w-0">
						{orchestratorEnabled
							? t("chat:orchestrator.triggerLabelOn")
							: t("chat:orchestrator.triggerLabelOff")}
					</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden w-[min(320px,calc(100vw-2rem))]"
				onOpenAutoFocus={(e) => e.preventDefault()}>
				<div className="flex flex-col w-full">
					{/* Header */}
					<div className="p-3 border-b border-vscode-dropdown-border">
						<div className="flex items-center justify-between gap-1 pr-1 pb-2">
							<h4 className="m-0 font-bold text-base text-vscode-foreground">
								{t("chat:orchestrator.title")}
							</h4>
							<Settings className="inline mb-0.5 mr-1 size-4 cursor-pointer" onClick={handleOpenSettings} />
						</div>
						<p className="m-0 text-xs text-vscode-descriptionForeground">
							{t("chat:orchestrator.description")}
						</p>
					</div>

					{/* Model Info */}
					<div className="p-3 space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-vscode-descriptionForeground">{t("chat:orchestrator.planner")}:</span>
							<span className="text-vscode-foreground font-medium">
								{orchestratorConfig?.plannerProfile || "—"}
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-vscode-descriptionForeground">{t("chat:orchestrator.worker")}:</span>
							<span className="text-vscode-foreground font-medium">
								{orchestratorConfig?.workerProfiles?.primary || "—"}
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-vscode-descriptionForeground">{t("chat:orchestrator.reviewer")}:</span>
							<span className="text-vscode-foreground font-medium">
								{orchestratorConfig?.reviewerProfile || "—"}
							</span>
						</div>
					</div>

					{/* Toggle */}
					<div className="flex flex-row items-center justify-end px-3 py-2 border-t border-vscode-dropdown-border">
						<label
							className="flex items-center gap-2 pr-2 cursor-pointer"
							onClick={(e) => {
								if ((e.target as HTMLElement).closest('[role="switch"]')) {
									e.preventDefault()
									return
								}
								handleToggle()
							}}>
							<ToggleSwitch
								checked={orchestratorEnabled ?? false}
								aria-label="Toggle orchestrator"
								onChange={handleToggle}
							/>
							<span className="text-sm font-bold select-none">Enabled</span>
						</label>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}