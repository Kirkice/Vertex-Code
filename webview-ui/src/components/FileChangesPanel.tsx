import React, { useState } from 'react'
import './FileChangesPanel.css'

interface FileChange {
  filename: string
  status: 'modified' | 'added' | 'deleted' | 'renamed'
  additions?: number
  deletions?: number
  diff?: string
}

interface FileChangesPanelProps {
  changes: FileChange[]
  onApprove?: (filename: string) => void
  onReject?: (filename: string) => void
  onApproveAll?: () => void
  onRejectAll?: () => void
  isVisible?: boolean
}

/**
 * 文件变更面板组件
 * 显示 AI 修改的文件列表，支持展开查看 diff
 */
export const FileChangesPanel: React.FC<FileChangesPanelProps> = ({
  changes,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
  isVisible = true
}) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!isVisible || changes.length === 0) return null

  const toggleFile = (filename: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(filename)) {
      newExpanded.delete(filename)
    } else {
      newExpanded.add(filename)
    }
    setExpandedFiles(newExpanded)
  }

  const getStatusIcon = (status: FileChange['status']) => {
    switch (status) {
      case 'modified': return 'M'
      case 'added': return 'A'
      case 'deleted': return 'D'
      case 'renamed': return 'R'
      default: return '?'
    }
  }

  const getStatusClass = (status: FileChange['status']) => {
    switch (status) {
      case 'modified': return 'status-modified'
      case 'added': return 'status-added'
      case 'deleted': return 'status-deleted'
      case 'renamed': return 'status-renamed'
      default: return ''
    }
  }

  const totalAdditions = changes.reduce((sum, c) => sum + (c.additions || 0), 0)
  const totalDeletions = changes.reduce((sum, c) => sum + (c.deletions || 0), 0)

  return (
    <div className="file-changes-panel">
      <div className="panel-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="header-left">
          <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
          <span className="header-title">文件变更</span>
          <span className="file-count">{changes.length} 个文件</span>
        </div>
        <div className="header-stats">
          <span className="additions">+{totalAdditions}</span>
          <span className="deletions">-{totalDeletions}</span>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="panel-actions">
            {onApproveAll && (
              <button className="action-btn approve-all" onClick={onApproveAll}>
                ✓ 全部接受
              </button>
            )}
            {onRejectAll && (
              <button className="action-btn reject-all" onClick={onRejectAll}>
                ✕ 全部拒绝
              </button>
            )}
          </div>

          <div className="file-list">
            {changes.map((change, index) => (
              <div key={index} className="file-item">
                <div
                  className="file-header"
                  onClick={() => toggleFile(change.filename)}
                >
                  <span className={`file-status ${getStatusClass(change.status)}`}>
                    {getStatusIcon(change.status)}
                  </span>
                  <span className="file-name">{change.filename}</span>
                  <div className="file-stats">
                    {change.additions !== undefined && (
                      <span className="file-additions">+{change.additions}</span>
                    )}
                    {change.deletions !== undefined && (
                      <span className="file-deletions">-{change.deletions}</span>
                    )}
                  </div>
                </div>

                {expandedFiles.has(change.filename) && change.diff && (
                  <div className="file-diff">
                    <pre className="diff-content">{change.diff}</pre>
                  </div>
                )}

                {(onApprove || onReject) && (
                  <div className="file-actions">
                    {onApprove && (
                      <button
                        className="file-action-btn approve"
                        onClick={() => onApprove(change.filename)}
                      >
                        接受
                      </button>
                    )}
                    {onReject && (
                      <button
                        className="file-action-btn reject"
                        onClick={() => onReject(change.filename)}
                      >
                        拒绝
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}