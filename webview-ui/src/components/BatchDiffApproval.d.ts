import React from 'react';
import './BatchDiffApproval.css';
interface FileChange {
    path: string;
    status: 'added' | 'modified' | 'deleted';
    additions?: number;
    deletions?: number;
    diff?: string;
}
interface BatchDiffApprovalProps {
    changes: FileChange[];
    onApprove: (paths: string[]) => void;
    onReject: (paths: string[]) => void;
}
/**
 * 批量差异批准组件
 * 支持一次性批准/拒绝多个文件变更
 */
export declare const BatchDiffApproval: React.FC<BatchDiffApprovalProps>;
export {};
//# sourceMappingURL=BatchDiffApproval.d.ts.map