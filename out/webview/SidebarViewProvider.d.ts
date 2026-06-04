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
import * as vscode from "vscode";
import type { ModeConfig } from "../types/modes";
export declare class SidebarViewProvider implements vscode.WebviewViewProvider {
    static readonly viewType = "vertex.sidebarView";
    private _view?;
    private _extensionUri;
    private _customModes;
    private _currentModeSlug;
    private _currentProvider;
    private _currentModel;
    constructor(extensionUri: vscode.Uri, customModes: ModeConfig[]);
    updateCustomModes(customModes: ModeConfig[]): void;
    clearChat(): void;
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    private _handleWebviewMessage;
    private _postMessage;
    private _updateModesList;
    private _sendModeSummary;
    private _sendPromptPreview;
    private _handleSendMessage;
    private _sendProviderInfo;
    private _sendModelsList;
    private _sendProfilesList;
    private _sendCurrentConfig;
    private _selectProfile;
    private _getHtmlForWebview;
}
//# sourceMappingURL=SidebarViewProvider.d.ts.map