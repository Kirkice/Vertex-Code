import type { GraphicsSolutionRecommendation } from "@roo-code/types"
import { Lightbulb, LoaderCircle, TriangleAlert } from "lucide-react"

interface GraphicsSolutionRecommendationCardProps {
	recommendation: GraphicsSolutionRecommendation | null
	loading: boolean
}

export const GraphicsSolutionRecommendationCard = ({
	recommendation,
	loading,
}: GraphicsSolutionRecommendationCardProps) => (
	<section
		className="space-y-3 rounded-lg border border-vscode-panel-border p-4"
		aria-label="Solution recommendation">
		<div className="flex items-start gap-3">
			<Lightbulb className="mt-0.5 size-4 text-vscode-focusBorder" />
			<div>
				<h3 className="text-sm font-semibold text-vscode-foreground">Implementation recommendation</h3>
				<p className="mt-1 text-xs text-vscode-descriptionForeground">
					Compare implementation levels using the current brief and source-backed project architecture.
				</p>
			</div>
		</div>

		{loading ? (
			<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground">
				<LoaderCircle className="size-4 animate-spin" />
				Evaluating implementation levels…
			</div>
		) : recommendation ? (
			<>
				<div className="rounded-md border border-vscode-focusBorder/40 bg-vscode-focusBorder/10 p-3">
					<div className="text-xs font-semibold text-vscode-foreground">
						Recommended: {recommendation.candidates[0]?.label}
					</div>
					<p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">
						{recommendation.summary}
					</p>
				</div>
				<div className="space-y-2">
					{recommendation.candidates.slice(0, 3).map((candidate, index) => (
						<div key={candidate.level} className="rounded-md border border-vscode-panel-border p-3 text-xs">
							<div className="flex items-center justify-between gap-3">
								<span className="font-medium text-vscode-foreground">
									{index + 1}. {candidate.label}
								</span>
								<span className="text-vscode-descriptionForeground">
									Score {candidate.score} · {candidate.confidence}
								</span>
							</div>
							{candidate.reasons[0] && (
								<p className="mt-1 leading-relaxed text-vscode-descriptionForeground">
									{candidate.reasons[0]}
								</p>
							)}
							{candidate.rejectionReasons[0] && index > 0 && (
								<p className="mt-1 leading-relaxed text-vscode-descriptionForeground">
									Not selected: {candidate.rejectionReasons[0]}
								</p>
							)}
						</div>
					))}
				</div>
				{recommendation.assumptions.length > 0 && (
					<div className="flex items-start gap-2 rounded-md border border-vscode-inputValidation-warningBorder p-3 text-xs text-vscode-descriptionForeground">
						<TriangleAlert className="mt-0.5 size-4 shrink-0" />
						<span>{recommendation.assumptions.join(" ")}</span>
					</div>
				)}
			</>
		) : (
			<p className="text-xs text-vscode-descriptionForeground">
				Save or edit the Feature Brief, then generate a recommendation before implementation.
			</p>
		)}
	</section>
)
