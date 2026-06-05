/**
 * ============================================================
 *  Vertex - WebView 面板管理
 *  对应 Vertex 的 src/activate/ContextProxy.ts（简化版)
 * ============================================================
 *
 *  核心职责：
 *  1. 创建和管理 WebView 面板
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

// ─── ChatPanel 类 ──────────────────────────────────────

export class ChatPanel {
	/** 当前活跃的面板实例 */
	public static currentPanel: ChatPanel | undefined

	/** WebView 面板 */
	private readonly _panel: vscode.WebviewPanel

	/** 扩展资源 URI */
	private readonly _extensionUri: vscode.Uri

	/** 自定义模式列表 */
	private _customModes: ModeConfig[]

	/** 当前选中的模式 slug */
	private _currentModeSlug: string = defaultModeSlug

	/** 当前选中的 API Provider */
	private _currentProvider: ApiProviderType = "openai"

	/** 当前选中的模型 */
	private _currentModel: string = "gpt-4o-mini"

	/** 监听器销毁列表 */
	private readonly _disposables: vscode.Disposable[] = []

	// ─── 创建或显示面板 ────────────────────────────────

	public static createOrShow(extensionUri: vscode.Uri, customModes: ModeConfig[]): ChatPanel {
		// 如果已有面板，则更新并显示
		if (ChatPanel.currentPanel) {
			ChatPanel.currentPanel._customModes = customModes
			ChatPanel.currentPanel._updateModesList()
			ChatPanel.currentPanel._panel.reveal()
			return ChatPanel.currentPanel
		}

		// 否则创建新面板
		const panel = vscode.window.createWebviewPanel(
			"vertexChat",
			"Vertex Chat",
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.file(path.join(extensionUri.fsPath, "webview-ui", "dist")),
				],
			},
		)

		ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, customModes)
		return ChatPanel.currentPanel
	}

	// ─── 构造函数 ──────────────────────────────────────

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		customModes: ModeConfig[],
	) {
		this._panel = panel
		this._extensionUri = extensionUri
		this._customModes = customModes

		// 设置 WebView 内容
		this._panel.webview.html = this._getWebviewContent()

		// 监听 WebView 消息
		this._panel.webview.onDidReceiveMessage(
			this._handleWebviewMessage.bind(this),
			null,
			this._disposables,
		)

		// 面板关闭时清理
		this._panel.onDidDispose(() => this._dispose(), null, this._disposables)

		// 初始化：发送模式列表到 WebView
		this._updateModesList()
	}

	// ─── 更新自定义模式 ─────────────────────────────────

	public updateCustomModes(customModes: ModeConfig[]): void {
		this._customModes = customModes
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
					this._selectProfile(message.profileName)
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

	// ─── 发送模式列表到 WebView ─────────────────────────

	private _updateModesList(): void {
		const allModes = getAllModes(this._customModes)
		this._panel.webview.postMessage({
			type: "modesList",
			modes: allModes,
			currentMode: this._currentModeSlug,
		})
	}

	// ─── 发送当前模式摘要到 WebView ─────────────────────

	private _sendModeSummary(): void {
		const summary = getModeSummary(this._currentModeSlug, this._customModes)
		this._panel.webview.postMessage({
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
			this._panel.webview.postMessage({
				type: "promptPreview",
				content: systemPrompt,
			})
		}
	}

	// ─── 处理用户发送消息 ───────────────────────────────

	private async _handleSendMessage(userText: string): Promise<void> {
		const mode = getModeBySlug(this._currentModeSlug, this._customModes)
		if (!mode) {
			return
		}

		// 读取 API 配置
		const config = vscode.workspace.getConfiguration("vertex")
		const apiKey = config.get<string>("apiKey", "")
		const apiProvider = config.get<ApiProviderType>("apiProvider", "openai")
		const apiModel = this._currentModel || config.get<string>("apiModel", "gpt-4o-mini")
		const apiBase = config.get<string>("apiBase", DEFAULT_BASE_URLS[apiProvider] || "https://api.openai.com/v1")

		if (!apiKey) {
			// 无 API Key → 展示组装的 Prompt（演示模式）
			const chatContext = buildChatContext(mode, userText)
			this._panel.webview.postMessage({
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
			this._panel.webview.postMessage({
				type: "assistantReply",
				content: result.content,
			})
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			this._panel.webview.postMessage({
				type: "assistantReply",
				content: `## ❌ Error\n\nFailed to call API:\n\`\`\`\n${errorMsg}\n\`\`\`\n\nPlease check your API key and model settings.`,
			})
		}
	}

	// ─── 加载 WebView HTML 内容 ──────────────────────────

	private _getWebviewContent(): string {
		// 构建产物路径
		const webviewUiDistPath = path.join(this._extensionUri.fsPath, "webview-ui", "dist")
		const htmlPath = path.join(webviewUiDistPath, "index.html")

		// 读取 Vite 构建后的 HTML 文件
		let html = fs.readFileSync(htmlPath, "utf8")

		// WebView 安全 URI
		const webview = this._panel.webview

		// CSP 内容
		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src ${webview.cspSource}`,
			`img-src ${webview.cspSource} data:`,
			`font-src ${webview.cspSource}`,
			`connect-src ${webview.cspSource} https: http:`,
		].join("; ")

		// 注入 CSP 并把 Vite 构建产物中的静态资源路径转换为 WebView 安全 URI
		html = html.replace(
			"</head>",
			`<meta http-equiv="Content-Security-Policy" content="${csp}" />\n</head>`,
		)
		html = html.replace(/(src|href)=(['"])(\/?(?:\.\/)?assets\/[^'"]+)\2/g, (_match, attr, quote, assetPath) => {
			const normalizedAssetPath = String(assetPath).replace(/^\//, "")
			const assetUri = webview.asWebviewUri(
				vscode.Uri.file(path.join(webviewUiDistPath, normalizedAssetPath)),
			)
			return `${attr}=${quote}${assetUri.toString()}${quote}`
		})

		return html
	}

	// ─── 清理资源 ───────────────────────────────────────

	private _dispose(): void {
		ChatPanel.currentPanel = undefined

		this._panel.dispose()

		while (this._disposables.length) {
			const disposable = this._disposables.pop()
			if (disposable) {
				disposable.dispose()
			}
		}
	}

	public dispose(): void {
		this._dispose()
	}

	// ─── Provider 相关方法 ─────────────────────────────────

	/** 发送 Provider 信息到 WebView */
	private _sendProviderInfo(): void {
		const config = vscode.workspace.getConfiguration("vertex")
		this._panel.webview.postMessage({
			type: "providerInfo",
			provider: this._currentProvider,
			model: this._currentModel,
			apiKey: config.get<string>("apiKey", ""),
			baseUrl: config.get<string>("apiBase", DEFAULT_BASE_URLS[this._currentProvider] || ""),
		})
	}

	/** 发送模型列表到 WebView */
	private _sendModelsList(): void {
		const models = PREDEFINED_MODELS[this._currentProvider] || []
		this._panel.webview.postMessage({
			type: "modelsList",
			models,
			currentModel: this._currentModel,
		})
	}

	/** 发送 Profile 列表到 WebView */
	private _sendProfilesList(): void {
		const config = vscode.workspace.getConfiguration("vertex")
		const profiles = config.get<ApiProfile[]>("apiProfiles", [])
		this._panel.webview.postMessage({
			type: "profilesList",
			profiles,
		})
	}

	/** 发送当前配置到 WebView */
	private _sendCurrentConfig(): void {
		const config = vscode.workspace.getConfiguration("vertex")
		this._panel.webview.postMessage({
			type: "currentConfig",
			provider: config.get<ApiProviderType>("apiProvider", "openai"),
			model: config.get<string>("apiModel", "gpt-4o-mini"),
			apiKey: config.get<string>("apiKey", ""),
			baseUrl: config.get<string>("apiBase", ""),
		})
	}

	/** 选择 Profile */
	private async _selectProfile(profileName: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("vertex")
		const profiles = config.get<ApiProfile[]>("apiProfiles", [])
		const profile = profiles.find(p => p.name === profileName)

		if (profile) {
			// 更新当前配置
			await config.update("apiProvider", profile.provider, vscode.ConfigurationTarget.Global)
			await config.update("apiKey", profile.apiKey, vscode.ConfigurationTarget.Global)
			await config.update("apiBase", profile.baseUrl, vscode.ConfigurationTarget.Global)
			await config.update("apiModel", profile.model, vscode.ConfigurationTarget.Global)

			// 更新内部状态
			this._currentProvider = profile.provider
			this._currentModel = profile.model

			// 发送更新
			this._sendProviderInfo()
			this._sendModelsList()
		}
	}
}
