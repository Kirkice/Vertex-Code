import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import './ContextWindowProgress.css';
/**
 * 上下文窗口进度条组件
 * 显示当前对话使用的 token 数量，接近限制时发出警告
 */
export const ContextWindowProgress = ({ usedTokens, maxTokens, isVisible = true }) => {
    if (!isVisible)
        return null;
    const percentage = Math.min((usedTokens / maxTokens) * 100, 100);
    const isWarning = percentage >= 80;
    const isDanger = percentage >= 95;
    const formatTokens = (tokens) => {
        if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}k`;
        }
        return tokens.toString();
    };
    const getStatusColor = () => {
        if (isDanger)
            return 'var(--vscode-errorForeground, #f48771)';
        if (isWarning)
            return 'var(--vscode-editorWarning-foreground, #cca700)';
        return 'var(--vscode-progressBar-background, #0e70c0)';
    };
    return (_jsxs("div", { className: `context-window-progress ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`, children: [_jsxs("div", { className: "progress-header", children: [_jsxs("div", { className: "progress-label", children: [_jsx("span", { className: "label-icon", children: "\uD83D\uDCCA" }), _jsx("span", { className: "label-text", children: "\u4E0A\u4E0B\u6587\u7A97\u53E3" })] }), _jsxs("div", { className: "progress-stats", children: [_jsx("span", { className: "stats-used", children: formatTokens(usedTokens) }), _jsx("span", { className: "stats-separator", children: "/" }), _jsx("span", { className: "stats-max", children: formatTokens(maxTokens) }), _jsxs("span", { className: "stats-percentage", children: [percentage.toFixed(1), "%"] })] })] }), _jsx("div", { className: "progress-bar-container", children: _jsx("div", { className: "progress-bar-fill", style: {
                        width: `${percentage}%`,
                        backgroundColor: getStatusColor()
                    } }) }), isWarning && (_jsx("div", { className: "progress-warning", children: isDanger ? (_jsx(_Fragment, { children: "\u26A0\uFE0F \u4E0A\u4E0B\u6587\u7A97\u53E3\u5373\u5C06\u6EE1\uFF0C\u5EFA\u8BAE\u5F00\u59CB\u65B0\u5BF9\u8BDD" })) : (_jsx(_Fragment, { children: "\uD83D\uDCA1 \u4E0A\u4E0B\u6587\u4F7F\u7528\u7387\u8F83\u9AD8\uFF0C\u53EF\u80FD\u5F71\u54CD\u56DE\u590D\u8D28\u91CF" })) }))] }));
};
