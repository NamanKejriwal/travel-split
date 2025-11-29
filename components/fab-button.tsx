"use client"

import { Plus } from "lucide-react"

interface FabButtonProps {
  onClick: () => void
}

export function FabButton({ onClick }: FabButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-transform active:scale-95"
      aria-label="Add expense"
    >
      <Plus className="h-6 w-6 text-primary-foreground" />
    </button>
  )
}
