"use strict";
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
// ─── SidebarViewProvider 类 ──────────────────────────────
class SidebarViewProvider {
    constructor(extensionUri, customModes) {
        this._currentModeSlug = modes_1.defaultModeSlug;
        this._currentProvider = "openai";
        this._currentModel = "gpt-4o-mini";
        this._extensionUri = extensionUri;
        this._customModes = customModes;
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
        }
    }
    // ─── 发送消息到 WebView ─────────────────────────────
    _postMessage(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
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
            this._postMessage({
                type: "assistantReply",
                content: result.content,
            });
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
            `font-src ${webview.cspSource}`,
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