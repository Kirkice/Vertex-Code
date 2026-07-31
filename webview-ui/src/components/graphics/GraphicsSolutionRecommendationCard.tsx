import type { GraphicsSolutionRecommendation } from "@roo-code/types"
import { Lightbulb, LoaderCircle, TriangleAlert } from "lucide-react"

import { useAppTranslation } from "@src/i18n/TranslationContext"

interface GraphicsSolutionRecommendationCardProps {
	recommendation: GraphicsSolutionRecommendation | null
	loading: boolean
}

export const GraphicsSolutionRecommendationCard = ({
	recommendation,
	loading,
}: GraphicsSolutionRecommendationCardProps) => {
	const { t } = useAppTranslation()

	return (
		<section
			className="space-y-3 rounded-lg border border-vscode-panel-border p-4"
			aria-label={t("graphics:recommendation.ariaLabel")}>
			<div className="flex items-start gap-3">
				<Lightbulb className="mt-0.5 size-4 text-vscode-focusBorder" aria-hidden="true" />
				<div>
					<h3 className="text-sm font-semibold text-vscode-foreground">
						{t("graphics:recommendation.title")}
					</h3>
					<p className="mt-1 text-xs text-vscode-descriptionForeground">
						{t("graphics:recommendation.description")}
					</p>
				</div>
			</div>

			{loading ? (
				<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground" role="status">
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					{t("graphics:recommendation.loading")}
				</div>
			) : recommendation ? (
				<>
					<div className="rounded-md border border-vscode-focusBorder/40 bg-vscode-focusBorder/10 p-3">
						<div className="text-xs font-semibold text-vscode-foreground">
							{t("graphics:recommendation.recommended", { label: recommendation.candidates[0]?.label })}
						</div>
						<p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">
							{recommendation.summary}
						</p>
					</div>
					<div className="space-y-2">
						{recommendation.candidates.slice(0, 3).map((candidate, index) => (
							<div
								key={candidate.level}
								className="rounded-md border border-vscode-panel-border p-3 text-xs">
								<div className="flex items-center justify-between gap-3">
									<span className="font-medium text-vscode-foreground">
										{index + 1}. {candidate.label}
									</span>
									<span className="text-vscode-descriptionForeground">
										{t("graphics:recommendation.score", {
											score: candidate.score,
											confidence: candidate.confidence,
										})}
									</span>
								</div>
								{candidate.reasons[0] && (
									<p className="mt-1 leading-relaxed text-vscode-descriptionForeground">
										{candidate.reasons[0]}
									</p>
								)}
								{candidate.rejectionReasons[0] && index > 0 && (
									<p className="mt-1 leading-relaxed text-vscode-descriptionForeground">
										{t("graphics:recommendation.notSelected", {
											reason: candidate.rejectionReasons[0],
										})}
									</p>
								)}
							</div>
						))}
					</div>
					{recommendation.assumptions.length > 0 && (
						<div className="flex items-start gap-2 rounded-md border border-vscode-inputValidation-warningBorder p-3 text-xs text-vscode-descriptionForeground">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<span>{recommendation.assumptions.join(" ")}</span>
						</div>
					)}
				</>
			) : (
				<p className="text-xs text-vscode-descriptionForeground">{t("graphics:recommendation.empty")}</p>
			)}
		</section>
	)
}
