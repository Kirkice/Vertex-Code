import React, { useEffect, useMemo, useState } from "react"
import { MarketplaceItem } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface MarketplaceBulkInstallModalProps {
	groupName: string
	items: MarketplaceItem[]
	isOpen: boolean
	onClose: () => void
	hasWorkspace: boolean
}

export const MarketplaceBulkInstallModal: React.FC<MarketplaceBulkInstallModalProps> = ({
	groupName,
	items,
	isOpen,
	onClose,
	hasWorkspace,
}) => {
	const { t } = useAppTranslation()
	const [scope, setScope] = useState<"project" | "global">(hasWorkspace ? "project" : "global")
	const [installResult, setInstallResult] = useState<{ installed: number; skipped: number } | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (isOpen) {
			setScope(hasWorkspace ? "project" : "global")
			setInstallResult(null)
			setError(null)
		}
	}, [hasWorkspace, isOpen])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type !== "marketplaceBulkInstallResult") {
				return
			}

			if (message.success) {
				const installed = Number(message.values?.installedIds?.length ?? 0)
				const skipped = Number(message.values?.skippedIds?.length ?? 0)
				setInstallResult({ installed, skipped })
				setError(null)

				vscode.postMessage({
					type: "fetchMarketplaceData",
				})
			} else {
				setError(message.error || "Installation failed")
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const itemCount = items.length
	const installButtonLabel = useMemo(() => t("marketplace:bulkInstall.button"), [t])

	const handleInstall = () => {
		setError(null)
		vscode.postMessage({
			type: "installMarketplaceItems",
			mpItems: items,
			mpInstallOptions: {
				target: scope,
			},
		})
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{installResult
							? t("marketplace:bulkInstall.successTitle", { name: groupName })
							: t("marketplace:bulkInstall.title", { name: groupName })}
					</DialogTitle>
					<DialogDescription>
						{installResult
							? t("marketplace:bulkInstall.successDescription", {
									installed: installResult.installed,
									skipped: installResult.skipped,
								})
							: t("marketplace:bulkInstall.description", { count: itemCount })}
					</DialogDescription>
				</DialogHeader>

				{installResult ? (
					<div className="py-2 text-center text-green-500">{t("marketplace:bulkInstall.installed")}</div>
				) : (
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<div className="text-base font-semibold">{t("marketplace:bulkInstall.scope")}</div>
							<div className="space-y-2">
								<label className="flex items-center space-x-2">
									<input
										type="radio"
										name="bulk-scope"
										value="project"
										checked={scope === "project"}
										onChange={() => setScope("project")}
										disabled={!hasWorkspace}
										className="rounded-full"
									/>
									<span className={!hasWorkspace ? "opacity-50" : ""}>
										{t("marketplace:install.project")}
									</span>
								</label>
								<label className="flex items-center space-x-2">
									<input
										type="radio"
										name="bulk-scope"
										value="global"
										checked={scope === "global"}
										onChange={() => setScope("global")}
										className="rounded-full"
									/>
									<span>{t("marketplace:install.global")}</span>
								</label>
							</div>
						</div>

						{error && <div className="text-sm text-vscode-errorForeground">{error}</div>}
					</div>
				)}

				<DialogFooter>
					{installResult ? (
						<Button onClick={onClose}>{t("marketplace:bulkInstall.done")}</Button>
					) : (
						<>
							<Button variant="secondary" onClick={onClose}>
								{t("marketplace:removeConfirm.cancel")}
							</Button>
							<Button onClick={handleInstall}>{installButtonLabel}</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
