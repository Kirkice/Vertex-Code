import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './ReasoningBlock.css';
/**
 * 推理过程展示组件
 * 显示 AI 的思考过程，支持折叠/展开
 */
export const ReasoningBlock = ({ content, isExpanded: controlledExpanded, onToggle }) => {
    const [internalExpanded, setInternalExpanded] = useState(false);
    // 支持受控和非受控模式
    const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
    const handleToggle = () => {
        const newExpanded = !isExpanded;
        if (onToggle) {
            onToggle(newExpanded);
        }
        else {
            setInternalExpanded(newExpanded);
        }
    };
    // 计算内容行数和字符数
    const lineCount = content.split('\n').length;
    const charCount = content.length;
    return (_jsxs("div", { className: `reasoning-block ${isExpanded ? 'expanded' : 'collapsed'}`, children: [_jsxs("div", { className: "reasoning-header", onClick: handleToggle, children: [_jsxs("div", { className: "header-left", children: [_jsx("span", { className: "reasoning-icon", children: "\uD83E\uDDE0" }), _jsx("span", { className: "reasoning-title", children: "\u601D\u8003\u8FC7\u7A0B" }), _jsxs("span", { className: "reasoning-stats", children: [lineCount, " \u884C \u00B7 ", charCount, " \u5B57\u7B26"] })] }), _jsx("span", { className: `expand-icon ${isExpanded ? 'expanded' : ''}`, children: isExpanded ? '▼' : '▶' })] }), isExpanded && (_jsx("div", { className: "reasoning-content", children: _jsx("pre", { className: "reasoning-text", children: content }) }))] }));
};
/**
 * 从消息内容中提取推理块
 * 支持 ```reasoning 代码块格式
 */
export function extractReasoningBlocks(content) {
    const reasoningPattern = /```reasoning\n([\s\S]*?)```/g;
    const reasoningBlocks = [];
    let mainContent = content;
    let match;
    while ((match = reasoningPattern.exec(content)) !== null) {
        reasoningBlocks.push(match[1].trim());
        mainContent = mainContent.replace(match[0], '').trim();
    }
    return { reasoning: reasoningBlocks, mainContent };
}
