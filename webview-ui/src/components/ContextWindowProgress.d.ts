import React from 'react';
import './ContextWindowProgress.css';
interface ContextWindowProgressProps {
    usedTokens: number;
    maxTokens: number;
    isVisible?: boolean;
}
/**
 * 上下文窗口进度条组件
 * 显示当前对话使用的 token 数量，接近限制时发出警告
 */
export declare const ContextWindowProgress: React.FC<ContextWindowProgressProps>;
export {};
//# sourceMappingURL=ContextWindowProgress.d.ts.map