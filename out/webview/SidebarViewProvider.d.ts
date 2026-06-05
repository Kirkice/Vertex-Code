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
import * as vscode from "vscode";
import type { ModeConfig } from "../types/modes";
import { RepoPerTaskCheckpointService } from "../services/checkpoints";
import { McpServerManager } from "../services/mcp";
import { TaskManager } from "../services/tasks";
import { BrowserService } from "../services/browser";
import { PersistenceService } from "../services/persistence";
import { TelemetryService } from "../services/telemetry";
import { FileIgnoreService } from "../services/file-ignore";
import { AutoApproveService } from "../services/auto-approve";
import { SlashCommandsService } from "../services/slash-commands";
import { SkillsService } from "../services/skills";
import { ContextManagementService } from "../services/context-management";
import { TerminalService } from "../services/terminal";
import { WorktreesService } from "../services/worktrees";
import { PromptsService } from "../services/prompts";
import { UIService } from "../services/ui";
import { LanguageService } from "../services/language";
import { NotificationService } from "../services/notifications";
export declare class SidebarViewProvider implements vscode.WebviewViewProvider {
    static readonly viewType = "vertex.sidebarView";
    private _view?;
    private _extensionUri;
    private _extensionContext?;
    private _customModes;
    private _currentModeSlug;
    private _currentProvider;
    private _currentModel;
    private _checkpointService?;
    private _mcpManager?;
    private _taskManager;
    private _browserService?;
    private _persistenceService?;
    private _telemetryService;
    private _fileIgnoreService?;
    private _autoApproveService;
    private _slashCommandsService;
    private _skillsService;
    private _contextManagementService;
    private _terminalService;
    private _worktreesService;
    private _promptsService;
    private _uiService;
    private _languageService;
    private _notificationService;
    private _enableCheckpoints;
    private _currentTaskId?;
    constructor(extensionUri: vscode.Uri, customModes: ModeConfig[], context?: vscode.ExtensionContext);
    initializeServices(): Promise<void>;
    dispose(): Promise<void>;
    getTaskManager(): TaskManager;
    getMcpManager(): McpServerManager | undefined;
    getBrowserService(): BrowserService | undefined;
    getPersistenceService(): PersistenceService | undefined;
    getTelemetryService(): TelemetryService;
    getFileIgnoreService(): FileIgnoreService | undefined;
    getAutoApproveService(): AutoApproveService;
    getSlashCommandsService(): SlashCommandsService;
    getSkillsService(): SkillsService;
    getContextManagementService(): ContextManagementService;
    getTerminalService(): TerminalService;
    getWorktreesService(): WorktreesService;
    getPromptsService(): PromptsService;
    getUIService(): UIService;
    getLanguageService(): LanguageService;
    getNotificationService(): NotificationService;
    updateCustomModes(customModes: ModeConfig[]): void;
    clearChat(): void;
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    private _handleWebviewMessage;
    private _postMessage;
    /**
     * Public method for services (tool-executor, agent-loop) to send messages to webview
     */
    postMessage(message: unknown): void;
    private _updateModesList;
    private _sendModeSummary;
    private _sendPromptPreview;
    private _handleSendMessage;
    private _sendProviderInfo;
    private _sendModelsList;
    private _sendProfilesList;
    private _sendCurrentConfig;
    private _selectProfile;
    /**
     * Initialize checkpoint service for a new task
     */
    private _initCheckpointService;
    /**
     * Save a checkpoint before tool execution
     */
    saveCheckpoint(message: string, allowEmpty?: boolean): Promise<void>;
    /**
     * Handle checkpoint restore request from webview
     */
    private _handleCheckpointRestore;
    /**
     * Handle checkpoint diff request from webview
     */
    private _handleCheckpointDiff;
    /**
     * Send current checkpoint state to webview
     */
    private _sendCheckpointState;
    /**
     * Enable or disable checkpoints
     */
    setCheckpointsEnabled(enabled: boolean): void;
    /**
     * Get current checkpoint service (for external use)
     */
    getCheckpointService(): RepoPerTaskCheckpointService | undefined;
    /**
     * 发送任务历史到 WebView
     */
    private _sendTaskHistory;
    /**
     * 显示指定任务
     */
    private _handleShowTask;
    /**
     * 删除指定任务
     */
    private _handleDeleteTask;
    /**
     * 批量删除任务
     */
    private _handleDeleteMultipleTasks;
    /**
     * 导出任务
     */
    private _handleExportTask;
    /**
     * 处理设置更新
     */
    private _handleUpdateSettings;
    /**
     * 发送所有设置到 WebView
     */
    private _sendSettings;
    /**
     * 发送 SlashCommands 到 WebView
     */
    private _sendSlashCommands;
    /**
     * 发送 Skills 到 WebView
     */
    private _sendSkills;
    /**
     * 发送 Prompts 到 WebView
     */
    private _sendPrompts;
    /**
     * 搜索文件
     */
    private _handleSearchFiles;
    /**
     * 增强提示词（使用 LLM 改进用户输入）
     */
    private _handleEnhancePrompt;
    /**
     * 发送命令列表到 WebView
     */
    private _sendCommands;
    /**
     * 按 ID 加载 API 配置
     */
    private _loadApiConfigurationById;
    private _getHtmlForWebview;
}
//# sourceMappingURL=SidebarViewProvider.d.ts.map