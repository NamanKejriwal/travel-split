"use client"

import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface FabButtonProps {
  onClick: () => void
  activeTab?: string
}

export function FabButton({ onClick, activeTab }: FabButtonProps) {
  // Only show the FAB when the 'dashboard' tab is active
  return (
    <AnimatePresence>
      {activeTab === 'dashboard' && (
        <motion.button
          onClick={onClick}
          // Initial animation state: scaled down, rotated, and transparent
          initial={{ scale: 0, rotate: -45, opacity: 0 }}
          // Animate to full size, no rotation, and fully opaque
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          // Exit animation state: scaled down, rotated opposite way, and transparent
          exit={{ scale: 0, rotate: 45, opacity: 0 }}
          // Spring animation physics for a natural feel
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20
          }}
          // Hover effect: slight scale up
          whileHover={{ scale: 1.05 }}
          // Tap effect: slight scale down
          whileTap={{ scale: 0.9 }}
          className={cn(
            // Base shape and size
            "flex h-14 w-14 items-center justify-center rounded-full",
            // Premium Gradient Background
            "bg-gradient-to-tr from-[#00A896] to-teal-500 text-white",
            // Border and heavy shadow for a "floating" effect
            "border border-white/20 shadow-[0_8px_30px_rgba(0,168,150,0.4)]",
            // Enhanced hover state for shadow and border
            "hover:shadow-[0_8px_40px_rgba(0,168,150,0.6)] hover:border-white/40",
            // Smooth transition for hover effects
            "transition-shadow duration-300",
            // Positioning and interactivity
            "z-50 cursor-pointer outline-none touch-manipulation",
            // REDESIGNED PLACEMENT: Fixed position, elevated from bottom right
            "fixed bottom-24 right-6" 
          )}
          aria-label="Add expense"
        >
          {/* Thicker plus icon for better visibility */}
          <Plus className="h-7 w-7 stroke-[2.5px]" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}