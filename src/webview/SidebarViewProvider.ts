/**
 * ============================================================
 *  Vertex - 侧边栏 WebView Provider
 *  实现类似 Vertex/Copilot 的侧边栏聊天界面
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
import { RepoPerTaskCheckpointService, CheckpointServiceOptions } from "../services/checkpoints"
import { McpServerManager } from "../services/mcp"
import { TaskManager } from "../services/tasks"
import { diffParser, diffApplier } from "../services/diff"
import { BrowserService } from "../services/browser"
import { PersistenceService } from "../services/persistence"
import { TelemetryService, telemetry } from "../services/telemetry"
import { FileIgnoreService } from "../services/file-ignore"
import { runAgentLoop } from "../core/agent-loop"
import { AutoApproveService } from "../services/auto-approve"
import { SlashCommandsService } from "../services/slash-commands"
import { SkillsService } from "../services/skills"
import { ContextManagementService } from "../services/context-management"
import { TerminalService } from "../services/terminal"
import { WorktreesService } from "../services/worktrees"
import { PromptsService } from "../services/prompts"
import { UIService } from "../services/ui"
import { LanguageService } from "../services/language"
import { NotificationService } from "../services/notifications"

// HistoryItem type matching the webview schema
interface HistoryItem {
	id: string
	rootTaskId?: string
	parentTaskId?: string
	number: number
	ts: number
	task: string
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	size?: number
	workspace?: string
	mode?: string
	apiConfigName?: string
	status?: "active" | "completed" | "delegated"
	delegatedToId?: string
	childIds?: string[]
	awaitingChildId?: string
	completedByChildId?: string
	completionResultSummary?: string
}

// ─── SidebarViewProvider 类 ──────────────────────────────

export class SidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vertex.sidebarView"

	private _view?: vscode.WebviewView
	private _extensionUri: vscode.Uri
	private _extensionContext?: vscode.ExtensionContext
	private _customModes: ModeConfig[]
	private _currentModeSlug: string = defaultModeSlug
	private _currentProvider: ApiProviderType = "openai"
	private _currentModel: string = "gpt-4o-mini"

	// Services
	private _checkpointService?: RepoPerTaskCheckpointService
	private _mcpManager?: McpServerManager
	private _taskManager: TaskManager
	private _browserService?: BrowserService
	private _persistenceService?: PersistenceService
	private _telemetryService: TelemetryService
	private _fileIgnoreService?: FileIgnoreService

	// Settings services
	private _autoApproveService: AutoApproveService
	private _slashCommandsService: SlashCommandsService
	private _skillsService: SkillsService
	private _contextManagementService: ContextManagementService
	private _terminalService: TerminalService
	private _worktreesService: WorktreesService
	private _promptsService: PromptsService
	private _uiService: UIService
	private _languageService: LanguageService
	private _notificationService: NotificationService

	private _enableCheckpoints: boolean = true
	private _currentTaskId?: string

	constructor(extensionUri: vscode.Uri, customModes: ModeConfig[], context?: vscode.ExtensionContext) {
		this._extensionUri = extensionUri
		this._customModes = customModes
		this._extensionContext = context
		this._taskManager = new TaskManager()
		this._telemetryService = TelemetryService.getInstance()

		// Initialize settings services
		this._autoApproveService = new AutoApproveService()
		this._slashCommandsService = new SlashCommandsService()
		this._skillsService = new SkillsService()
		this._contextManagementService = new ContextManagementService()
		this._terminalService = new TerminalService()
		this._worktreesService = new WorktreesService()
		this._promptsService = new PromptsService()
		this._uiService = new UIService()
		this._languageService = new LanguageService()
		this._notificationService = new NotificationService()
	}

	// ─── 初始化所有服务 ────────────────────────────────

	public async initializeServices(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders
		const workspaceDir = workspaceFolders?.[0]?.uri.fsPath

		// Initialize MCP
		if (this._extensionContext) {
			this._mcpManager = McpServerManager.getInstance(this._extensionContext)
			await this._mcpManager.initialize()
		}

		// Initialize Persistence
		if (this._extensionContext) {
			this._persistenceService = new PersistenceService(this._extensionContext.globalStorageUri.fsPath)
			await this._persistenceService.initialize()
		}

		// Initialize File Ignore
		if (workspaceDir) {
			this._fileIgnoreService = new FileIgnoreService(workspaceDir)
			await this._fileIgnoreService.initialize()
		}

		// Initialize Browser Service
		this._browserService = new BrowserService({ headless: true })

		// Track activation
		this._telemetryService.track("extension_activated")

		console.log("[Vertex] All services initialized")
	}

	// ─── 销毁所有服务 ──────────────────────────────────

	public async dispose(): Promise<void> {
		// Track deactivation
		this._telemetryService.track("extension_deactivated")

		// Dispose browser
		if (this._browserService) {
			await this._browserService.close()
		}

		// Dispose MCP
		if (this._mcpManager) {
			await this._mcpManager.dispose()
		}

		// Dispose telemetry
		await this._telemetryService.dispose()

		// Dispose persistence
		if (this._persistenceService) {
			await this._persistenceService.saveNow()
		}

		console.log("[Vertex] All services disposed")
	}

	// ─── Service accessors ─────────────────────────────

	public getTaskManager(): TaskManager {
		return this._taskManager
	}

	public getMcpManager(): McpServerManager | undefined {
		return this._mcpManager
	}

	public getBrowserService(): BrowserService | undefined {
		return this._browserService
	}

	public getPersistenceService(): PersistenceService | undefined {
		return this._persistenceService
	}

	public getTelemetryService(): TelemetryService {
		return this._telemetryService
	}

	public getFileIgnoreService(): FileIgnoreService | undefined {
		return this._fileIgnoreService
	}

	// Settings services accessors
	public getAutoApproveService(): AutoApproveService {
		return this._autoApproveService
	}

	public getSlashCommandsService(): SlashCommandsService {
		return this._slashCommandsService
	}

	public getSkillsService(): SkillsService {
		return this._skillsService
	}

	public getContextManagementService(): ContextManagementService {
		return this._contextManagementService
	}

	public getTerminalService(): TerminalService {
		return this._terminalService
	}

	public getWorktreesService(): WorktreesService {
		return this._worktreesService
	}

	public getPromptsService(): PromptsService {
		return this._promptsService
	}

	public getUIService(): UIService {
		return this._uiService
	}

	public getLanguageService(): LanguageService {
		return this._languageService
	}

	public getNotificationService(): NotificationService {
		return this._notificationService
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
		settings?: any
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

			// Chat interaction messages
			case "searchFiles": {
				const query = (message as any).query as string
				const requestId = (message as any).requestId as string
				await this._handleSearchFiles(query, requestId)
				break
			}

			case "enhancePrompt": {
				const prompt = (message as any).text as string
				await this._handleEnhancePrompt(prompt)
				break
			}

			case "requestCommands": {
				this._sendCommands()
				break
			}

			case "loadApiConfigurationById": {
				const configId = (message as any).text as string
				await this._loadApiConfigurationById(configId)
				break
			}

			case "mode": {
				const mode = (message as any).text as string
				if (mode) {
					this._currentModeSlug = mode
				}
				break
			}

			case "lockApiConfigAcrossModes": {
				const lock = (message as any).bool as boolean
				const config = vscode.workspace.getConfiguration("vertex")
				await config.update("lockApiConfigAcrossModes", lock, vscode.ConfigurationTarget.Global)
				break
			}

			case "hasOpenedModeSelector": {
				const opened = (message as any).bool as boolean
				const config = vscode.workspace.getConfiguration("vertex")
				await config.update("hasOpenedModeSelector", opened, vscode.ConfigurationTarget.Global)
				break
			}

			// Checkpoint related messages
			case "checkpointRestore": {
				const commitHash = (message as any).commitHash
				const ts = (message as any).ts
				const mode = (message as any).mode
				if (commitHash) {
					await this._handleCheckpointRestore(commitHash, ts, mode)
				}
				break
			}

			case "checkpointDiff": {
				const commitHash = (message as any).commitHash
				const previousCommitHash = (message as any).previousCommitHash
				const mode = (message as any).mode
				if (commitHash) {
					await this._handleCheckpointDiff(commitHash, previousCommitHash, mode)
				}
				break
			}

			case "getCheckpointState": {
				this._sendCheckpointState()
				break
			}

			// Webview initialization
			case "webviewDidLaunch": {
				this._sendTaskHistory()
				break
			}

			// History related messages
			case "showTaskWithId": {
				const taskId = (message as any).text
				if (taskId) {
					await this._handleShowTask(taskId)
				}
				break
			}

			case "deleteTaskWithId": {
				const taskId = (message as any).text
				if (taskId) {
					await this._handleDeleteTask(taskId)
				}
				break
			}

			case "deleteMultipleTasksWithIds": {
				const taskIds = (message as any).ids
				if (taskIds && Array.isArray(taskIds)) {
					await this._handleDeleteMultipleTasks(taskIds)
				}
				break
			}

			case "exportTaskWithId": {
				const taskId = (message as any).text
				if (taskId) {
					await this._handleExportTask(taskId)
				}
				break
			}

			// Settings related messages
			case "updateSettings": {
				const settings = message.settings as any
				if (settings) {
					this._handleUpdateSettings(settings)
				}
				break
			}

			case "getSettings": {
				this._sendSettings()
				break
			}

			case "getSlashCommands": {
				this._sendSlashCommands()
				break
			}

			case "getSkills": {
				this._sendSkills()
				break
			}

			case "getPrompts": {
				this._sendPrompts()
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

	/**
	 * Public method for services (tool-executor, agent-loop) to send messages to webview
	 */
	public postMessage(message: unknown): void {
		this._postMessage(message)
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

		// 保存用户消息到持久化
		const persistence = this.getPersistenceService()
		if (persistence) {
			let conversation = persistence.getLastActiveConversation()
			if (!conversation) {
				conversation = persistence.createConversation("New Conversation", this._currentModeSlug)
			}
			persistence.addMessage(conversation.id, {
				role: "user",
				content: userText,
				timestamp: Date.now(),
			})
		}

		// 使用 Agent Loop 调用 LLM（支持工具调用）
		try {
			const apiConfig: ApiConfig = {
				provider: apiProvider,
				apiKey,
				baseUrl: apiBase,
				model: apiModel,
			}

			// 运行 Agent Loop（支持多轮工具调用）
			const result = await runAgentLoop({
				mode,
				apiConfig,
				userMessage: userText,
				provider: this,
			})

			// 发送最终结果给 UI
			this._postMessage({
				type: "assistantReply",
				content: result.result,
				metadata: {
					iterations: result.iterations,
					toolCalls: result.toolCalls,
					usage: result.usage,
				},
			})

			// 记录任务到持久化
			if (persistence) {
				const conversation = persistence.getLastActiveConversation()
				if (conversation) {
					persistence.addMessage(conversation.id, {
						role: "assistant",
						content: result.result,
						timestamp: Date.now(),
						metadata: {
							iterations: result.iterations,
							toolCalls: result.toolCalls,
							usage: result.usage,
						},
					})
				}
			}

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

	// ─── Checkpoint 相关方法 ──────────────────────────────

	/**
	 * Initialize checkpoint service for a new task
	 */
	private async _initCheckpointService(taskId: string): Promise<void> {
		if (!this._enableCheckpoints || !this._extensionContext) {
			return
		}

		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return
		}

		const workspaceDir = workspaceFolders[0].uri.fsPath
		const shadowDir = this._extensionContext.globalStorageUri.fsPath

		try {
			const options: CheckpointServiceOptions = {
				taskId,
				workspaceDir,
				shadowDir,
				log: (msg) => console.log(`[Checkpoint] ${msg}`),
			}

			this._checkpointService = RepoPerTaskCheckpointService.create(options)
			this._currentTaskId = taskId

			// Listen for checkpoint events
			this._checkpointService.on("initialize", (data) => {
				this._postMessage({
					type: "checkpointInit",
					baseHash: data.baseHash,
					duration: data.duration,
				})
			})

			this._checkpointService.on("checkpoint", (data) => {
				this._postMessage({
					type: "checkpointSaved",
					commitHash: data.toHash,
					fromHash: data.fromHash,
					duration: data.duration,
					suppressMessage: data.suppressMessage,
				})
			})

			this._checkpointService.on("restore", (data) => {
				this._postMessage({
					type: "checkpointRestored",
					commitHash: data.commitHash,
					duration: data.duration,
				})
			})

			this._checkpointService.on("error", (data) => {
				console.error(`[Checkpoint] Error: ${data.error.message}`)
				this._postMessage({
					type: "checkpointError",
					error: data.error.message,
				})
			})

			// Initialize the shadow git repo
			await this._checkpointService.initShadowGit()
		} catch (error) {
			console.error(`[Checkpoint] Failed to initialize: ${error}`)
			this._enableCheckpoints = false
		}
	}

	/**
	 * Save a checkpoint before tool execution
	 */
	public async saveCheckpoint(message: string, allowEmpty = false): Promise<void> {
		if (!this._checkpointService || !this._enableCheckpoints) {
			return
		}

		try {
			await this._checkpointService.saveCheckpoint(message, { allowEmpty })
		} catch (error) {
			console.error(`[Checkpoint] Failed to save: ${error}`)
		}
	}

	/**
	 * Handle checkpoint restore request from webview
	 */
	private async _handleCheckpointRestore(
		commitHash: string,
		ts?: number,
		mode?: "preview" | "restore",
	): Promise<void> {
		if (!this._checkpointService) {
			return
		}

		try {
			await this._checkpointService.restoreCheckpoint(commitHash)

			if (mode === "restore") {
				// In restore mode, we also need to notify the webview to update UI
				this._postMessage({
					type: "checkpointRestored",
					commitHash,
					ts,
				})
			}
		} catch (error) {
			console.error(`[Checkpoint] Failed to restore: ${error}`)
			vscode.window.showErrorMessage(`Failed to restore checkpoint: ${error}`)
		}
	}

	/**
	 * Handle checkpoint diff request from webview
	 */
	private async _handleCheckpointDiff(
		commitHash: string,
		previousCommitHash?: string,
		mode?: string,
	): Promise<void> {
		if (!this._checkpointService) {
			return
		}

		try {
			const diffs = await this._checkpointService.getDiff({
				from: previousCommitHash,
				to: commitHash,
			})

			if (diffs.length === 0) {
				vscode.window.showInformationMessage("No changes in this checkpoint")
				return
			}

			// Open VS Code's diff view for each changed file
			for (const diff of diffs) {
				const beforeUri = vscode.Uri.parse(`vertex-diff:before:${diff.paths.relative}`).with({
					query: Buffer.from(diff.content.before).toString("base64"),
				})
				const afterUri = vscode.Uri.parse(`vertex-diff:after:${diff.paths.relative}`).with({
					query: Buffer.from(diff.content.after).toString("base64"),
				})

				await vscode.commands.executeCommand(
					"vscode.diff",
					beforeUri,
					afterUri,
					`${diff.paths.relative} (checkpoint diff)`,
				)
			}
		} catch (error) {
			console.error(`[Checkpoint] Failed to get diff: ${error}`)
			vscode.window.showErrorMessage(`Failed to get checkpoint diff: ${error}`)
		}
	}

	/**
	 * Send current checkpoint state to webview
	 */
	private _sendCheckpointState(): void {
		const checkpoints = this._checkpointService?.getCheckpoints() || []
		this._postMessage({
			type: "checkpointState",
			enabled: this._enableCheckpoints,
			checkpoints,
			baseHash: this._checkpointService?.baseHash,
		})
	}

	/**
	 * Enable or disable checkpoints
	 */
	public setCheckpointsEnabled(enabled: boolean): void {
		this._enableCheckpoints = enabled
	}

	/**
	 * Get current checkpoint service (for external use)
	 */
	public getCheckpointService(): RepoPerTaskCheckpointService | undefined {
		return this._checkpointService
	}

	// ─── History 相关方法 ────────────────────────────────────

	/**
	 * 发送任务历史到 WebView
	 */
	private _sendTaskHistory(): void {
		const persistence = this.getPersistenceService()
		if (persistence) {
			const taskHistory = persistence.getTaskHistory()
			this._postMessage({
				type: "taskHistory",
				taskHistory,
			})
		}
	}

	/**
	 * 显示指定任务
	 */
	private _handleShowTask(taskId: string): void {
		const persistence = this.getPersistenceService()
		if (persistence) {
			const task = persistence.getTask(taskId)
			if (task) {
				this._postMessage({
					type: "showTask",
					task,
				})
			}
		}
	}

	/**
	 * 删除指定任务
	 */
	private _handleDeleteTask(taskId: string): void {
		const persistence = this.getPersistenceService()
		if (persistence) {
			persistence.deleteTask(taskId)
			this._sendTaskHistory()
		}
	}

	/**
	 * 批量删除任务
	 */
	private _handleDeleteMultipleTasks(taskIds: string[]): void {
		const persistence = this.getPersistenceService()
		if (persistence) {
			taskIds.forEach((id) => persistence.deleteTask(id))
			this._sendTaskHistory()
		}
	}

	/**
	 * 导出任务
	 */
	private _handleExportTask(taskId: string): void {
		const persistence = this.getPersistenceService()
		if (persistence) {
			const task = persistence.getTask(taskId)
			if (task) {
				const taskData = JSON.stringify(task, null, 2)
				vscode.workspace.openTextDocument({
					content: taskData,
					language: "json",
				}).then((doc) => {
					vscode.window.showTextDocument(doc)
				})
			}
		}
	}

	// ─── Settings 相关方法 ─────────────────────────────────

	/**
	 * 处理设置更新
	 */
	private _handleUpdateSettings(settings: any): void {
		// AutoApprove
		if (settings.autoApprove !== undefined) {
			this._autoApproveService.updateConfig(settings.autoApprove)
		}

		// SlashCommands
		if (settings.slashCommands !== undefined) {
			this._slashCommandsService = SlashCommandsService.fromJSON(settings.slashCommands)
		}

		// Skills
		if (settings.skills !== undefined) {
			this._skillsService = SkillsService.fromJSON(settings.skills)
		}

		// ContextManagement
		if (settings.contextManagement !== undefined) {
			this._contextManagementService.updateConfig(settings.contextManagement)
		}

		// Terminal
		if (settings.terminal !== undefined) {
			this._terminalService.updateConfig(settings.terminal)
		}

		// Worktrees
		if (settings.worktrees !== undefined) {
			this._worktreesService.updateConfig(settings.worktrees)
		}

		// Prompts
		if (settings.prompts !== undefined) {
			this._promptsService = PromptsService.fromJSON(settings.prompts)
		}

		// UI
		if (settings.ui !== undefined) {
			this._uiService.updateConfig(settings.ui)
		}

		// Language
		if (settings.language !== undefined) {
			this._languageService.updateConfig(settings.language)
		}

		// Notifications
		if (settings.notifications !== undefined) {
			this._notificationService.updateConfig(settings.notifications)
		}

		// Save to persistence
		const persistence = this.getPersistenceService()
		if (persistence) {
			persistence.setSetting("settings", {
				autoApprove: this._autoApproveService.getConfig(),
				slashCommands: this._slashCommandsService.toJSON(),
				skills: this._skillsService.toJSON(),
				contextManagement: this._contextManagementService.getConfig(),
				terminal: this._terminalService.getConfig(),
				worktrees: this._worktreesService.getConfig(),
				prompts: this._promptsService.toJSON(),
				ui: this._uiService.getConfig(),
				language: this._languageService.getConfig(),
				notifications: this._notificationService.getConfig(),
			})
		}
	}

	/**
	 * 发送所有设置到 WebView
	 */
	private _sendSettings(): void {
		this._postMessage({
			type: "settings",
			settings: {
				autoApprove: this._autoApproveService.getConfig(),
				slashCommands: this._slashCommandsService.getAllCommands(),
				skills: this._skillsService.getAllSkills(),
				contextManagement: this._contextManagementService.getConfig(),
				terminal: this._terminalService.getConfig(),
				worktrees: this._worktreesService.getConfig(),
				prompts: this._promptsService.getAllPrompts(),
				ui: this._uiService.getConfig(),
				language: this._languageService.getConfig(),
				notifications: this._notificationService.getConfig(),
			},
		})
	}

	/**
	 * 发送 SlashCommands 到 WebView
	 */
	private _sendSlashCommands(): void {
		this._postMessage({
			type: "slashCommands",
			slashCommands: this._slashCommandsService.getAllCommands(),
		})
	}

	/**
	 * 发送 Skills 到 WebView
	 */
	private _sendSkills(): void {
		this._postMessage({
			type: "skills",
			skills: this._skillsService.getAllSkills(),
		})
	}

	/**
	 * 发送 Prompts 到 WebView
	 */
	private _sendPrompts(): void {
		this._postMessage({
			type: "prompts",
			prompts: this._promptsService.getAllPrompts(),
		})
	}

	// ─── Chat 交互方法 ─────────────────────────────────────

	/**
	 * 搜索文件
	 */
	private async _handleSearchFiles(query: string, requestId: string): Promise<void> {
		if (!query || query.length < 1) {
			this._postMessage({
				type: "fileSearchResults",
				requestId,
				results: [],
			})
			return
		}

		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			this._postMessage({
				type: "fileSearchResults",
				requestId,
				results: [],
			})
			return
		}

		try {
			// 使用 VS Code 的 findFiles API 搜索文件
			const pattern = `**/*${query}*`
			const excludePattern = "**/node_modules/**"
			const files = await vscode.workspace.findFiles(pattern, excludePattern, 50)

			const results = files.map((file) => ({
				path: vscode.workspace.asRelativePath(file),
				type: file.fsPath.endsWith("/") ? "folder" : "file",
			}))

			this._postMessage({
				type: "fileSearchResults",
				requestId,
				results,
			})
		} catch (error) {
			console.error("[SearchFiles] Error:", error)
			this._postMessage({
				type: "fileSearchResults",
				requestId,
				results: [],
			})
		}
	}

	/**
	 * 增强提示词（使用 LLM 改进用户输入）
	 */
	private async _handleEnhancePrompt(prompt: string): Promise<void> {
		if (!prompt || prompt.trim().length === 0) {
			this._postMessage({
				type: "enhancedPrompt",
				text: prompt,
			})
			return
		}

		const config = vscode.workspace.getConfiguration("vertex")
		const apiKey = config.get<string>("apiKey", "")
		const apiProvider = config.get<ApiProviderType>("apiProvider", "openai")
		const apiModel = config.get<string>("apiModel", "gpt-4o-mini")
		const apiBase = config.get<string>("apiBase", DEFAULT_BASE_URLS[apiProvider] || "https://api.openai.com/v1")

		if (!apiKey) {
			// 无 API Key，直接返回原文本
			this._postMessage({
				type: "enhancedPrompt",
				text: prompt,
			})
			return
		}

		try {
			const apiConfig: ApiConfig = {
				provider: apiProvider,
				apiKey,
				baseUrl: apiBase,
				model: apiModel,
			}

			const provider = createApiProvider(apiConfig)
			
			const enhanceSystemPrompt = `You are a helpful assistant that improves and clarifies user prompts. 
Your task is to:
1. Make the prompt more specific and clear
2. Add relevant context if helpful
3. Maintain the original intent
4. Keep it concise

Only output the improved prompt, nothing else.`

			const messages: ChatMessage[] = [
				{ role: "system", content: enhanceSystemPrompt },
				{ role: "user", content: prompt },
			]

			const response = await provider.chat(messages)
			
			this._postMessage({
				type: "enhancedPrompt",
				text: response.content || prompt,
			})
		} catch (error) {
			console.error("[EnhancePrompt] Error:", error)
			// 出错时返回原文本
			this._postMessage({
				type: "enhancedPrompt",
				text: prompt,
			})
		}
	}

	/**
	 * 发送命令列表到 WebView
	 */
	private _sendCommands(): void {
		const commands = this._slashCommandsService.getAllCommands()
		this._postMessage({
			type: "commands",
			commands,
		})
	}

	/**
	 * 按 ID 加载 API 配置
	 */
	private async _loadApiConfigurationById(configId: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("vertex")
		const profiles = config.get<ApiProfile[]>("apiProfiles", [])
		
		// 查找匹配的配置
		const profile = profiles.find((p) => p.name === configId)
		
		if (profile) {
			// 更新当前配置
			await config.update("apiProvider", profile.provider, vscode.ConfigurationTarget.Global)
			await config.update("apiKey", profile.apiKey, vscode.ConfigurationTarget.Global)
			await config.update("apiBase", profile.baseUrl, vscode.ConfigurationTarget.Global)
			await config.update("apiModel", profile.model, vscode.ConfigurationTarget.Global)
			await config.update("currentApiConfigName", profile.name, vscode.ConfigurationTarget.Global)

			// 更新内部状态
			this._currentProvider = profile.provider
			this._currentModel = profile.model

			// 发送更新后的配置到 WebView
			this._sendProviderInfo()
			this._sendCurrentConfig()
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
			`font-src ${webview.cspSource} data:`,
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