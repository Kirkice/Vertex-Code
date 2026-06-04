import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './BatchDiffApproval.css';
/**
 * 批量差异批准组件
 * 支持一次性批准/拒绝多个文件变更
 */
export const BatchDiffApproval = ({ changes, onApprove, onReject }) => {
    const [selectedPaths, setSelectedPaths] = useState(new Set(changes.map(c => c.path)));
    const [expandedPaths, setExpandedPaths] = useState(new Set());
    const allSelected = selectedPaths.size === changes.length;
    const someSelected = selectedPaths.size > 0 && selectedPaths.size < changes.length;
    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedPaths(new Set());
        }
        else {
            setSelectedPaths(new Set(changes.map(c => c.path)));
        }
    };
    const handleTogglePath = (path) => {
        const newSelected = new Set(selectedPaths);
        if (newSelected.has(path)) {
            newSelected.delete(path);
        }
        else {
            newSelected.add(path);
        }
        setSelectedPaths(newSelected);
    };
    const handleToggleExpand = (path) => {
        const newExpanded = new Set(expandedPaths);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        }
        else {
            newExpanded.add(path);
        }
        setExpandedPaths(newExpanded);
    };
    const handleApprove = () => {
        onApprove(Array.from(selectedPaths));
    };
    const handleReject = () => {
        onReject(Array.from(selectedPaths));
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'added':
                return _jsx("span", { className: "status-icon added", children: "+" });
            case 'modified':
                return _jsx("span", { className: "status-icon modified", children: "~" });
            case 'deleted':
                return _jsx("span", { className: "status-icon deleted", children: "\u2212" });
        }
    };
    return (_jsxs("div", { className: "batch-diff-approval", children: [_jsxs("div", { className: "approval-header", children: [_jsxs("div", { className: "header-left", children: [_jsx("input", { type: "checkbox", checked: allSelected, ref: el => {
                                    if (el)
                                        el.indeterminate = someSelected;
                                }, onChange: handleSelectAll, className: "select-all-checkbox" }), _jsx("span", { className: "header-title", children: "\u6587\u4EF6\u53D8\u66F4" }), _jsxs("span", { className: "header-count", children: [selectedPaths.size, " / ", changes.length, " \u4E2A\u6587\u4EF6"] })] }), _jsxs("div", { className: "header-actions", children: [_jsx("button", { onClick: handleApprove, disabled: selectedPaths.size === 0, className: "approve-button", children: "\u2713 \u6279\u51C6\u9009\u4E2D" }), _jsx("button", { onClick: handleReject, disabled: selectedPaths.size === 0, className: "reject-button", children: "\u2715 \u62D2\u7EDD\u9009\u4E2D" })] })] }), _jsx("div", { className: "approval-list", children: changes.map((change) => (_jsxs("div", { className: "approval-item", children: [_jsxs("div", { className: "item-header", children: [_jsx("input", { type: "checkbox", checked: selectedPaths.has(change.path), onChange: () => handleTogglePath(change.path), className: "item-checkbox" }), getStatusIcon(change.status), _jsx("span", { className: "item-path", title: change.path, children: change.path }), _jsxs("span", { className: "item-stats", children: [change.additions !== undefined && change.additions > 0 && (_jsxs("span", { className: "additions", children: ["+", change.additions] })), change.deletions !== undefined && change.deletions > 0 && (_jsxs("span", { className: "deletions", children: ["-", change.deletions] }))] }), change.diff && (_jsx("button", { onClick: () => handleToggleExpand(change.path), className: "expand-button", children: expandedPaths.has(change.path) ? '收起' : '查看' }))] }), expandedPaths.has(change.path) && change.diff && (_jsx("div", { className: "item-diff", children: _jsx("pre", { children: change.diff }) }))] }, change.path))) })] }));
};
