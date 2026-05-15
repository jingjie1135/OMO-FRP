import React from "react"
import type { ActionStatus, JobStatus } from "../app/action-runner"

export interface AsyncActionStatusProps {
  status: ActionStatus
  jobStatus?: JobStatus
}

export const AsyncActionStatus: React.FC<AsyncActionStatusProps> = ({ status, jobStatus }) => {
  if (status === "idle") return null

  let message = ""
  if (status === "pending") {
    if (jobStatus === "queued") message = "Queued..."
    else if (jobStatus === "running") message = "Running job..."
    else message = "Processing..."
  } else if (status === "succeeded") {
    message = "Success"
  } else if (status === "failed") {
    message = "Failed"
  }

  return (
    <div className={`async-action-status status-${status}`} role="status" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      {status === "pending" && (
        <span className="spinner" style={{ 
          width: "1rem", 
          height: "1rem", 
          border: "2px solid rgba(0,0,0,0.1)", 
          borderTopColor: "currentColor", 
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
      )}
      <span>{message}</span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
