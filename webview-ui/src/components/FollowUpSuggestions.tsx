import React from 'react'
import './FollowUpSuggestions.css'

interface FollowUpSuggestionsProps {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
  isVisible?: boolean
}

/**
 * 后续建议组件
 * 在 AI 回复后显示推荐的问题，帮助用户继续对话
 */
export const FollowUpSuggestions: React.FC<FollowUpSuggestionsProps> = ({ 
  suggestions, 
  onSuggestionClick,
  isVisible = true 
}) => {
  if (!isVisible || suggestions.length === 0) return null

  return (
    <div className="follow-up-suggestions">
      <div className="suggestions-header">
        <span className="suggestions-icon">💡</span>
        <span className="suggestions-title">你可能还想问：</span>
      </div>
      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className="suggestion-button"
            onClick={() => onSuggestionClick(suggestion)}
            title={suggestion}
          >
            <span className="suggestion-text">{suggestion}</span>
            <span className="suggestion-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}