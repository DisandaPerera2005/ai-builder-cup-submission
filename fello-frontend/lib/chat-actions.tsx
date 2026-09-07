"use client"

import * as React from "react"

/**
 * Lets deeply-nested block renderers (suggestion chips, task "mark complete"
 * buttons, etc. inside DynamicUIRenderer) trigger a new chat message without
 * prop-drilling through assistant-ui's fixed Thread/Message component tree.
 */
const ChatActionsContext = React.createContext<((prompt: string) => void) | null>(null)

export function ChatActionsProvider({
  onAction,
  children,
}: {
  onAction: (prompt: string) => void
  children: React.ReactNode
}) {
  return <ChatActionsContext.Provider value={onAction}>{children}</ChatActionsContext.Provider>
}

export function useChatAction(): (prompt: string) => void {
  const action = React.useContext(ChatActionsContext)
  return action ?? (() => {})
}
