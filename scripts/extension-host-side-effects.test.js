const assert = require("node:assert/strict")
const vscode = require("vscode")

async function run() {
	const extension = vscode.extensions.getExtension("VertexOrganization.vertex")
	assert.ok(extension, "Vertex extension is not available in the Extension Host")
	await extension.activate()

	const report = await vscode.commands.executeCommand("vertex.internal.extensionHostSideEffects")
	assert.ok(report, "Extension Host smoke command returned no report")
	assert.match(report.fileWrite.content, /^extension-host-file-write:/)
	assert.match(report.command.output, /extension-host-command-ok/)
	assert.match(report.mcp.output, /mcp-ok/)
	assert.equal(report.checkpoint.initialized, true)
	assert.equal(report.checkpoint.enabled, true)
	assert.equal(report.subtask.created, true)
	assert.notEqual(report.subtask.parentTaskId, report.subtask.childTaskId)

	console.log(`[extension-host-smoke] passed ${JSON.stringify(report)}`)
}

module.exports = { run }
