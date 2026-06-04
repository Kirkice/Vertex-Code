import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './ProgressIndicator.css';
/**
 * 进度指示器组件
 * 显示 AI 处理进度，带有动画效果
 */
export const ProgressIndicator = ({ isVisible, message = '正在思考...' }) => {
    if (!isVisible)
        return null;
    return (_jsxs("div", { className: "progress-indicator", children: [_jsx("div", { className: "progress-spinner", children: _jsx("div", { className: "spinner-ring" }) }), _jsx("div", { className: "progress-message", children: message }), _jsxs("div", { className: "progress-dots", children: [_jsx("span", { className: "dot" }), _jsx("span", { className: "dot" }), _jsx("span", { className: "dot" })] })] }));
};
