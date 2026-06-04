import React, { useState } from 'react'
import './ReasoningBlock.css'

interface ReasoningBlockProps {
  content: string
  isExpanded?: boolean
  onToggle?: (expanded: boolean) => void
}

/**
 * 推理过程展示组件
 * 显示 AI 的思考过程，支持折叠/展开
 */
export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({
  content,
  isExpanded: controlledExpanded,
  onToggle
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false)
  
  // 支持受控和非受控模式
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded

  const handleToggle = () => {
    const newExpanded = !isExpanded
    if (onToggle) {
      onToggle(newExpanded)
    } else {
      setInternalExpanded(newExpanded)
    }
  }

  // 计算内容行数和字符数
  const lineCount = content.split('\n').length
  const charCount = content.length

  return (
    <div className={`reasoning-block ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="reasoning-header" onClick={handleToggle}>
        <div className="header-left">
          <span className="reasoning-icon">🧠</span>
          <span className="reasoning-title">思考过程</span>
          <span className="reasoning-stats">
            {lineCount} 行 · {charCount} 字符
          </span>
        </div>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="reasoning-content">
          <pre className="reasoning-text">{content}</pre>
        </div>
      )}
    </div>
  )
}

/**
 * 从消息内容中提取推理块
 * 支持 ```reasoning 代码块格式
 */
export function extractReasoningBlocks(content: string): { reasoning: string[]; mainContent: string } {
  const reasoningPattern = /```reasoning\n([\s\S]*?)```/g
  const reasoningBlocks: string[] = []
  let mainContent = content
  let match

  while ((match = reasoningPattern.exec(content)) !== null) {
    reasoningBlocks.push(match[1].trim())
    mainContent = mainContent.replace(match[0], '').trim()
  }

  return { reasoning: reasoningBlocks, mainContent }
}