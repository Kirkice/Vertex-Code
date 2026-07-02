import { memo, useState, useMemo } from "react"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { useTaskSearch } from "./useTaskSearch"
import { useGroupedTasks } from "./useGroupedTasks"
import { countAllSubtasks } from "./types"
import TaskGroupItem from "./TaskGroupItem"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { vscode } from "@src/utils/vscode"

const HistoryPreview = () => {
	const { tasks, searchQuery } = useTaskSearch()
	const { groups, toggleExpand } = useGroupedTasks(tasks, searchQuery)
	const { t } = useAppTranslation()

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const [deleteSubtaskCount, setDeleteSubtaskCount] = useState<number>(0)

	// Get subtask count for a task (recursive total)
	const getSubtaskCount = useMemo(() => {
		const countMap = new Map<string, number>()
		for (const group of groups) {
			countMap.set(group.parent.id, countAllSubtasks(group.subtasks))
		}
		return (taskId: string) => countMap.get(taskId) || 0
	}, [groups])

	const handleViewAllHistory = () => {
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	// Handle delete with subtask count - show confirmation dialog
	const handleDelete = (taskId: string) => {
		setDeleteTaskId(taskId)
		setDeleteSubtaskCount(getSubtaskCount(taskId))
	}

	// Show up to 4 groups (parent + subtasks count as 1 block)
	const displayGroups = groups.slice(0, 4)

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between gap-3 mt-4 mb-2">
				<h2 className="font-semibold text-lg m-0">{t("history:recentTasks")}</h2>
				<button
					onClick={handleViewAllHistory}
					className="text-base text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer flex-shrink-0"
					aria-label={t("history:viewAllHistory")}>
					{t("history:viewAllHistory")}
				</button>
			</div>
			{displayGroups.length !== 0 && (
				<>
					{displayGroups.map((group) => (
						<TaskGroupItem
							key={group.parent.id}
							group={group}
							variant="compact"
							onDelete={handleDelete}
							onToggleExpand={() => toggleExpand(group.parent.id)}
							onToggleSubtaskExpand={toggleExpand}
						/>
					))}
				</>
			)}

			{/* Delete confirmation dialog */}
			{deleteTaskId && (
				<DeleteTaskDialog
					taskId={deleteTaskId}
					subtaskCount={deleteSubtaskCount}
					onOpenChange={(open) => {
						if (!open) {
							setDeleteTaskId(null)
							setDeleteSubtaskCount(0)
						}
					}}
					open
				/>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
