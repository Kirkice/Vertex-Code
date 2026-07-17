import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import { openFile } from "../../integrations/misc/open-file"
import { openImage, saveImage } from "../../integrations/misc/image-handler"
import { selectImages } from "../../integrations/misc/process-images"
import { openMention } from "../mentions"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { resolveDefaultSaveUri, saveLastExportPath } from "../../utils/export"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import * as vscode from "vscode"
import { t } from "../../i18n"

import type { WebviewHandlerContext } from "./ports"

/**
 * Handle media/file oriented webview messages.
 *
 * 中英双语说明 / Bilingual note:
 * This module extracts file and media side-effects from the monolithic webview
 * router so that future phases can replace the host implementation more easily.
 * 该模块将文件与媒体副作用从主消息路由器中抽离，便于后续替换宿主实现。
 */
export async function handleMediaAndFileMessage(context: WebviewHandlerContext): Promise<boolean> {
	const { provider, message } = context

	switch (message.type) {
		case "selectImages": {
			const images = await selectImages()
			await context.postWebviewMessage({
				type: "selectedImages",
				images,
				context: message.context,
				messageTs: message.messageTs,
			})
			return true
		}
		case "openImage": {
			openImage(message.text!, { values: message.values })
			return true
		}
		case "saveImage": {
			if (!message.dataUri) return true
			const matches = message.dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
			if (!matches) {
				// Delegate invalid URI handling to the existing helper, preserving old behavior.
				// 把无效 data URI 交给旧 helper 处理，保持原有错误提示行为。
				await saveImage(message.dataUri, vscode.Uri.file(""))
				return true
			}

			const format = matches[1]
			const defaultFileName = `img_${Date.now()}.${format}`
			const defaultUri = await resolveDefaultSaveUri(
				provider.contextProxy,
				"lastImageSavePath",
				defaultFileName,
				{
					useWorkspace: false,
					fallbackDir: path.join(os.homedir(), "Downloads"),
				},
			)

			const savedUri = await saveImage(message.dataUri, defaultUri)
			if (savedUri) {
				await saveLastExportPath(provider.contextProxy, "lastImageSavePath", savedUri)
			}
			return true
		}
		case "openFile": {
			let filePath = message.text!
			if (!path.isAbsolute(filePath)) {
				filePath = path.join(context.getCurrentCwd(), filePath)
			}
			openFile(filePath, message.values as { create?: boolean; content?: string; line?: number })
			return true
		}
		case "readFileContent": {
			const relPath = message.text || ""
			if (!relPath) {
				await context.postWebviewMessage({
					type: "fileContent",
					fileContent: { path: relPath, content: null, error: "No path provided" },
				})
				return true
			}

			try {
				const cwd = context.getCurrentCwd()
				if (!cwd) {
					await context.postWebviewMessage({
						type: "fileContent",
						fileContent: { path: relPath, content: null, error: "No workspace path available" },
					})
					return true
				}

				const absPath = path.resolve(cwd, relPath)
				if (isPathOutsideWorkspace(absPath)) {
					await context.postWebviewMessage({
						type: "fileContent",
						fileContent: { path: relPath, content: null, error: "Path is outside workspace" },
					})
					return true
				}

				const content = await fs.readFile(absPath, "utf-8")
				await context.postWebviewMessage({ type: "fileContent", fileContent: { path: relPath, content } })
			} catch (err) {
				await context.postWebviewMessage({
					type: "fileContent",
					fileContent: {
						path: relPath,
						content: null,
						error: err instanceof Error ? err.message : String(err),
					},
				})
			}
			return true
		}
		case "openMention": {
			openMention(context.getCurrentCwd(), message.text)
			return true
		}
		case "openExternal": {
			if (message.url) {
				await import("vscode").then((vscode) => vscode.env.openExternal(vscode.Uri.parse(message.url!)))
			}
			return true
		}
		case "openProjectMcpSettings": {
			if (!vscode.workspace.workspaceFolders?.length) {
				vscode.window.showErrorMessage(t("common:errors.no_workspace"))
				return true
			}

			const workspaceFolder = context.getCurrentCwd()
			const rooDir = path.join(workspaceFolder, ".roo")
			const mcpPath = path.join(rooDir, "mcp.json")
			try {
				await fs.mkdir(rooDir, { recursive: true })
				const exists = await fileExistsAtPath(mcpPath)
				if (!exists) {
					await safeWriteJson(mcpPath, { mcpServers: {} }, { prettyPrint: true })
				}
				await openFile(mcpPath)
			} catch (error) {
				provider.log(`Failed to prepare project MCP settings: ${String(error)}`)
			}
			return true
		}
		default:
			return false
	}
}
