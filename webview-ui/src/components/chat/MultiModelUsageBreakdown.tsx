import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { MultiModelUsage, UsageBreakdownItem } from "@roo-code/types"

interface MultiModelUsageBreakdownProps {
	usage: MultiModelUsage
}

/**
 * 多模型用量分摊面板。
 *
 * 展示按 Mode / Profile 聚合的成本分摊，以及 Top Cost 指标。
 * 详见 docs/mode-level-llm-routing-implementation-guide.md Phase 5。
 */
const MultiModelUsageBreakdownBase = ({ usage }: MultiModelUsageBreakdownProps) => {
	const { t } = useTranslation()

	const sortedByMode = useMemo(
		() => [...usage.byMode].sort((a, b) => b.totalCost - a.totalCost),
		[usage.byMode],
	)
	const sortedByProfile = useMemo(
		() => [...usage.byProfile].sort((a, b) => b.totalCost - a.totalCost),
		[usage.byProfile],
	)

	const topCostMode = sortedByMode[0]
	const topCostProfile = sortedByProfile[0]

	const formatCost = (cost: number) => `$${cost.toFixed(4)}`
	const formatTokens = (tokens: number) => tokens.toLocaleString()

	return (
		<div className="space-y-3 text-xs">
			{/* Top Cost 指标 */}
			{(topCostMode || topCostProfile) && (
				<div className="flex flex-wrap gap-3">
					{topCostMode && (
						<div className="text-vscode-descriptionForeground">
							{t("chat:multiModel.topCostMode", { defaultValue: "Top cost mode" })}:{" "}
							<span className="text-vscode-foreground font-medium">
								{topCostMode.mode ?? "unknown"} · {formatCost(topCostMode.totalCost)}
							</span>
						</div>
					)}
					{topCostProfile && (
						<div className="text-vscode-descriptionForeground">
							{t("chat:multiModel.topCostProfile", { defaultValue: "Top cost profile" })}:{" "}
							<span className="text-vscode-foreground font-medium">
								{topCostProfile.profile ?? "unknown"} · {formatTokens(topCostProfile.tokensIn + topCostProfile.tokensOut)}{" "}
								tokens
							</span>
						</div>
					)}
				</div>
			)}

			{/* By Mode 分摊表 */}
			{sortedByMode.length > 0 && (
				<div>
					<div className="text-vscode-foreground font-medium mb-1">
						{t("chat:multiModel.byMode", { defaultValue: "By Mode" })}
					</div>
					<table className="w-full text-[0.9em]">
						<thead>
							<tr className="text-vscode-descriptionForeground">
								<th className="text-left font-normal pb-1">Mode</th>
								<th className="text-right font-normal pb-1">Requests</th>
								<th className="text-right font-normal pb-1">Tokens In</th>
								<th className="text-right font-normal pb-1">Tokens Out</th>
								<th className="text-right font-normal pb-1">Cost</th>
							</tr>
						</thead>
						<tbody>
							{sortedByMode.map((item, idx) => (
								<BreakdownRow key={`mode-${idx}`} item={item} labelKey="mode" formatCost={formatCost} formatTokens={formatTokens} />
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* By Profile 分摊表 */}
			{sortedByProfile.length > 0 && (
				<div>
					<div className="text-vscode-foreground font-medium mb-1">
						{t("chat:multiModel.byProfile", { defaultValue: "By Profile" })}
					</div>
					<table className="w-full text-[0.9em]">
						<thead>
							<tr className="text-vscode-descriptionForeground">
								<th className="text-left font-normal pb-1">Profile</th>
								<th className="text-right font-normal pb-1">Requests</th>
								<th className="text-right font-normal pb-1">Tokens In</th>
								<th className="text-right font-normal pb-1">Tokens Out</th>
								<th className="text-right font-normal pb-1">Cost</th>
							</tr>
						</thead>
						<tbody>
							{sortedByProfile.map((item, idx) => (
								<BreakdownRow key={`profile-${idx}`} item={item} labelKey="profile" formatCost={formatCost} formatTokens={formatTokens} />
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

interface BreakdownRowProps {
	item: UsageBreakdownItem
	labelKey: "mode" | "profile"
	formatCost: (cost: number) => string
	formatTokens: (tokens: number) => string
}

const BreakdownRow = ({ item, labelKey, formatCost, formatTokens }: BreakdownRowProps) => {
	const label = item[labelKey] ?? "unknown"
	return (
		<tr className="text-vscode-foreground">
			<td className="py-0.5">{label}</td>
			<td className="text-right py-0.5 font-mono">{item.requestCount}</td>
			<td className="text-right py-0.5 font-mono">{formatTokens(item.tokensIn)}</td>
			<td className="text-right py-0.5 font-mono">{formatTokens(item.tokensOut)}</td>
			<td className="text-right py-0.5 font-mono">{formatCost(item.totalCost)}</td>
		</tr>
	)
}

export const MultiModelUsageBreakdown = memo(MultiModelUsageBreakdownBase)
export default MultiModelUsageBreakdown
