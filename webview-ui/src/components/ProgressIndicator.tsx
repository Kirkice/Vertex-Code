import React from 'react'
import './ProgressIndicator.css'

interface ProgressIndicatorProps {
  isVisible: boolean
  message?: string
}

/**
 * 进度指示器组件
 * 显示 AI 处理进度，带有动画效果
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  isVisible, 
  message = '正在思考...' 
}) => {
  if (!isVisible) return null

  return (
    <div className="progress-indicator">
      <div className="progress-spinner">
        <div className="spinner-ring"></div>
      </div>
      <div className="progress-message">{message}</div>
      <div className="progress-dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  )
}