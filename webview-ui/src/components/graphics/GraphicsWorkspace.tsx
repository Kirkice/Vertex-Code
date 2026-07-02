/**
 * Graphics Workspace Component
 *
 * Main entry point for graphics analysis features in the Vertex UI.
 * Provides quick access to graphics workflows and displays analysis results.
 *
 * @module components/graphics/GraphicsWorkspace
 */

import React, { useState, useCallback } from "react"
import type {
	GraphicsIntent,
	GraphicsPlaybookId,
	GraphicsWorkflowResult,
} from "@roo-code/types"

/**
 * Props for GraphicsWorkspace component
 */
interface GraphicsWorkspaceProps {
	/** Current mode slug */
	currentMode?: string
	/** Callback to run a graphics workflow */
	onRunWorkflow?: (intent: GraphicsIntent, message?: string) => void
	/** Callback to run a graphics playbook */
	onRunPlaybook?: (playbookId: GraphicsPlaybookId) => void
	/** Callback to switch mode */
	onSwitchMode?: (mode: string) => void
	/** Latest analysis result */
	latestResult?: GraphicsWorkflowResult | null
	/** Whether analysis is in progress */
	isAnalyzing?: boolean
}

/**
 * Quick action button configuration
 */
interface QuickAction {
	id: string
	label: string
	description: string
	intent?: GraphicsIntent
	playbookId?: GraphicsPlaybookId
	icon: string
}

/**
 * Available quick actions
 */
const QUICK_ACTIONS: QuickAction[] = [
	{
		id: "analyze-frame",
		label: "分析当前帧",
		description: "分析帧性能，识别热点事件",
		intent: "frame_summary",
		icon: "📊",
	},
	{
		id: "explain-draw",
		label: "解释选中 Draw",
		description: "详细分析当前选中的 draw call",
		intent: "selected_draw_explain",
		icon: "🔍",
	},
	{
		id: "find-owner",
		label: "查找代码实现",
		description: "将图形对象映射到项目代码",
		intent: "project_mapping",
		icon: "📁",
	},
	{
		id: "playbook-black-screen",
		label: "黑屏排查",
		description: "诊断黑屏问题的常见原因",
		playbookId: "black_screen",
		icon: "⚫",
	},
	{
		id: "playbook-gpu-slow",
		label: "GPU 慢排查",
		description: "诊断 GPU 性能问题",
		playbookId: "gpu_slow",
		icon: "🐌",
	},
	{
		id: "playbook-heavy-shader",
		label: "Shader 过重排查",
		description: "诊断 shader 性能问题",
		playbookId: "heavy_shader",
		icon: "⚡",
	},
]

/**
 * GraphicsWorkspace component
 */
