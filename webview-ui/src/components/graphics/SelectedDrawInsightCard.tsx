/**
 * Selected Draw Insight Card Component
 *
 * Displays detailed analysis of a selected draw call.
 * Shows event details, pipeline state, shader info, and suspected issues.
 *
 * @module components/graphics/SelectedDrawInsightCard
 */

import React from "react"
import type {
	EventDetailsResult,
	PipelineStateResult,
	ShaderInfoResult,
	SelectionContextResult,
	SuspectedIssue,
} from "@roo-code/types"

/**
 * Props for SelectedDrawInsightCard
 */
interface SelectedDrawInsightCardProps {
	/** Selection context */
	selection?: SelectionContextResult
	/** Event details */
	eventDetails?: EventDetailsResult
	/** Pipeline state */
	pipelineState?: PipelineStateResult
	/** Shader info */
	shaderInfo?: ShaderInfoResult
	/** Suspected issues */
	suspectedIssues?: SuspectedIssue[]
	/** Suggestions */
	suggestions?: string[]
	/** Callback when event ID is clicked */
	onEventClick?: (eventId: number) => void
}

/**
 * SelectedDrawInsightCard component
 */
export const SelectedDrawInsightCard: React.FC<SelectedDrawInsightCardProps> = ({
	selection,
	eventDetails,
	pipelineState,
	shaderInfo,
	suspectedIssues = [],
	suggestions = [],
	onEventClick,
}) => {
	const eventId = selection?.eventId ?? eventDetails?.eventId

	return (
		<div className="selected-draw-insight-card">
			{/* Header */}
			<div className="selected-draw-insight-card__header">
				<h3>🔍 Selected Draw Insight</h3>
				{eventId !== undefined && (
					<span
						className="event-id-badge"
						onClick={() => onEventClick?.(eventId)}
						role={onEventClick ? "button" : undefined}
					>
						EID {eventId}
					</span>
				)}
			</div>

			{/* Selection Context */}
			{selection?.success && (
				<div className="selected-draw-insight-card__selection">
					<h4>Selection</h4>
					<div className="info-grid">
						{selection.eventName && (
							<div className="info-item">
								<span className="info-label">Name:</span>
								<span className="info-value">{selection.eventName}</span>
							</div>
						)}
						{selection.passName && (
							<div className="info-item">
								<span className="info-label">Pass:</span>
								<span className="info-value">{selection.passName}</span>
							</div>
						)}
						{selection.drawType && (
							<div className="info-item">
								<span className="info-label">Type:</span>
								<span className="info-value">{selection.drawType}</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Event Details */}
			{eventDetails?.success && (
				<div className="selected-draw-insight-card__event">
					<h4>Event Details</h4>
					<div className="info-grid">
						{eventDetails.durationMs !== undefined && (
							<div className="info-item">
								<span className="info-label">Duration:</span>
								<span className="info-value highlight">
									{eventDetails.durationMs.toFixed(3)} ms
								</span>
							</div>
						)}
						{eventDetails.primitiveCount !== undefined && (
							<div className="info-item">
								<span className="info-label">Primitives:</span>
								<span className="info-value">
									{eventDetails.primitiveCount.toLocaleString()}
								</span>
							</div>
						)}
						{eventDetails.drawCallCount !== undefined && (
							<div className="info-item">
								<span className="info-label">Draw Calls:</span>
								<span className="info-value">{eventDetails.drawCallCount}</span>
							</div>
						)}
						{eventDetails.shaderStages && eventDetails.shaderStages.length > 0 && (
							<div className="info-item">
								<span className="info-label">Shader Stages:</span>
								<span className="info-value">
									{eventDetails.shaderStages.join(", ")}
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Pipeline State */}
			{pipelineState?.success && (
				<div className="selected-draw-insight-card__pipeline">
					<h4>Pipeline State</h4>
					<div className="info-grid">
						{pipelineState.renderTargets && pipelineState.renderTargets.length > 0 && (
							<div className="info-item">
								<span className="info-label">Render Targets:</span>
								<span className="info-value">
									{pipelineState.renderTargets.length} bound
								</span>
							</div>
						)}
						<div className="info-item">
							<span className="info-label">Depth/Stencil:</span>
							<span className="info-value">
								{pipelineState.depthStencil ? "Bound" : "None"}
							</span>
						</div>
						{pipelineState.vertexBuffers && pipelineState.vertexBuffers.length > 0 && (
							<div className="info-item">
								<span className="info-label">Vertex Buffers:</span>
								<span className="info-value">
									{pipelineState.vertexBuffers.length} bound
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Shader Info */}
			{shaderInfo?.success && (
				<div className="selected-draw-insight-card__shader">
					<h4>Shader Info</h4>
					<div className="info-grid">
						{shaderInfo.entryPoint && (
							<div className="info-item">
								<span className="info-label">Entry Point:</span>
								<span className="info-value code">{shaderInfo.entryPoint}</span>
							</div>
						)}
						{shaderInfo.language && (
							<div className="info-item">
								<span className="info-label">Language:</span>
								<span className="info-value">{shaderInfo.language}</span>
							</div>
						)}
						{shaderInfo.instructionCount !== undefined && (
							<div className="info-item">
								<span className="info-label">Instructions:</span>
								<span
									className={`info-value ${
										shaderInfo.instructionCount > 500 ? "warning" : ""
									}`}
								>
									{shaderInfo.instructionCount}
								</span>
							</div>
						)}
						{shaderInfo.constantBuffers && shaderInfo.constantBuffers.length > 0 && (
							<div className="info-item">
								<span className="info-label">Constant Buffers:</span>
								<span className="info-value">
									{shaderInfo.constantBuffers.length}
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Suspected Issues */}
			{suspectedIssues.length > 0 && (
				<div className="selected-draw-insight-card__issues">
					<h4>Suspected Issues</h4>
					<ul className="issue-list">
						{suspectedIssues.map((issue, i) => (
							<li key={i} className={`issue-item confidence-${issue.confidence}`}>
								<span className="confidence-badge">{issue.confidence}</span>
								<span className="category-badge">{issue.category}</span>
								<span className="issue-description">{issue.description}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Suggestions */}
			{suggestions.length > 0 && (
				<div className="selected-draw-insight-card__suggestions">
					<h4>Suggestions</h4>
					<ul className="suggestion-list">
						{suggestions.map((s, i) => (
							<li key={i}>{s}</li>
						))}
					</ul>
				</div>
			)}

			{/* No Data State */}
			{!selection?.success && !eventDetails?.success && (
				<div className="selected-draw-insight-card__empty">
					<p>No draw call selected. Select a draw in the Event Browser to see details.</p>
				</div>
			)}
		</div>
	)
}

export default SelectedDrawInsightCard
