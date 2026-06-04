import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './FollowUpSuggestions.css';
/**
 * 后续建议组件
 * 在 AI 回复后显示推荐的问题，帮助用户继续对话
 */
export const FollowUpSuggestions = ({ suggestions, onSuggestionClick, isVisible = true }) => {
    if (!isVisible || suggestions.length === 0)
        return null;
    return (_jsxs("div", { className: "follow-up-suggestions", children: [_jsxs("div", { className: "suggestions-header", children: [_jsx("span", { className: "suggestions-icon", children: "\uD83D\uDCA1" }), _jsx("span", { className: "suggestions-title", children: "\u4F60\u53EF\u80FD\u8FD8\u60F3\u95EE\uFF1A" })] }), _jsx("div", { className: "suggestions-list", children: suggestions.map((suggestion, index) => (_jsxs("button", { className: "suggestion-button", onClick: () => onSuggestionClick(suggestion), title: suggestion, children: [_jsx("span", { className: "suggestion-text", children: suggestion }), _jsx("span", { className: "suggestion-arrow", children: "\u2192" })] }, index))) })] }));
};
