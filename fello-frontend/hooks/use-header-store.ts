import { create } from "zustand"
import * as React from "react"

type HeaderState = {
  breadcrumbs: React.ReactNode | null
  actions: React.ReactNode | null
  setBreadcrumbs: (breadcrumbs: React.ReactNode) => void
  setActions: (actions: React.ReactNode) => void
  clearHeader: () => void
}

export const useHeaderStore = create<HeaderState>((set) => ({
  breadcrumbs: null,
  actions: null,
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
  setActions: (actions) => set({ actions }),
  clearHeader: () => set({ breadcrumbs: null, actions: null }),
}))
