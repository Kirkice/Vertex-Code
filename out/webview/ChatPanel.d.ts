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
import * as vscode from "vscode";
import type { ModeConfig } from "../types/modes";
export declare class ChatPanel {
    /** 当前活跃的面板实例 */
    static currentPanel: ChatPanel | undefined;
    /** WebView 面板 */
    private readonly _panel;
    /** 扩展资源 URI */
    private readonly _extensionUri;
    /** 自定义模式列表 */
    private _customModes;
    /** 当前选中的模式 slug */
    private _currentModeSlug;
    /** 当前选中的 API Provider */
    private _currentProvider;
    /** 当前选中的模型 */
    private _currentModel;
    /** 监听器销毁列表 */
    private readonly _disposables;
    static createOrShow(extensionUri: vscode.Uri, customModes: ModeConfig[]): ChatPanel;
    private constructor();
    updateCustomModes(customModes: ModeConfig[]): void;
    private _handleWebviewMessage;
    private _updateModesList;
    private _sendModeSummary;
    private _sendPromptPreview;
    private _handleSendMessage;
    private _getWebviewContent;
    private _dispose;
    dispose(): void;
    /** 发送 Provider 信息到 WebView */
    private _sendProviderInfo;
    /** 发送模型列表到 WebView */
    private _sendModelsList;
    /** 发送 Profile 列表到 WebView */
    private _sendProfilesList;
    /** 发送当前配置到 WebView */
    private _sendCurrentConfig;
    /** 选择 Profile */
    private _selectProfile;
}
//# sourceMappingURL=ChatPanel.d.ts.map