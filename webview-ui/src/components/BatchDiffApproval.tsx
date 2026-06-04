import React, { useState } from 'react'
import './BatchDiffApproval.css'

interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions?: number
  deletions?: number
  diff?: string
}

interface BatchDiffApprovalProps {
  changes: FileChange[]
  onApprove: (paths: string[]) => void
  onReject: (paths: string[]) => void
}

/**
 * 批量差异批准组件
 * 支持一次性批准/拒绝多个文件变更
 */
export const BatchDiffApproval: React.FC<BatchDiffApprovalProps> = ({
  changes,
  onApprove,
  onReject
}) => {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set(changes.map(c => c.path)))
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const allSelected = selectedPaths.size === changes.length
  const someSelected = selectedPaths.size > 0 && selectedPaths.size < changes.length

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(changes.map(c => c.path)))
    }
  }

  const handleTogglePath = (path: string) => {
    const newSelected = new Set(selectedPaths)
    if (newSelected.has(path)) {
      newSelected.delete(path)
    } else {
      newSelected.add(path)
    }
    setSelectedPaths(newSelected)
  }

  const handleToggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const handleApprove = () => {
    onApprove(Array.from(selectedPaths))
  }

  const handleReject = () => {
    onReject(Array.from(selectedPaths))
  }

  const getStatusIcon = (status: FileChange['status']) => {
    switch (status) {
      case 'added':
        return <span className="status-icon added">+</span>
      case 'modified':
        return <span className="status-icon modified">~</span>
      case 'deleted':
        return <span className="status-icon deleted">−</span>
    }
  }

  return (
    <div className="batch-diff-approval">
      <div className="approval-header">
        <div className="header-left">
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => {
              if (el) el.indeterminate = someSelected
            }}
            onChange={handleSelectAll}
            className="select-all-checkbox"
          />
          <span className="header-title">文件变更</span>
          <span className="header-count">
            {selectedPaths.size} / {changes.length} 个文件
          </span>
        </div>
        <div className="header-actions">
          <button
            onClick={handleApprove}
            disabled={selectedPaths.size === 0}
            className="approve-button"
          >
            ✓ 批准选中
          </button>
          <button
            onClick={handleReject}
            disabled={selectedPaths.size === 0}
            className="reject-button"
          >
            ✕ 拒绝选中
          </button>
        </div>
      </div>

      <div className="approval-list">
        {changes.map((change) => (
          <div key={change.path} className="approval-item">
            <div className="item-header">
              <input
                type="checkbox"
                checked={selectedPaths.has(change.path)}
                onChange={() => handleTogglePath(change.path)}
                className="item-checkbox"
              />
              {getStatusIcon(change.status)}
              <span className="item-path" title={change.path}>
                {change.path}
              </span>
              <span className="item-stats">
                {change.additions !== undefined && change.additions > 0 && (
                  <span className="additions">+{change.additions}</span>
                )}
                {change.deletions !== undefined && change.deletions > 0 && (
                  <span className="deletions">-{change.deletions}</span>
                )}
              </span>
              {change.diff && (
                <button
                  onClick={() => handleToggleExpand(change.path)}
                  className="expand-button"
                >
                  {expandedPaths.has(change.path) ? '收起' : '查看'}
                </button>
              )}
            </div>
            {expandedPaths.has(change.path) && change.diff && (
              <div className="item-diff">
                <pre>{change.diff}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}