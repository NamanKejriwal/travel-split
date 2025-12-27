"use client"

import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface FabButtonProps {
  onClick: () => void
  activeTab?: string
}

export function FabButton({ onClick, activeTab }: FabButtonProps) {
  // We use AnimatePresence to animate the button OUT when the tab changes
  // instead of just returning null immediately.
  
  return (
    <AnimatePresence>
      {activeTab === 'dashboard' && (
        <motion.button
          onClick={onClick}
          initial={{ scale: 0, rotate: -90, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0, rotate: 90, opacity: 0 }}
          transition={{
            type: "spring" as const,
            stiffness: 400,
            damping: 25
          }}
          whileHover={{ 
            scale: 1.1, 
            boxShadow: "0 0 35px rgba(0,168,150,0.6)" 
          }}
          whileTap={{ scale: 0.9 }}
          className={cn(
            // Shape & Size
            "flex h-14 w-14 items-center justify-center rounded-full",
            // Colors & Glass Effect
            "bg-[#00A896] text-white",
            "border border-white/20 backdrop-blur-md",
            // Base Shadows
            "shadow-[0_0_20px_rgba(0,168,150,0.4)]",
            // Layout (Absolute centering usually handled by parent, but these are safe defaults)
            "z-50 cursor-pointer outline-none"
          )}
          aria-label="Add expense"
        >
          <Plus className="h-7 w-7 stroke-[3px] drop-shadow-md" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}