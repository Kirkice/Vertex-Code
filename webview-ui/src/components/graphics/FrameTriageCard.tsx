/**
 * Frame Triage Card Component
 *
 * Displays frame analysis results in a structured card format.
 * Shows pass breakdown, hot events, and performance assessment.
 *
 * @module components/graphics/FrameTriageCard
 */

import React from "react"
import type {
	FrameSummaryResult,
	HotEventSummary,
	PassSummary,
} from "@roo-code/types"

/**
 * Props for FrameTriageCard
 */
interface FrameTriageCardProps {
	/** Frame summary data */
	frameSummary: FrameSummaryResult
	/** Optional API type (D3D12, Vulkan, etc.) */
	apiType?: string
	/** Callback when a hot event is clicked */
	onEventClick?: (eventId: number) => void
	/** Callback when a pass is clicked */
	onPassClick?: (passName: string) => void
}

/**
 * FrameTriageCard component
 */
export const FrameTriageCard: React.FC<FrameTriageCardProps> = ({
	frameSummary,
	apiType,
	onEventClick,
	onPassClick,
}) => {
	if (!frameSummary.success) {
		return (
			<div className="frame-triage-card error">
				<h3>📊 Frame Triage</h3>
				<p className="error-message">{frameSummary.error || "无法获取帧数据"}</p>
			</div>
		)
	}

	const frameTime = frameSummary.totalDurationMs
	const fps = frameTime ? Math.round(1000 / frameTime) : null
	const performanceClass = getPerformanceClass(frameTime)

	return (
		<div className="frame-triage-card">
			{/* Header */}
			<div className="frame-triage-card__header">
				<h3>📊 Frame Triage</h3>
				{apiType && <span className="api-badge">{apiType}</span>}
			</div>

			{/* Frame Timing */}
			<div className="frame-triage-card__timing">
				<div className={`timing-value ${performanceClass}`}>
					{frameTime ? `${frameTime.toFixed(2)} ms` : "N/A"}
				</div>
				{fps && (
					<div className="timing-fps">
						{fps} FPS
					</div>
				)}
				<div className="timing-targets">
					<span className={frameTime && frameTime <= 16.67 ? "target-met" : "target-missed"}>
						60 FPS: 16.67ms
					</span>
					<span className={frameTime && frameTime <= 33.33 ? "target-met" : "target-missed"}>
						30 FPS: 33.33ms
					</span>
				</div>
			</div>

			{/* Pass Breakdown */}
			{frameSummary.passes && frameSummary.passes.length > 0 && (
				<div className="frame-triage-card__passes">
					<h4>Render Passes ({frameSummary.passes.length})</h4>
					<div className="pass-list">
						{frameSummary.passes.slice(0, 10).map((pass, i) => (
							<PassRow
								key={i}
								pass={pass}
								totalDuration={frameTime}
								onClick={onPassClick}
							/>
						))}
						{frameSummary.passes.length > 10 && (
							<div className="pass-more">
								... 还有 {frameSummary.passes.length - 10} 个 pass
							</div>
						)}
					</div>
				</div>
			)}

			{/* Hot Events */}
			{frameSummary.hotEvents && frameSummary.hotEvents.length > 0 && (
				<div className="frame-triage-card__hot-events">
					<h4>Hot Events ({frameSummary.hotEvents.length})</h4>
					<div className="event-list">
						{frameSummary.hotEvents.slice(0, 5).map((event, i) => (
							<EventRow
								key={i}
								event={event}
								totalDuration={frameTime}
								onClick={onEventClick}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

/**
 * Pass row sub-component
 */
interface PassRowProps {
	pass: PassSummary
	totalDuration?: number
	onClick?: (passName: string) => void
}

const PassRow: React.FC<PassRowProps> = ({ pass, totalDuration, onClick }) => {
	const percentage = totalDuration && pass.durationMs
		? (pass.durationMs / totalDuration) * 100
		: null

	return (
		<div
			className="pass-row"
			onClick={() => onClick?.(pass.name)}
			role={onClick ? "button" : undefined}
		>
			<span className="pass-name">{pass.name}</span>
			{pass.durationMs !== undefined && (
				<span className="pass-duration">
					{pass.durationMs.toFixed(2)} ms
					{percentage !== null && (
						<span className="pass-percentage">({percentage.toFixed(1)}%)</span>
					)}
				</span>
			)}
			{pass.drawCount !== undefined && (
				<span className="pass-draws">{pass.drawCount} draws</span>
			)}
			{percentage !== null && (
				<div className="pass-bar">
					<div
						className="pass-bar__fill"
						style={{ width: `${Math.min(percentage, 100)}%` }}
					/>
				</div>
			)}
		</div>
	)
}

/**
 * Event row sub-component
 */
interface EventRowProps {
	event: HotEventSummary
	totalDuration?: number
	onClick?: (eventId: number) => void
}

const EventRow: React.FC<EventRowProps> = ({ event, totalDuration, onClick }) => {
	const percentage = totalDuration
		? (event.durationMs / totalDuration) * 100
		: null

	return (
		<div
			className="event-row"
			onClick={() => onClick?.(event.eventId)}
			role={onClick ? "button" : undefined}
		>
			<span className="event-id">EID {event.eventId}</span>
			<span className="event-name">{event.name}</span>
			<span className="event-duration">{event.durationMs.toFixed(2)} ms</span>
			{percentage !== null && (
				<span className="event-percentage">({percentage.toFixed(1)}%)</span>
			)}
			{event.passName && (
				<span className="event-pass">{event.passName}</span>
			)}
		</div>
	)
}

/**
 * Get CSS class based on frame performance
 */
function getPerformanceClass(frameTime?: number): string {
	if (!frameTime) return "unknown"
	if (frameTime <= 16.67) return "good"
	if (frameTime <= 33.33) return "warning"
	return "critical"
}

export default FrameTriageCard
