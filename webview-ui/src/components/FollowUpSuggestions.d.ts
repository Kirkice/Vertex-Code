import React from 'react';
import './FollowUpSuggestions.css';
interface FollowUpSuggestionsProps {
    suggestions: string[];
    onSuggestionClick: (suggestion: string) => void;
    isVisible?: boolean;
}
/**
 * 后续建议组件
 * 在 AI 回复后显示推荐的问题，帮助用户继续对话
 */
export declare const FollowUpSuggestions: React.FC<FollowUpSuggestionsProps>;
export {};
//# sourceMappingURL=FollowUpSuggestions.d.ts.map