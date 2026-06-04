import React from 'react';
import './FileChangesPanel.css';
interface FileChange {
    filename: string;
    status: 'modified' | 'added' | 'deleted' | 'renamed';
    additions?: number;
    deletions?: number;
    diff?: string;
}
interface FileChangesPanelProps {
    changes: FileChange[];
    onApprove?: (filename: string) => void;
    onReject?: (filename: string) => void;
    onApproveAll?: () => void;
    onRejectAll?: () => void;
    isVisible?: boolean;
}
/**
 * 文件变更面板组件
 * 显示 AI 修改的文件列表，支持展开查看 diff
 */
export declare const FileChangesPanel: React.FC<FileChangesPanelProps>;
export {};
//# sourceMappingURL=FileChangesPanel.d.ts.map