import { create } from "zustand"
import * as React from "react"

type DetailPanelState = {
  isOpen: boolean
  isResizing: boolean
  isOpening: boolean
  content: React.ReactNode | null
  size: string | number // Supports pixel strings like "450px" or percentages
  openPanel: (content: React.ReactNode) => void
  closePanel: () => void
  setSize: (size: string | number) => void
  setIsResizing: (isResizing: boolean) => void
}

export const useDetailPanelStore = create<DetailPanelState>((set) => ({
  isOpen: false,
  isResizing: false,
  isOpening: false,
  content: null,
  size: "450px", // Default to a fixed 450px width
  openPanel: (content) => {
    set((state) => {
      // Safeguard: Ensure size is a valid pixel width, reset to "450px" if collapsed
      const currentVal = typeof state.size === "string" ? parseInt(state.size) : Number(state.size)
      const targetSize = (isNaN(currentVal) || currentVal < 250) ? "450px" : `${currentVal}px`
      return { isOpen: true, content, isOpening: true, size: targetSize }
    })
    setTimeout(() => {
      set({ isOpening: false })
    }, 300) // Match animation transition duration
  },
  closePanel: () => set({ isOpen: false, content: null }),
  setSize: (size) => set({ size }),
  setIsResizing: (isResizing) => set({ isResizing }),
}))
