/**
 * ============================================================
 *  Vertex - 侧边栏 WebView Provider
 *  实现类似 Roo-Code/Copilot 的侧边栏聊天界面
 * ============================================================
 *
 *  核心职责：
 *  1. 实现 WebviewViewProvider 接口，注册为侧边栏视图
 *  2. 处理 Extension ↔ WebView 的双向消息通信
 *  3. 加载 webview-ui 的 HTML，替换模板变量为 WebView 安全 URI
 *  4. 模式切换、Prompt 预览、消息发送
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"

import type { ModeConfig } from "../types/modes"
import { getAllModes, getModeBySlug, getModeSummary, defaultModeSlug } from "../core/modes"
import { buildSystemPrompt, buildChatContext } from "../core/prompt"
import { createApiProvider, PREDEFINED_MODELS, DEFAULT_BASE_URLS } from "../core/api"
import type { ApiProviderType, ApiConfig, ApiProfile, ChatMessage } from "../core/api"

// ─── SidebarViewProvider 类 ──────────────────────────────

export class SidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vertex.sidebarView"

	private _view?: vscode.WebviewView
	private _extensionUri: vscode.Uri
	private _customModes: ModeConfig[]
	private _currentModeSlug: string = defaultModeSlug
	private _currentProvider: ApiProviderType = "openai"
	private _currentModel: string = "gpt-4o-mini"

	constructor(extensionUri: vscode.Uri, customModes: ModeConfig[]) {
		this._extensionUri = extensionUri
		this._customModes = customModes
	}

	// ─── 更新自定义模式 ─────────────────────────────────

	public updateCustomModes(customModes: ModeConfig[]): void {
		this._customModes = customModes
		this._updateModesList()
	}

	// ─── 清空聊天 ───────────────────────────────────────

	public clearChat(): void {
		if (this._view) {
			this._view.webview.postMessage({ type: "clearChat" })
		}
	}

	// ─── 实现 WebviewViewProvider 接口 ───────────────────

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this._view = webviewView

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.file(path.join(this._extensionUri.fsPath, "webview-ui")),
				vscode.Uri.file(path.join(this._extensionUri.fsPath, "webview-ui", "dist")),
			],
		}

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

		// 监听 WebView 消息
		webviewView.webview.onDidReceiveMessage(
			(message) => this._handleWebviewMessage(message),
		)

		// 初始化：发送模式列表
		this._updateModesList()
	}

	// ─── 处理 WebView 发来的消息 ───────────────────────

	private async _handleWebviewMessage(message: {
		type: string
		slug?: string
		text?: string
		provider?: ApiProviderType
		model?: string
		profileName?: string
	}): Promise<void> {
		if (!this._view) return

		switch (message.type) {
			case "switchMode": {
				if (message.slug) {
					this._currentModeSlug = message.slug
					this._sendModeSummary()
				}
				break
			}

			case "sendMessage": {
				if (message.text) {
					await this._handleSendMessage(message.text)
				}
				break
			}

			case "previewPrompt": {
				this._sendPromptPreview()
				break
			}

			case "switchProvider": {
				if (message.provider) {
					this._currentProvider = message.provider
					this._sendProviderInfo()
				}
				break
			}

			case "switchModel": {
				if (message.model) {
					this._currentModel = message.model
					this._sendProviderInfo()
				}
				break
			}

			case "selectProfile": {
				if (message.profileName) {
					await this._selectProfile(message.profileName)
				}
				break
			}

			case "getModels": {
				this._sendModelsList()
				break
			}

			case "getProfiles": {
				this._sendProfilesList()
				break
			}

			case "getCurrentConfig": {
				this._sendCurrentConfig()
				break
			}
		}
	}

	// ─── 发送消息到 WebView ─────────────────────────────

	private _postMessage(message: unknown): void {
		if (this._view) {
			this._view.webview.postMessage(message)
		}
	}

	// ─── 发送模式列表到 WebView ─────────────────────────

	private _updateModesList(): void {
		const allModes = getAllModes(this._customModes)
		this._postMessage({
			type: "modesList",
			modes: allModes,
			currentMode: this._currentModeSlug,
		})
	}

	// ─── 发送当前模式摘要到 WebView ─────────────────────

	private _sendModeSummary(): void {
		const summary = getModeSummary(this._currentModeSlug, this._customModes)
		this._postMessage({
			type: "modeSummary",
			summary,
			slug: this._currentModeSlug,
		})
	}

	// ─── 发送 Prompt 预览到 WebView ─────────────────────

	private _sendPromptPreview(): void {
		const mode = getModeBySlug(this._currentModeSlug, this._customModes)
		if (mode) {
			const systemPrompt = buildSystemPrompt(mode)
			this._postMessage({
				type: "promptPreview",
				content: systemPrompt,
			})
		}
	}

	// ─── 处理用户发送消息 ───────────────────────────────

	private async _handleSendMessage(userText: string): Promise<void> {
		const mode = getModeBySlug(this._currentModeSlug, this._customModes)
		if (!mode) return

		// 读取 API 配置
		const config = vscode.workspace.getConfiguration("vertex")
		const apiKey = config.get<string>("apiKey", "")
		const apiProvider = config.get<ApiProviderType>("apiProvider", "openai")
		const apiModel = this._currentModel || config.get<string>("apiModel", "gpt-4o-mini")
		const apiBase = config.get<string>("apiBase", DEFAULT_BASE_URLS[apiProvider] || "https://api.openai.com/v1")

		if (!apiKey) {
			// 无 API Key → 展示组装的 Prompt（演示模式）
			const chatContext = buildChatContext(mode, userText)
			this._postMessage({
				type: "assistantReply",
				content: `## 📋 Demo Mode (No API Key)\n\n### System Prompt:\n\`\`\`\n${chatContext.systemPrompt}\n\`\`\`\n\n### User Message:\n\`\`\`\n${chatContext.userMessage}\n\`\`\`\n\n💡 To enable real LLM calls, set \`vertex.apiKey\` in VS Code Settings.`,
			})
			return
		}

		// 使用 API Provider 调用 LLM
		try {
			const chatContext = buildChatContext(mode, userText)

			const apiConfig: ApiConfig = {
				provider: apiProvider,
				apiKey,
				baseUrl: apiBase,
				model: apiModel,
			}

			const provider = createApiProvider(apiConfig)
			const messages: ChatMessage[] = [
				{ role: "system", content: chatContext.systemPrompt },
				{ role: "user", content: chatContext.userMessage },
			]

			const result = await provider.chat(messages)
			this._postMessage({
				type: "assistantReply",
				content: result.content,
			})
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			this._postMessage({
				type: "assistantReply",
				content: `## ❌ Error\n\nFailed to call API:\n\`\`\`\n${errorMsg}\n\`\`\`\n\nPlease check your API key and model settings.`,
			})
		}
	}

	// ─── Provider 相关方法 ─────────────────────────────────

	private _sendProviderInfo(): void {
		const config = vscode.workspace.getConfiguration("vertex")
		this._postMessage({
			type: "providerInfo",
			provider: this._currentProvider,
			model: this._currentModel,
			apiKey: config.get<string>("apiKey", ""),
			baseUrl: config.get<string>("apiBase", DEFAULT_BASE_URLS[this._currentProvider] || ""),
		})
	}

	private _sendModelsList(): void {
		const models = PREDEFINED_MODELS[this._currentProvider] || []
		this._postMessage({
			type: "modelsList",
			models,
			currentModel: this._currentModel,
		})
	}

	private _sendProfilesList(): void {
		const config = vscode.workspace.getConfiguration("vertex")
		const profiles = config.get<ApiProfile[]>("apiProfiles", [])
		this._postMessage({
			type: "profilesList",
			profiles,
		})
	}

	private _sendCurrentConfig(): void {
		const config = vscode.workspace.getConfiguration("vertex")
		this._postMessage({
			type: "currentConfig",
			provider: config.get<ApiProviderType>("apiProvider", "openai"),
			model: config.get<string>("apiModel", "gpt-4o-mini"),
			apiKey: config.get<string>("apiKey", ""),
			baseUrl: config.get<string>("apiBase", ""),
		})
	}

	private async _selectProfile(profileName: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("vertex")
		const profiles = config.get<ApiProfile[]>("apiProfiles", [])
		const profile = profiles.find(p => p.name === profileName)

		if (profile) {
			await config.update("apiProvider", profile.provider, vscode.ConfigurationTarget.Global)
			await config.update("apiKey", profile.apiKey, vscode.ConfigurationTarget.Global)
			await config.update("apiBase", profile.baseUrl, vscode.ConfigurationTarget.Global)
			await config.update("apiModel", profile.model, vscode.ConfigurationTarget.Global)

			this._currentProvider = profile.provider
			this._currentModel = profile.model

			this._sendProviderInfo()
			this._sendModelsList()
		}
	}

	// ─── 加载 WebView HTML 内容 ──────────────────────────

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const distPath = path.join(this._extensionUri.fsPath, "webview-ui", "dist")
		const htmlPath = path.join(distPath, "index.html")

		let html = fs.readFileSync(htmlPath, "utf8")

		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src ${webview.cspSource} 'unsafe-inline'`,
			`img-src ${webview.cspSource} data:`,
			`font-src ${webview.cspSource}`,
		].join("; ")

		html = html.replace(
			/<meta charset="UTF-8" \/>/,
			`<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
		)

		html = html.replace(
			/(<(?:script|link)[^>]+(?:src|href)=["'])([^"']+)(["'][^>]*>)/g,
			(_, prefix: string, assetPath: string, suffix: string) => {
				const normalizedPath = assetPath.replace(/^\.\//, "")
				const assetUri = webview.asWebviewUri(
					vscode.Uri.file(path.join(distPath, normalizedPath)),
				)
				return `${prefix}${assetUri.toString()}${suffix}`
			},
		)

		return html
	}
}