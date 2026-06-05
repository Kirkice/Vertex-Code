"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const modes_1 = require("../core/modes");
const prompt_1 = require("../core/prompt");
const api_1 = require("../core/api");
const checkpoints_1 = require("../services/checkpoints");
const mcp_1 = require("../services/mcp");
const tasks_1 = require("../services/tasks");
const browser_1 = require("../services/browser");
const persistence_1 = require("../services/persistence");
const telemetry_1 = require("../services/telemetry");
const file_ignore_1 = require("../services/file-ignore");
const agent_loop_1 = require("../core/agent-loop");
const auto_approve_1 = require("../services/auto-approve");
const slash_commands_1 = require("../services/slash-commands");
const skills_1 = require("../services/skills");
const context_management_1 = require("../services/context-management");
const terminal_1 = require("../services/terminal");
const worktrees_1 = require("../services/worktrees");
const prompts_1 = require("../services/prompts");
const ui_1 = require("../services/ui");
const language_1 = require("../services/language");
const notifications_1 = require("../services/notifications");
// ─── SidebarViewProvider 类 ──────────────────────────────
class SidebarViewProvider {
    constructor(extensionUri, customModes, context) {
        this._currentModeSlug = modes_1.defaultModeSlug;
        this._currentProvider = "openai";
        this._currentModel = "gpt-4o-mini";
        this._enableCheckpoints = true;
        this._extensionUri = extensionUri;
        this._customModes = customModes;
        this._extensionContext = context;
        this._taskManager = new tasks_1.TaskManager();
        this._telemetryService = telemetry_1.TelemetryService.getInstance();
        // Initialize settings services
        this._autoApproveService = new auto_approve_1.AutoApproveService();
        this._slashCommandsService = new slash_commands_1.SlashCommandsService();
        this._skillsService = new skills_1.SkillsService();
        this._contextManagementService = new context_management_1.ContextManagementService();
        this._terminalService = new terminal_1.TerminalService();
        this._worktreesService = new worktrees_1.WorktreesService();
        this._promptsService = new prompts_1.PromptsService();
        this._uiService = new ui_1.UIService();
        this._languageService = new language_1.LanguageService();
        this._notificationService = new notifications_1.NotificationService();
    }
    // ─── 初始化所有服务 ────────────────────────────────
    async initializeServices() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceDir = workspaceFolders?.[0]?.uri.fsPath;
        // Initialize MCP
        if (this._extensionContext) {
            this._mcpManager = mcp_1.McpServerManager.getInstance(this._extensionContext);
            await this._mcpManager.initialize();
        }
        // Initialize Persistence
        if (this._extensionContext) {
            this._persistenceService = new persistence_1.PersistenceService(this._extensionContext.globalStorageUri.fsPath);
            await this._persistenceService.initialize();
        }
        // Initialize File Ignore
        if (workspaceDir) {
            this._fileIgnoreService = new file_ignore_1.FileIgnoreService(workspaceDir);
            await this._fileIgnoreService.initialize();
        }
        // Initialize Browser Service
        this._browserService = new browser_1.BrowserService({ headless: true });
        // Track activation
        this._telemetryService.track("extension_activated");
        console.log("[Vertex] All services initialized");
    }
    // ─── 销毁所有服务 ──────────────────────────────────
    async dispose() {
        // Track deactivation
        this._telemetryService.track("extension_deactivated");
        // Dispose browser
        if (this._browserService) {
            await this._browserService.close();
        }
        // Dispose MCP
        if (this._mcpManager) {
            await this._mcpManager.dispose();
        }
        // Dispose telemetry
        await this._telemetryService.dispose();
        // Dispose persistence
        if (this._persistenceService) {
            await this._persistenceService.saveNow();
        }
        console.log("[Vertex] All services disposed");
    }
    // ─── Service accessors ─────────────────────────────
    getTaskManager() {
        return this._taskManager;
    }
    getMcpManager() {
        return this._mcpManager;
    }
    getBrowserService() {
        return this._browserService;
    }
    getPersistenceService() {
        return this._persistenceService;
    }
    getTelemetryService() {
        return this._telemetryService;
    }
    getFileIgnoreService() {
        return this._fileIgnoreService;
    }
    // Settings services accessors
    getAutoApproveService() {
        return this._autoApproveService;
    }
    getSlashCommandsService() {
        return this._slashCommandsService;
    }
    getSkillsService() {
        return this._skillsService;
    }
    getContextManagementService() {
        return this._contextManagementService;
    }
    getTerminalService() {
        return this._terminalService;
    }
    getWorktreesService() {
        return this._worktreesService;
    }
    getPromptsService() {
        return this._promptsService;
    }
    getUIService() {
        return this._uiService;
    }
    getLanguageService() {
        return this._languageService;
    }
    getNotificationService() {
        return this._notificationService;
    }
    // ─── 更新自定义模式 ─────────────────────────────────
    updateCustomModes(customModes) {
        this._customModes = customModes;
        this._updateModesList();
    }
    // ─── 清空聊天 ───────────────────────────────────────
    clearChat() {
        if (this._view) {
            this._view.webview.postMessage({ type: "clearChat" });
        }
    }
    // ─── 实现 WebviewViewProvider 接口 ───────────────────
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this._extensionUri.fsPath, "webview-ui")),
                vscode.Uri.file(path.join(this._extensionUri.fsPath, "webview-ui", "dist")),
            ],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // 监听 WebView 消息
        webviewView.webview.onDidReceiveMessage((message) => this._handleWebviewMessage(message));
        // 初始化：发送模式列表
        this._updateModesList();
    }
    // ─── 处理 WebView 发来的消息 ───────────────────────
    async _handleWebviewMessage(message) {
        if (!this._view)
            return;
        switch (message.type) {
            case "switchMode": {
                if (message.slug) {
                    this._currentModeSlug = message.slug;
                    this._sendModeSummary();
                }
                break;
            }
            case "sendMessage": {
                if (message.text) {
                    await this._handleSendMessage(message.text);
                }
                break;
            }
            case "previewPrompt": {
                this._sendPromptPreview();
                break;
            }
            case "switchProvider": {
                if (message.provider) {
                    this._currentProvider = message.provider;
                    this._sendProviderInfo();
                }
                break;
            }
            case "switchModel": {
                if (message.model) {
                    this._currentModel = message.model;
                    this._sendProviderInfo();
                }
                break;
            }
            case "selectProfile": {
                if (message.profileName) {
                    await this._selectProfile(message.profileName);
                }
                break;
            }
            case "getModels": {
                this._sendModelsList();
                break;
            }
            case "getProfiles": {
                this._sendProfilesList();
                break;
            }
            case "getCurrentConfig": {
                this._sendCurrentConfig();
                break;
            }
            // Chat interaction messages
            case "searchFiles": {
                const query = message.query;
                const requestId = message.requestId;
                await this._handleSearchFiles(query, requestId);
                break;
            }
            case "enhancePrompt": {
                const prompt = message.text;
                await this._handleEnhancePrompt(prompt);
                break;
            }
            case "requestCommands": {
                this._sendCommands();
                break;
            }
            case "loadApiConfigurationById": {
                const configId = message.text;
                await this._loadApiConfigurationById(configId);
                break;
            }
            case "mode": {
                const mode = message.text;
                if (mode) {
                    this._currentModeSlug = mode;
                }
                break;
            }
            case "lockApiConfigAcrossModes": {
                const lock = message.bool;
                const config = vscode.workspace.getConfiguration("vertex");
                await config.update("lockApiConfigAcrossModes", lock, vscode.ConfigurationTarget.Global);
                break;
            }
            case "hasOpenedModeSelector": {
                const opened = message.bool;
                const config = vscode.workspace.getConfiguration("vertex");
                await config.update("hasOpenedModeSelector", opened, vscode.ConfigurationTarget.Global);
                break;
            }
            // Checkpoint related messages
            case "checkpointRestore": {
                const commitHash = message.commitHash;
                const ts = message.ts;
                const mode = message.mode;
                if (commitHash) {
                    await this._handleCheckpointRestore(commitHash, ts, mode);
                }
                break;
            }
            case "checkpointDiff": {
                const commitHash = message.commitHash;
                const previousCommitHash = message.previousCommitHash;
                const mode = message.mode;
                if (commitHash) {
                    await this._handleCheckpointDiff(commitHash, previousCommitHash, mode);
                }
                break;
            }
            case "getCheckpointState": {
                this._sendCheckpointState();
                break;
            }
            // Webview initialization
            case "webviewDidLaunch": {
                this._sendTaskHistory();
                break;
            }
            // History related messages
            case "showTaskWithId": {
                const taskId = message.text;
                if (taskId) {
                    await this._handleShowTask(taskId);
                }
                break;
            }
            case "deleteTaskWithId": {
                const taskId = message.text;
                if (taskId) {
                    await this._handleDeleteTask(taskId);
                }
                break;
            }
            case "deleteMultipleTasksWithIds": {
                const taskIds = message.ids;
                if (taskIds && Array.isArray(taskIds)) {
                    await this._handleDeleteMultipleTasks(taskIds);
                }
                break;
            }
            case "exportTaskWithId": {
                const taskId = message.text;
                if (taskId) {
                    await this._handleExportTask(taskId);
                }
                break;
            }
            // Settings related messages
            case "updateSettings": {
                const settings = message.settings;
                if (settings) {
                    this._handleUpdateSettings(settings);
                }
                break;
            }
            case "getSettings": {
                this._sendSettings();
                break;
            }
            case "getSlashCommands": {
                this._sendSlashCommands();
                break;
            }
            case "getSkills": {
                this._sendSkills();
                break;
            }
            case "getPrompts": {
                this._sendPrompts();
                break;
            }
        }
    }
    // ─── 发送消息到 WebView ─────────────────────────────
    _postMessage(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    /**
     * Public method for services (tool-executor, agent-loop) to send messages to webview
     */
    postMessage(message) {
        this._postMessage(message);
    }
    // ─── 发送模式列表到 WebView ─────────────────────────
    _updateModesList() {
        const allModes = (0, modes_1.getAllModes)(this._customModes);
        this._postMessage({
            type: "modesList",
            modes: allModes,
            currentMode: this._currentModeSlug,
        });
    }
    // ─── 发送当前模式摘要到 WebView ─────────────────────
    _sendModeSummary() {
        const summary = (0, modes_1.getModeSummary)(this._currentModeSlug, this._customModes);
        this._postMessage({
            type: "modeSummary",
            summary,
            slug: this._currentModeSlug,
        });
    }
    // ─── 发送 Prompt 预览到 WebView ─────────────────────
    _sendPromptPreview() {
        const mode = (0, modes_1.getModeBySlug)(this._currentModeSlug, this._customModes);
        if (mode) {
            const systemPrompt = (0, prompt_1.buildSystemPrompt)(mode);
            this._postMessage({
                type: "promptPreview",
                content: systemPrompt,
            });
        }
    }
    // ─── 处理用户发送消息 ───────────────────────────────
    async _handleSendMessage(userText) {
        const mode = (0, modes_1.getModeBySlug)(this._currentModeSlug, this._customModes);
        if (!mode)
            return;
        // 读取 API 配置
        const config = vscode.workspace.getConfiguration("vertex");
        const apiKey = config.get("apiKey", "");
        const apiProvider = config.get("apiProvider", "openai");
        const apiModel = this._currentModel || config.get("apiModel", "gpt-4o-mini");
        const apiBase = config.get("apiBase", api_1.DEFAULT_BASE_URLS[apiProvider] || "https://api.openai.com/v1");
        if (!apiKey) {
            // 无 API Key → 展示组装的 Prompt（演示模式）
            const chatContext = (0, prompt_1.buildChatContext)(mode, userText);
            this._postMessage({
                type: "assistantReply",
                content: `## 📋 Demo Mode (No API Key)\n\n### System Prompt:\n\`\`\`\n${chatContext.systemPrompt}\n\`\`\`\n\n### User Message:\n\`\`\`\n${chatContext.userMessage}\n\`\`\`\n\n💡 To enable real LLM calls, set \`vertex.apiKey\` in VS Code Settings.`,
            });
            return;
        }
        // 保存用户消息到持久化
        const persistence = this.getPersistenceService();
        if (persistence) {
            let conversation = persistence.getLastActiveConversation();
            if (!conversation) {
                conversation = persistence.createConversation("New Conversation", this._currentModeSlug);
            }
            persistence.addMessage(conversation.id, {
                role: "user",
                content: userText,
                timestamp: Date.now(),
            });
        }
        // 使用 Agent Loop 调用 LLM（支持工具调用）
        try {
            const apiConfig = {
                provider: apiProvider,
                apiKey,
                baseUrl: apiBase,
                model: apiModel,
            };
            // 运行 Agent Loop（支持多轮工具调用）
            const result = await (0, agent_loop_1.runAgentLoop)({
                mode,
                apiConfig,
                userMessage: userText,
                provider: this,
            });
            // 发送最终结果给 UI
            this._postMessage({
                type: "assistantReply",
                content: result.result,
                metadata: {
                    iterations: result.iterations,
                    toolCalls: result.toolCalls,
                    usage: result.usage,
                },
            });
            // 记录任务到持久化
            if (persistence) {
                const conversation = persistence.getLastActiveConversation();
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
                    });
                }
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this._postMessage({
                type: "assistantReply",
                content: `## ❌ Error\n\nFailed to call API:\n\`\`\`\n${errorMsg}\n\`\`\`\n\nPlease check your API key and model settings.`,
            });
        }
    }
    // ─── Provider 相关方法 ─────────────────────────────────
    _sendProviderInfo() {
        const config = vscode.workspace.getConfiguration("vertex");
        this._postMessage({
            type: "providerInfo",
            provider: this._currentProvider,
            model: this._currentModel,
            apiKey: config.get("apiKey", ""),
            baseUrl: config.get("apiBase", api_1.DEFAULT_BASE_URLS[this._currentProvider] || ""),
        });
    }
    _sendModelsList() {
        const models = api_1.PREDEFINED_MODELS[this._currentProvider] || [];
        this._postMessage({
            type: "modelsList",
            models,
            currentModel: this._currentModel,
        });
    }
    _sendProfilesList() {
        const config = vscode.workspace.getConfiguration("vertex");
        const profiles = config.get("apiProfiles", []);
        this._postMessage({
            type: "profilesList",
            profiles,
        });
    }
    _sendCurrentConfig() {
        const config = vscode.workspace.getConfiguration("vertex");
        this._postMessage({
            type: "currentConfig",
            provider: config.get("apiProvider", "openai"),
            model: config.get("apiModel", "gpt-4o-mini"),
            apiKey: config.get("apiKey", ""),
            baseUrl: config.get("apiBase", ""),
        });
    }
    async _selectProfile(profileName) {
        const config = vscode.workspace.getConfiguration("vertex");
        const profiles = config.get("apiProfiles", []);
        const profile = profiles.find(p => p.name === profileName);
        if (profile) {
            await config.update("apiProvider", profile.provider, vscode.ConfigurationTarget.Global);
            await config.update("apiKey", profile.apiKey, vscode.ConfigurationTarget.Global);
            await config.update("apiBase", profile.baseUrl, vscode.ConfigurationTarget.Global);
            await config.update("apiModel", profile.model, vscode.ConfigurationTarget.Global);
            this._currentProvider = profile.provider;
            this._currentModel = profile.model;
            this._sendProviderInfo();
            this._sendModelsList();
        }
    }
    // ─── Checkpoint 相关方法 ──────────────────────────────
    /**
     * Initialize checkpoint service for a new task
     */
    async _initCheckpointService(taskId) {
        if (!this._enableCheckpoints || !this._extensionContext) {
            return;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }
        const workspaceDir = workspaceFolders[0].uri.fsPath;
        const shadowDir = this._extensionContext.globalStorageUri.fsPath;
        try {
            const options = {
                taskId,
                workspaceDir,
                shadowDir,
                log: (msg) => console.log(`[Checkpoint] ${msg}`),
            };
            this._checkpointService = checkpoints_1.RepoPerTaskCheckpointService.create(options);
            this._currentTaskId = taskId;
            // Listen for checkpoint events
            this._checkpointService.on("initialize", (data) => {
                this._postMessage({
                    type: "checkpointInit",
                    baseHash: data.baseHash,
                    duration: data.duration,
                });
            });
            this._checkpointService.on("checkpoint", (data) => {
                this._postMessage({
                    type: "checkpointSaved",
                    commitHash: data.toHash,
                    fromHash: data.fromHash,
                    duration: data.duration,
                    suppressMessage: data.suppressMessage,
                });
            });
            this._checkpointService.on("restore", (data) => {
                this._postMessage({
                    type: "checkpointRestored",
                    commitHash: data.commitHash,
                    duration: data.duration,
                });
            });
            this._checkpointService.on("error", (data) => {
                console.error(`[Checkpoint] Error: ${data.error.message}`);
                this._postMessage({
                    type: "checkpointError",
                    error: data.error.message,
                });
            });
            // Initialize the shadow git repo
            await this._checkpointService.initShadowGit();
        }
        catch (error) {
            console.error(`[Checkpoint] Failed to initialize: ${error}`);
            this._enableCheckpoints = false;
        }
    }
    /**
     * Save a checkpoint before tool execution
     */
    async saveCheckpoint(message, allowEmpty = false) {
        if (!this._checkpointService || !this._enableCheckpoints) {
            return;
        }
        try {
            await this._checkpointService.saveCheckpoint(message, { allowEmpty });
        }
        catch (error) {
            console.error(`[Checkpoint] Failed to save: ${error}`);
        }
    }
    /**
     * Handle checkpoint restore request from webview
     */
    async _handleCheckpointRestore(commitHash, ts, mode) {
        if (!this._checkpointService) {
            return;
        }
        try {
            await this._checkpointService.restoreCheckpoint(commitHash);
            if (mode === "restore") {
                // In restore mode, we also need to notify the webview to update UI
                this._postMessage({
                    type: "checkpointRestored",
                    commitHash,
                    ts,
                });
            }
        }
        catch (error) {
            console.error(`[Checkpoint] Failed to restore: ${error}`);
            vscode.window.showErrorMessage(`Failed to restore checkpoint: ${error}`);
        }
    }
    /**
     * Handle checkpoint diff request from webview
     */
    async _handleCheckpointDiff(commitHash, previousCommitHash, mode) {
        if (!this._checkpointService) {
            return;
        }
        try {
            const diffs = await this._checkpointService.getDiff({
                from: previousCommitHash,
                to: commitHash,
            });
            if (diffs.length === 0) {
                vscode.window.showInformationMessage("No changes in this checkpoint");
                return;
            }
            // Open VS Code's diff view for each changed file
            for (const diff of diffs) {
                const beforeUri = vscode.Uri.parse(`vertex-diff:before:${diff.paths.relative}`).with({
                    query: Buffer.from(diff.content.before).toString("base64"),
                });
                const afterUri = vscode.Uri.parse(`vertex-diff:after:${diff.paths.relative}`).with({
                    query: Buffer.from(diff.content.after).toString("base64"),
                });
                await vscode.commands.executeCommand("vscode.diff", beforeUri, afterUri, `${diff.paths.relative} (checkpoint diff)`);
            }
        }
        catch (error) {
            console.error(`[Checkpoint] Failed to get diff: ${error}`);
            vscode.window.showErrorMessage(`Failed to get checkpoint diff: ${error}`);
        }
    }
    /**
     * Send current checkpoint state to webview
     */
    _sendCheckpointState() {
        const checkpoints = this._checkpointService?.getCheckpoints() || [];
        this._postMessage({
            type: "checkpointState",
            enabled: this._enableCheckpoints,
            checkpoints,
            baseHash: this._checkpointService?.baseHash,
        });
    }
    /**
     * Enable or disable checkpoints
     */
    setCheckpointsEnabled(enabled) {
        this._enableCheckpoints = enabled;
    }
    /**
     * Get current checkpoint service (for external use)
     */
    getCheckpointService() {
        return this._checkpointService;
    }
    // ─── History 相关方法 ────────────────────────────────────
    /**
     * 发送任务历史到 WebView
     */
    _sendTaskHistory() {
        const persistence = this.getPersistenceService();
        if (persistence) {
            const taskHistory = persistence.getTaskHistory();
            this._postMessage({
                type: "taskHistory",
                taskHistory,
            });
        }
    }
    /**
     * 显示指定任务
     */
    _handleShowTask(taskId) {
        const persistence = this.getPersistenceService();
        if (persistence) {
            const task = persistence.getTask(taskId);
            if (task) {
                this._postMessage({
                    type: "showTask",
                    task,
                });
            }
        }
    }
    /**
     * 删除指定任务
     */
    _handleDeleteTask(taskId) {
        const persistence = this.getPersistenceService();
        if (persistence) {
            persistence.deleteTask(taskId);
            this._sendTaskHistory();
        }
    }
    /**
     * 批量删除任务
     */
    _handleDeleteMultipleTasks(taskIds) {
        const persistence = this.getPersistenceService();
        if (persistence) {
            taskIds.forEach((id) => persistence.deleteTask(id));
            this._sendTaskHistory();
        }
    }
    /**
     * 导出任务
     */
    _handleExportTask(taskId) {
        const persistence = this.getPersistenceService();
        if (persistence) {
            const task = persistence.getTask(taskId);
            if (task) {
                const taskData = JSON.stringify(task, null, 2);
                vscode.workspace.openTextDocument({
                    content: taskData,
                    language: "json",
                }).then((doc) => {
                    vscode.window.showTextDocument(doc);
                });
            }
        }
    }
    // ─── Settings 相关方法 ─────────────────────────────────
    /**
     * 处理设置更新
     */
    _handleUpdateSettings(settings) {
        // AutoApprove
        if (settings.autoApprove !== undefined) {
            this._autoApproveService.updateConfig(settings.autoApprove);
        }
        // SlashCommands
        if (settings.slashCommands !== undefined) {
            this._slashCommandsService = slash_commands_1.SlashCommandsService.fromJSON(settings.slashCommands);
        }
        // Skills
        if (settings.skills !== undefined) {
            this._skillsService = skills_1.SkillsService.fromJSON(settings.skills);
        }
        // ContextManagement
        if (settings.contextManagement !== undefined) {
            this._contextManagementService.updateConfig(settings.contextManagement);
        }
        // Terminal
        if (settings.terminal !== undefined) {
            this._terminalService.updateConfig(settings.terminal);
        }
        // Worktrees
        if (settings.worktrees !== undefined) {
            this._worktreesService.updateConfig(settings.worktrees);
        }
        // Prompts
        if (settings.prompts !== undefined) {
            this._promptsService = prompts_1.PromptsService.fromJSON(settings.prompts);
        }
        // UI
        if (settings.ui !== undefined) {
            this._uiService.updateConfig(settings.ui);
        }
        // Language
        if (settings.language !== undefined) {
            this._languageService.updateConfig(settings.language);
        }
        // Notifications
        if (settings.notifications !== undefined) {
            this._notificationService.updateConfig(settings.notifications);
        }
        // Save to persistence
        const persistence = this.getPersistenceService();
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
            });
        }
    }
    /**
     * 发送所有设置到 WebView
     */
    _sendSettings() {
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
        });
    }
    /**
     * 发送 SlashCommands 到 WebView
     */
    _sendSlashCommands() {
        this._postMessage({
            type: "slashCommands",
            slashCommands: this._slashCommandsService.getAllCommands(),
        });
    }
    /**
     * 发送 Skills 到 WebView
     */
    _sendSkills() {
        this._postMessage({
            type: "skills",
            skills: this._skillsService.getAllSkills(),
        });
    }
    /**
     * 发送 Prompts 到 WebView
     */
    _sendPrompts() {
        this._postMessage({
            type: "prompts",
            prompts: this._promptsService.getAllPrompts(),
        });
    }
    // ─── Chat 交互方法 ─────────────────────────────────────
    /**
     * 搜索文件
     */
    async _handleSearchFiles(query, requestId) {
        if (!query || query.length < 1) {
            this._postMessage({
                type: "fileSearchResults",
                requestId,
                results: [],
            });
            return;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this._postMessage({
                type: "fileSearchResults",
                requestId,
                results: [],
            });
            return;
        }
        try {
            // 使用 VS Code 的 findFiles API 搜索文件
            const pattern = `**/*${query}*`;
            const excludePattern = "**/node_modules/**";
            const files = await vscode.workspace.findFiles(pattern, excludePattern, 50);
            const results = files.map((file) => ({
                path: vscode.workspace.asRelativePath(file),
                type: file.fsPath.endsWith("/") ? "folder" : "file",
            }));
            this._postMessage({
                type: "fileSearchResults",
                requestId,
                results,
            });
        }
        catch (error) {
            console.error("[SearchFiles] Error:", error);
            this._postMessage({
                type: "fileSearchResults",
                requestId,
                results: [],
            });
        }
    }
    /**
     * 增强提示词（使用 LLM 改进用户输入）
     */
    async _handleEnhancePrompt(prompt) {
        if (!prompt || prompt.trim().length === 0) {
            this._postMessage({
                type: "enhancedPrompt",
                text: prompt,
            });
            return;
        }
        const config = vscode.workspace.getConfiguration("vertex");
        const apiKey = config.get("apiKey", "");
        const apiProvider = config.get("apiProvider", "openai");
        const apiModel = config.get("apiModel", "gpt-4o-mini");
        const apiBase = config.get("apiBase", api_1.DEFAULT_BASE_URLS[apiProvider] || "https://api.openai.com/v1");
        if (!apiKey) {
            // 无 API Key，直接返回原文本
            this._postMessage({
                type: "enhancedPrompt",
                text: prompt,
            });
            return;
        }
        try {
            const apiConfig = {
                provider: apiProvider,
                apiKey,
                baseUrl: apiBase,
                model: apiModel,
            };
            const provider = (0, api_1.createApiProvider)(apiConfig);
            const enhanceSystemPrompt = `You are a helpful assistant that improves and clarifies user prompts. 
Your task is to:
1. Make the prompt more specific and clear
2. Add relevant context if helpful
3. Maintain the original intent
4. Keep it concise

Only output the improved prompt, nothing else.`;
            const messages = [
                { role: "system", content: enhanceSystemPrompt },
                { role: "user", content: prompt },
            ];
            const response = await provider.chat(messages);
            this._postMessage({
                type: "enhancedPrompt",
                text: response.content || prompt,
            });
        }
        catch (error) {
            console.error("[EnhancePrompt] Error:", error);
            // 出错时返回原文本
            this._postMessage({
                type: "enhancedPrompt",
                text: prompt,
            });
        }
    }
    /**
     * 发送命令列表到 WebView
     */
    _sendCommands() {
        const commands = this._slashCommandsService.getAllCommands();
        this._postMessage({
            type: "commands",
            commands,
        });
    }
    /**
     * 按 ID 加载 API 配置
     */
    async _loadApiConfigurationById(configId) {
        const config = vscode.workspace.getConfiguration("vertex");
        const profiles = config.get("apiProfiles", []);
        // 查找匹配的配置
        const profile = profiles.find((p) => p.name === configId);
        if (profile) {
            // 更新当前配置
            await config.update("apiProvider", profile.provider, vscode.ConfigurationTarget.Global);
            await config.update("apiKey", profile.apiKey, vscode.ConfigurationTarget.Global);
            await config.update("apiBase", profile.baseUrl, vscode.ConfigurationTarget.Global);
            await config.update("apiModel", profile.model, vscode.ConfigurationTarget.Global);
            await config.update("currentApiConfigName", profile.name, vscode.ConfigurationTarget.Global);
            // 更新内部状态
            this._currentProvider = profile.provider;
            this._currentModel = profile.model;
            // 发送更新后的配置到 WebView
            this._sendProviderInfo();
            this._sendCurrentConfig();
        }
    }
    // ─── 加载 WebView HTML 内容 ──────────────────────────
    _getHtmlForWebview(webview) {
        const distPath = path.join(this._extensionUri.fsPath, "webview-ui", "dist");
        const htmlPath = path.join(distPath, "index.html");
        let html = fs.readFileSync(htmlPath, "utf8");
        const csp = [
            "default-src 'none'",
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `script-src ${webview.cspSource} 'unsafe-inline'`,
            `img-src ${webview.cspSource} data:`,
            `font-src ${webview.cspSource} data:`,
        ].join("; ");
        html = html.replace(/<meta charset="UTF-8" \/>/, `<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />`);
        html = html.replace(/(<(?:script|link)[^>]+(?:src|href)=["'])([^"']+)(["'][^>]*>)/g, (_, prefix, assetPath, suffix) => {
            const normalizedPath = assetPath.replace(/^\.\//, "");
            const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, normalizedPath)));
            return `${prefix}${assetUri.toString()}${suffix}`;
        });
        return html;
    }
}
exports.SidebarViewProvider = SidebarViewProvider;
SidebarViewProvider.viewType = "vertex.sidebarView";
//# sourceMappingURL=SidebarViewProvider.js.map