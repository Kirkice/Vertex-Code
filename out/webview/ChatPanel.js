"use strict";
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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const modes_1 = require("../core/modes");
const prompt_1 = require("../core/prompt");
const api_1 = require("../core/api");
// ─── ChatPanel 类 ──────────────────────────────────────
class ChatPanel {
    // ─── 创建或显示面板 ────────────────────────────────
    static createOrShow(extensionUri, customModes) {
        // 如果已有面板，则更新并显示
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._customModes = customModes;
            ChatPanel.currentPanel._updateModesList();
            ChatPanel.currentPanel._panel.reveal();
            return ChatPanel.currentPanel;
        }
        // 否则创建新面板
        const panel = vscode.window.createWebviewPanel("vertexChat", "Vertex Chat", vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(extensionUri.fsPath, "webview-ui", "dist")),
            ],
        });
        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, customModes);
        return ChatPanel.currentPanel;
    }
    // ─── 构造函数 ──────────────────────────────────────
    constructor(panel, extensionUri, customModes) {
        /** 当前选中的模式 slug */
        this._currentModeSlug = modes_1.defaultModeSlug;
        /** 当前选中的 API Provider */
        this._currentProvider = "openai";
        /** 当前选中的模型 */
        this._currentModel = "gpt-4o-mini";
        /** 监听器销毁列表 */
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._customModes = customModes;
        // 设置 WebView 内容
        this._panel.webview.html = this._getWebviewContent();
        // 监听 WebView 消息
        this._panel.webview.onDidReceiveMessage(this._handleWebviewMessage.bind(this), null, this._disposables);
        // 面板关闭时清理
        this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
        // 初始化：发送模式列表到 WebView
        this._updateModesList();
    }
    // ─── 更新自定义模式 ─────────────────────────────────
    updateCustomModes(customModes) {
        this._customModes = customModes;
        this._updateModesList();
    }
    // ─── 处理 WebView 发来的消息 ───────────────────────
    async _handleWebviewMessage(message) {
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
                    this._selectProfile(message.profileName);
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
        }
    }
    // ─── 发送模式列表到 WebView ─────────────────────────
    _updateModesList() {
        const allModes = (0, modes_1.getAllModes)(this._customModes);
        this._panel.webview.postMessage({
            type: "modesList",
            modes: allModes,
            currentMode: this._currentModeSlug,
        });
    }
    // ─── 发送当前模式摘要到 WebView ─────────────────────
    _sendModeSummary() {
        const summary = (0, modes_1.getModeSummary)(this._currentModeSlug, this._customModes);
        this._panel.webview.postMessage({
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
            this._panel.webview.postMessage({
                type: "promptPreview",
                content: systemPrompt,
            });
        }
    }
    // ─── 处理用户发送消息 ───────────────────────────────
    async _handleSendMessage(userText) {
        const mode = (0, modes_1.getModeBySlug)(this._currentModeSlug, this._customModes);
        if (!mode) {
            return;
        }
        // 读取 API 配置
        const config = vscode.workspace.getConfiguration("vertex");
        const apiKey = config.get("apiKey", "");
        const apiProvider = config.get("apiProvider", "openai");
        const apiModel = this._currentModel || config.get("apiModel", "gpt-4o-mini");
        const apiBase = config.get("apiBase", api_1.DEFAULT_BASE_URLS[apiProvider] || "https://api.openai.com/v1");
        if (!apiKey) {
            // 无 API Key → 展示组装的 Prompt（演示模式）
            const chatContext = (0, prompt_1.buildChatContext)(mode, userText);
            this._panel.webview.postMessage({
                type: "assistantReply",
                content: `## 📋 Demo Mode (No API Key)\n\n### System Prompt:\n\`\`\`\n${chatContext.systemPrompt}\n\`\`\`\n\n### User Message:\n\`\`\`\n${chatContext.userMessage}\n\`\`\`\n\n💡 To enable real LLM calls, set \`vertex.apiKey\` in VS Code Settings.`,
            });
            return;
        }
        // 使用 API Provider 调用 LLM
        try {
            const chatContext = (0, prompt_1.buildChatContext)(mode, userText);
            const apiConfig = {
                provider: apiProvider,
                apiKey,
                baseUrl: apiBase,
                model: apiModel,
            };
            const provider = (0, api_1.createApiProvider)(apiConfig);
            const messages = [
                { role: "system", content: chatContext.systemPrompt },
                { role: "user", content: chatContext.userMessage },
            ];
            const result = await provider.chat(messages);
            this._panel.webview.postMessage({
                type: "assistantReply",
                content: result.content,
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this._panel.webview.postMessage({
                type: "assistantReply",
                content: `## ❌ Error\n\nFailed to call API:\n\`\`\`\n${errorMsg}\n\`\`\`\n\nPlease check your API key and model settings.`,
            });
        }
    }
    // ─── 加载 WebView HTML 内容 ──────────────────────────
    _getWebviewContent() {
        // 构建产物路径
        const webviewUiDistPath = path.join(this._extensionUri.fsPath, "webview-ui", "dist");
        const htmlPath = path.join(webviewUiDistPath, "index.html");
        // 读取 Vite 构建后的 HTML 文件
        let html = fs.readFileSync(htmlPath, "utf8");
        // WebView 安全 URI
        const webview = this._panel.webview;
        // CSP 内容
        const csp = [
            "default-src 'none'",
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `script-src ${webview.cspSource}`,
            `img-src ${webview.cspSource} data:`,
            `font-src ${webview.cspSource}`,
            `connect-src ${webview.cspSource} https: http:`,
        ].join("; ");
        // 注入 CSP 并把 Vite 构建产物中的静态资源路径转换为 WebView 安全 URI
        html = html.replace("</head>", `<meta http-equiv="Content-Security-Policy" content="${csp}" />\n</head>`);
        html = html.replace(/(src|href)=(['"])(\/?(?:\.\/)?assets\/[^'"]+)\2/g, (_match, attr, quote, assetPath) => {
            const normalizedAssetPath = String(assetPath).replace(/^\//, "");
            const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewUiDistPath, normalizedAssetPath)));
            return `${attr}=${quote}${assetUri.toString()}${quote}`;
        });
        return html;
    }
    // ─── 清理资源 ───────────────────────────────────────
    _dispose() {
        ChatPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    dispose() {
        this._dispose();
    }
    // ─── Provider 相关方法 ─────────────────────────────────
    /** 发送 Provider 信息到 WebView */
    _sendProviderInfo() {
        const config = vscode.workspace.getConfiguration("vertex");
        this._panel.webview.postMessage({
            type: "providerInfo",
            provider: this._currentProvider,
            model: this._currentModel,
            apiKey: config.get("apiKey", ""),
            baseUrl: config.get("apiBase", api_1.DEFAULT_BASE_URLS[this._currentProvider] || ""),
        });
    }
    /** 发送模型列表到 WebView */
    _sendModelsList() {
        const models = api_1.PREDEFINED_MODELS[this._currentProvider] || [];
        this._panel.webview.postMessage({
            type: "modelsList",
            models,
            currentModel: this._currentModel,
        });
    }
    /** 发送 Profile 列表到 WebView */
    _sendProfilesList() {
        const config = vscode.workspace.getConfiguration("vertex");
        const profiles = config.get("apiProfiles", []);
        this._panel.webview.postMessage({
            type: "profilesList",
            profiles,
        });
    }
    /** 发送当前配置到 WebView */
    _sendCurrentConfig() {
        const config = vscode.workspace.getConfiguration("vertex");
        this._panel.webview.postMessage({
            type: "currentConfig",
            provider: config.get("apiProvider", "openai"),
            model: config.get("apiModel", "gpt-4o-mini"),
            apiKey: config.get("apiKey", ""),
            baseUrl: config.get("apiBase", ""),
        });
    }
    /** 选择 Profile */
    async _selectProfile(profileName) {
        const config = vscode.workspace.getConfiguration("vertex");
        const profiles = config.get("apiProfiles", []);
        const profile = profiles.find(p => p.name === profileName);
        if (profile) {
            // 更新当前配置
            await config.update("apiProvider", profile.provider, vscode.ConfigurationTarget.Global);
            await config.update("apiKey", profile.apiKey, vscode.ConfigurationTarget.Global);
            await config.update("apiBase", profile.baseUrl, vscode.ConfigurationTarget.Global);
            await config.update("apiModel", profile.model, vscode.ConfigurationTarget.Global);
            // 更新内部状态
            this._currentProvider = profile.provider;
            this._currentModel = profile.model;
            // 发送更新
            this._sendProviderInfo();
            this._sendModelsList();
        }
    }
}
exports.ChatPanel = ChatPanel;
//# sourceMappingURL=ChatPanel.js.map