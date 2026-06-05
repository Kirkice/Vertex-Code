"use strict";
/**
 * ============================================================
 *  Vertex - 扩展入口
 *  对应 Vertex 的 src/extension.ts + src/activate/
 * ============================================================
 *
 *  核心职责：
 *  1. 注册侧边栏视图（vertex.sidebarView）
 *  2. 注册命令（vertex.openChat 等）
 *  3. 监听设置变更（customModes 变化时更新 WebView）
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const SidebarViewProvider_1 = require("./webview/SidebarViewProvider");
// ─── 激活 ──────────────────────────────────────────────
function activate(context) {
    // 获取自定义模式
    const customModes = getCustomModesFromSettings();
    // 创建侧边栏 Provider
    const sidebarProvider = new SidebarViewProvider_1.SidebarViewProvider(context.extensionUri, customModes, context);
    // 注册侧边栏视图
    const sidebarRegistration = vscode.window.registerWebviewViewProvider(SidebarViewProvider_1.SidebarViewProvider.viewType, sidebarProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
    });
    context.subscriptions.push(sidebarRegistration);
    // 初始化所有服务
    sidebarProvider.initializeServices().catch((err) => {
        console.error("[Vertex] Failed to initialize services:", err);
    });
    // 注册 dispose 清理
    context.subscriptions.push({
        dispose: () => {
            sidebarProvider.dispose().catch((err) => {
                console.error("[Vertex] Failed to dispose services:", err);
            });
        },
    });
    // 注册 openChat 命令（聚焦到侧边栏）
    const openChatCommand = vscode.commands.registerCommand("vertex.openChat", () => {
        // 执行 workbench.action.focusAuxiliaryBar 聚焦到侧边栏
        vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar");
        // 聚焦到 Vertex 侧边栏视图
        vscode.commands.executeCommand("vertex.sidebarView.focus");
    });
    context.subscriptions.push(openChatCommand);
    // 注册 clearChat 命令
    const clearChatCommand = vscode.commands.registerCommand("vertex.clearChat", () => {
        sidebarProvider.clearChat();
    });
    context.subscriptions.push(clearChatCommand);
    // 注册 newChat 命令 (NewTask button)
    const newChatCommand = vscode.commands.registerCommand("vertex.newChat", () => {
        sidebarProvider.clearChat();
    });
    context.subscriptions.push(newChatCommand);
    // 注册 settingsButtonClicked 命令
    const settingsCommand = vscode.commands.registerCommand("vertex.settingsButtonClicked", () => {
        sidebarProvider.postMessage({ type: "action", action: "settingsButtonClicked" });
    });
    context.subscriptions.push(settingsCommand);
    // 注册 historyButtonClicked 命令
    const historyCommand = vscode.commands.registerCommand("vertex.historyButtonClicked", () => {
        sidebarProvider.postMessage({ type: "action", action: "historyButtonClicked" });
    });
    context.subscriptions.push(historyCommand);
    // 注册 popoutButtonClicked 命令
    const popoutCommand = vscode.commands.registerCommand("vertex.popoutButtonClicked", () => {
        // TODO: Implement popout to editor functionality
        vscode.window.showInformationMessage("Popout functionality coming soon!");
    });
    context.subscriptions.push(popoutCommand);
    // 监听设置变更
    const settingsWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("vertex.customModes")) {
            const newCustomModes = getCustomModesFromSettings();
            sidebarProvider.updateCustomModes(newCustomModes);
        }
    });
    context.subscriptions.push(settingsWatcher);
}
// ─── 从 VS Code 设置读取自定义模式 ──────────────────────
function getCustomModesFromSettings() {
    const config = vscode.workspace.getConfiguration("vertex");
    const rawModes = config.get("customModes", []);
    // 基本校验：确保每个模式至少有 slug、name、roleDefinition、toolGroups
    return rawModes.filter((mode) => mode.slug &&
        mode.name &&
        mode.roleDefinition &&
        mode.toolGroups &&
        mode.toolGroups.length > 0);
}
// ─── 停用 ──────────────────────────────────────────────
function deactivate() {
    // 清理工作由 VS Code 自动处理
}
//# sourceMappingURL=extension.js.map