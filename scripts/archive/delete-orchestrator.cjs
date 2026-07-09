// Phase 6B: 删除 Orchestrator 相关文件和目录
const fs = require("fs")

const filesToDelete = [
	"packages/types/src/orchestrator.ts",
	"packages/types/src/orchestrator-events.ts",
	"packages/types/src/orchestrator-config.ts",
	"src/core/task/OrchestratorEngine.ts",
	"webview-ui/src/components/chat/OrchestratorDropdown.tsx",
]

const dirsToDelete = ["webview-ui/src/components/orchestrator"]

console.log("=== Phase 6B: Deleting Orchestrator files ===")

for (const f of filesToDelete) {
	try {
		fs.unlinkSync(f)
		console.log("deleted file: " + f)
	} catch (e) {
		console.log("skip file: " + f + " (" + e.code + ")")
	}
}

for (const d of dirsToDelete) {
	try {
		fs.rmSync(d, { recursive: true, force: true })
		console.log("deleted dir: " + d)
	} catch (e) {
		console.log("skip dir: " + d + " (" + e.code + ")")
	}
}

console.log("=== Done ===")
