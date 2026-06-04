import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import './FileChangesPanel.css';
/**
 * 文件变更面板组件
 * 显示 AI 修改的文件列表，支持展开查看 diff
 */
export const FileChangesPanel = ({ changes, onApprove, onReject, onApproveAll, onRejectAll, isVisible = true }) => {
    const [expandedFiles, setExpandedFiles] = useState(new Set());
    const [isCollapsed, setIsCollapsed] = useState(false);
    if (!isVisible || changes.length === 0)
        return null;
    const toggleFile = (filename) => {
        const newExpanded = new Set(expandedFiles);
        if (newExpanded.has(filename)) {
            newExpanded.delete(filename);
        }
        else {
            newExpanded.add(filename);
        }
        setExpandedFiles(newExpanded);
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'modified': return 'M';
            case 'added': return 'A';
            case 'deleted': return 'D';
            case 'renamed': return 'R';
            default: return '?';
        }
    };
    const getStatusClass = (status) => {
        switch (status) {
            case 'modified': return 'status-modified';
            case 'added': return 'status-added';
            case 'deleted': return 'status-deleted';
            case 'renamed': return 'status-renamed';
            default: return '';
        }
    };
    const totalAdditions = changes.reduce((sum, c) => sum + (c.additions || 0), 0);
    const totalDeletions = changes.reduce((sum, c) => sum + (c.deletions || 0), 0);
    return (_jsxs("div", { className: "file-changes-panel", children: [_jsxs("div", { className: "panel-header", onClick: () => setIsCollapsed(!isCollapsed), children: [_jsxs("div", { className: "header-left", children: [_jsx("span", { className: `collapse-icon ${isCollapsed ? 'collapsed' : ''}`, children: "\u25BC" }), _jsx("span", { className: "header-title", children: "\u6587\u4EF6\u53D8\u66F4" }), _jsxs("span", { className: "file-count", children: [changes.length, " \u4E2A\u6587\u4EF6"] })] }), _jsxs("div", { className: "header-stats", children: [_jsxs("span", { className: "additions", children: ["+", totalAdditions] }), _jsxs("span", { className: "deletions", children: ["-", totalDeletions] })] })] }), !isCollapsed && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "panel-actions", children: [onApproveAll && (_jsx("button", { className: "action-btn approve-all", onClick: onApproveAll, children: "\u2713 \u5168\u90E8\u63A5\u53D7" })), onRejectAll && (_jsx("button", { className: "action-btn reject-all", onClick: onRejectAll, children: "\u2715 \u5168\u90E8\u62D2\u7EDD" }))] }), _jsx("div", { className: "file-list", children: changes.map((change, index) => (_jsxs("div", { className: "file-item", children: [_jsxs("div", { className: "file-header", onClick: () => toggleFile(change.filename), children: [_jsx("span", { className: `file-status ${getStatusClass(change.status)}`, children: getStatusIcon(change.status) }), _jsx("span", { className: "file-name", children: change.filename }), _jsxs("div", { className: "file-stats", children: [change.additions !== undefined && (_jsxs("span", { className: "file-additions", children: ["+", change.additions] })), change.deletions !== undefined && (_jsxs("span", { className: "file-deletions", children: ["-", change.deletions] }))] })] }), expandedFiles.has(change.filename) && change.diff && (_jsx("div", { className: "file-diff", children: _jsx("pre", { className: "diff-content", children: change.diff }) })), (onApprove || onReject) && (_jsxs("div", { className: "file-actions", children: [onApprove && (_jsx("button", { className: "file-action-btn approve", onClick: () => onApprove(change.filename), children: "\u63A5\u53D7" })), onReject && (_jsx("button", { className: "file-action-btn reject", onClick: () => onReject(change.filename), children: "\u62D2\u7EDD" }))] }))] }, index))) })] }))] }));
};
