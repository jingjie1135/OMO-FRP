import React from "react"
import type { ActionError } from "../app/action-runner"

export interface ErrorStateProps {
  error: ActionError
  onRetry?: () => void
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="error-state" role="alert" style={{ padding: "1rem", border: "1px solid var(--error-color, #ff4444)", borderRadius: "4px", backgroundColor: "rgba(255, 68, 68, 0.1)" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>错误</h3>
      <p style={{ margin: "0 0 0.5rem 0" }}>{error.message}</p>
      
      <div style={{ fontSize: "0.875rem", opacity: 0.8, marginBottom: "1rem" }}>
        {error.target && <div>目标：{error.target}</div>}
        {error.status && <div>状态：{error.status}</div>}
      </div>

      {error.needsReauth && (
        <p style={{ fontWeight: "bold", marginBottom: "1rem" }}>
          请重新登录后再继续操作。
        </p>
      )}

      {error.retryable && onRetry && (
        <button 
          onClick={onRetry}
          style={{ 
            padding: "0.5rem 1rem", 
            backgroundColor: "var(--primary-color, #007bff)", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: "pointer" 
          }}
        >
          重试
        </button>
      )}
    </div>
  )
}