export const GraphicsWorkspace: React.FC<GraphicsWorkspaceProps> = ({
	currentMode,
	onRunWorkflow,
	onRunPlaybook,
	onSwitchMode,
	latestResult,
	isAnalyzing,
}) => {
	const [selectedAction, setSelectedAction] = useState<string | null>(null)

	const handleActionClick = useCallback(
		(action: QuickAction) => {
			setSelectedAction(action.id)

			if (action.intent && onRunWorkflow) {
				onRunWorkflow(action.intent)
			} else if (action.playbookId && onRunPlaybook) {
				onRunPlaybook(action.playbookId)
			}
		},
		[onRunWorkflow, onRunPlaybook]
	)

	const handleSwitchToGraphicsMode = useCallback(() => {
		if (onSwitchMode) {
			onSwitchMode("graphics")
		}
	}, [onSwitchMode])

	const isGraphicsMode = currentMode === "graphics"

	return (
		<div className="graphics-workspace">
			{/* Header */}
			<div className="graphics-workspace__header">
				<h2>🎮 Graphics Workspace</h2>
				{!isGraphicsMode && (
					<button
						className="graphics-workspace__mode-switch"
						onClick={handleSwitchToGraphicsMode}
						title="切换到 Graphics Mode 获得更好的分析体验"
					>
						切换到 Graphics Mode
					</button>
				)}
				{isGraphicsMode && (
					<span className="graphics-workspace__mode-badge">
						✓ Graphics Mode
					</span>
				)}
			</div>

			{/* Quick Actions */}
			<div className="graphics-workspace__actions">
				<h3>快速操作</h3>
				<div className="graphics-workspace__action-grid">
					{QUICK_ACTIONS.map((action) => (
						<button
							key={action.id}
							className={`graphics-workspace__action ${
								selectedAction === action.id ? "selected" : ""
							}`}
							onClick={() => handleActionClick(action)}
							disabled={isAnalyzing}
						>
							<span className="action-icon">{action.icon}</span>
							<span className="action-label">{action.label}</span>
							<span className="action-description">{action.description}</span>
						</button>
					))}
				</div>
			</div>

			{/* Analysis Status */}
			{isAnalyzing && (
				<div className="graphics-workspace__status analyzing">
					<span className="spinner"></span>
					正在分析中...
				</div>
			)}

			{/* Latest Result */}
			{latestResult && !isAnalyzing && (
				<div className="graphics-workspace__result">
					<h3>分析结果</h3>
					<ResultSummary result={latestResult} />
				</div>
			)}

			{/* Help Text */}
			<div className="graphics-workspace__help">
				<p>
					<strong>提示：</strong>
					在 Graphics Mode 下，你可以直接用自然语言提问，例如：
				</p>
				<ul>
					<li>"为什么这一帧这么慢？"</li>
					<li>"解释一下当前选中的 draw call"</li>
					<li>"这个 shader 对应哪段代码？"</li>
					<li>"帮我排查黑屏问题"</li>
				</ul>
			</div>
		</div>
	)
}

/**
 * Result summary sub-component
 */
interface ResultSummaryProps {
	result: GraphicsWorkflowResult
}

const ResultSummary: React.FC<ResultSummaryProps> = ({ result }) => {
	if (!result.success) {
		return (
			<div className="result-summary error">
				<p className="error-message">{result.error || "分析失败"}</p>
				{result.suggestions.length > 0 && (
					<div className="suggestions">
						<h4>建议：</h4>
						<ul>
							{result.suggestions.map((s, i) => (
								<li key={i}>{s}</li>
							))}
						</ul>
					</div>
				)}
			</div>
		)
	}

	return (
		<div className="result-summary success">
			{/* Summary */}
			<div className="summary-section">
				<h4>结论</h4>
				<p>{result.summary}</p>
			</div>

			{/* Suspected Issues */}
			{result.suspectedIssues.length > 0 && (
				<div className="issues-section">
					<h4>发现的问题</h4>
					<ul>
						{result.suspectedIssues.map((issue, i) => (
							<li key={i} className={`issue confidence-${issue.confidence}`}>
								<span className="confidence-badge">{issue.confidence}</span>
								{issue.description}
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Suggestions */}
			{result.suggestions.length > 0 && (
				<div className="suggestions-section">
					<h4>建议</h4>
					<ul>
						{result.suggestions.map((s, i) => (
							<li key={i}>{s}</li>
						))}
					</ul>
				</div>
			)}

			{/* Project Mapping */}
			{result.projectMapping && result.projectMapping.length > 0 && (
				<div className="mapping-section">
					<h4>代码映射</h4>
					<ul>
						{result.projectMapping.map((candidate, i) => (
							<li key={i} className={`candidate confidence-${candidate.confidence}`}>
								<span className="confidence-badge">{candidate.confidence}</span>
								<code>
									{candidate.filePath}
									{candidate.line && `:${candidate.line}`}
								</code>
								{candidate.functionName && (
									<span className="function-name">({candidate.functionName})</span>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}

export default GraphicsWorkspace
