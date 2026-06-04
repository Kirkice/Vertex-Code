import React from 'react';
import './ReasoningBlock.css';
interface ReasoningBlockProps {
    content: string;
    isExpanded?: boolean;
    onToggle?: (expanded: boolean) => void;
}
/**
 * 推理过程展示组件
 * 显示 AI 的思考过程，支持折叠/展开
 */
export declare const ReasoningBlock: React.FC<ReasoningBlockProps>;
/**
 * 从消息内容中提取推理块
 * 支持 ```reasoning 代码块格式
 */
export declare function extractReasoningBlocks(content: string): {
    reasoning: string[];
    mainContent: string;
};
export {};
//# sourceMappingURL=ReasoningBlock.d.ts.map