/**
 * ============================================================
 *  Vertex - 扩展入口
 *  对应 Roo-Code 的 src/extension.ts + src/activate/
 * ============================================================
 *
 *  核心职责：
 *  1. 注册侧边栏视图（vertex.sidebarView）
 *  2. 注册命令（vertex.openChat 等）
 *  3. 监听设置变更（customModes 变化时更新 WebView）
 */

import * as vscode from "vscode"

import type { ModeConfig } from "./types/modes"
import { SidebarViewProvider } from "./webview/SidebarViewProvider"

// ─── 激活 ──────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
	// 获取自定义模式
	const customModes = getCustomModesFromSettings()

	// 创建侧边栏 Provider
	const sidebarProvider = new SidebarViewProvider(context.extensionUri, customModes)

	// 注册侧边栏视图
	const sidebarRegistration = vscode.window.registerWebviewViewProvider(
		SidebarViewProvider.viewType,
		sidebarProvider,
		{
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		},
	)

	context.subscriptions.push(sidebarRegistration)

	// 注册 openChat 命令（聚焦到侧边栏）
	const openChatCommand = vscode.commands.registerCommand("vertex.openChat", () => {
		// 执行 workbench.action.focusAuxiliaryBar 聚焦到侧边栏
		vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar")
		// 聚焦到 Vertex 侧边栏视图
		vscode.commands.executeCommand("vertex.sidebarView.focus")
	})

	context.subscriptions.push(openChatCommand)

	// 注册 clearChat 命令
	const clearChatCommand = vscode.commands.registerCommand("vertex.clearChat", () => {
		sidebarProvider.clearChat()
	})

	context.subscriptions.push(clearChatCommand)

	// 注册 newChat 命令
	const newChatCommand = vscode.commands.registerCommand("vertex.newChat", () => {
		sidebarProvider.clearChat()
	})

	context.subscriptions.push(newChatCommand)

	// 监听设置变更
	const settingsWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration("vertex.customModes")) {
			const newCustomModes = getCustomModesFromSettings()
			sidebarProvider.updateCustomModes(newCustomModes)
		}
	})

	context.subscriptions.push(settingsWatcher)
}

// ─── 从 VS Code 设置读取自定义模式 ──────────────────────

function getCustomModesFromSettings(): ModeConfig[] {
	const config = vscode.workspace.getConfiguration("vertex")
	const rawModes = config.get<ModeConfig[]>("customModes", [])

	// 基本校验：确保每个模式至少有 slug、name、roleDefinition、toolGroups
	return rawModes.filter((mode) =>
		mode.slug &&
		mode.name &&
		mode.roleDefinition &&
		mode.toolGroups &&
		mode.toolGroups.length > 0,
	)
}

// ─── 停用 ──────────────────────────────────────────────

export function deactivate(): void {
	// 清理工作由 VS Code 自动处理
}