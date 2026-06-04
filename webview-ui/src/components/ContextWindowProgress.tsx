import React from 'react'
import './ContextWindowProgress.css'

interface ContextWindowProgressProps {
  usedTokens: number
  maxTokens: number
  isVisible?: boolean
}

/**
 * 上下文窗口进度条组件
 * 显示当前对话使用的 token 数量，接近限制时发出警告
 */
export const ContextWindowProgress: React.FC<ContextWindowProgressProps> = ({ 
  usedTokens, 
  maxTokens,
  isVisible = true 
}) => {
  if (!isVisible) return null

  const percentage = Math.min((usedTokens / maxTokens) * 100, 100)
  const isWarning = percentage >= 80
  const isDanger = percentage >= 95

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`
    }
    return tokens.toString()
  }

  const getStatusColor = () => {
    if (isDanger) return 'var(--vscode-errorForeground, #f48771)'
    if (isWarning) return 'var(--vscode-editorWarning-foreground, #cca700)'
    return 'var(--vscode-progressBar-background, #0e70c0)'
  }

  return (
    <div className={`context-window-progress ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}>
      <div className="progress-header">
        <div className="progress-label">
          <span className="label-icon">📊</span>
          <span className="label-text">上下文窗口</span>
        </div>
        <div className="progress-stats">
          <span className="stats-used">{formatTokens(usedTokens)}</span>
          <span className="stats-separator">/</span>
          <span className="stats-max">{formatTokens(maxTokens)}</span>
          <span className="stats-percentage">{percentage.toFixed(1)}%</span>
        </div>
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: getStatusColor()
          }}
        />
      </div>
      {isWarning && (
        <div className="progress-warning">
          {isDanger ? (
            <>⚠️ 上下文窗口即将满，建议开始新对话</>
          ) : (
            <>💡 上下文使用率较高，可能影响回复质量</>
          )}
        </div>
      )}
    </div>
  )
}