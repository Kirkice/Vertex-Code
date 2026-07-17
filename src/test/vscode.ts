/**
 * Test-only VS Code module adapter.
 *
 * `@roo-code/vscode-shim` exposes a factory because consumers may need more
 * than one isolated API instance. Extension tests import the module-level
 * `vscode` object, so this adapter creates one shared instance per test
 * process and keeps production code untouched.
 */
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createVSCodeAPIMock } from "../../packages/vscode-shim/src/index.js"

const vscode = createVSCodeAPIMock(process.cwd(), process.cwd(), undefined, {
	storageDir: join(tmpdir(), "vertex-vscode-test-storage"),
})

// Re-export the class and enum surface so `import * as vscode` keeps the same
// shape as the real VS Code module while using the shared runtime instances.
export * from "../../packages/vscode-shim/src/index.js"

export const version = vscode.version
export const workspace = vscode.workspace
export const window = vscode.window
export const commands = vscode.commands
export const env = vscode.env
export const context = vscode.context
export const languages = vscode.languages
export const debug = vscode.debug
export const tasks = vscode.tasks
export const extensions = vscode.extensions
export const FileSystemWatcher = vscode.FileSystemWatcher
export const RelativePattern = vscode.RelativePattern
export const ProgressLocation = vscode.ProgressLocation
export const UriHandler = vscode.UriHandler
export const TabInputText = vscode.TabInputText
export const TabInputTextDiff = vscode.TabInputTextDiff
