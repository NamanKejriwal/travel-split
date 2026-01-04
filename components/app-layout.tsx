"use client"

import { ReactNode } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { FabButton } from "@/components/fab-button"

interface AppLayoutProps {
  children: ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
  addExpenseOpen: boolean
  setAddExpenseOpen: (open: boolean) => void
  settleUpOpen: boolean
  setSettleUpOpen: (open: boolean) => void
  showFab?: boolean
}

export function AppLayout({
  children,
  activeTab,
  onTabChange,
  setAddExpenseOpen,
  showFab = true
}: AppLayoutProps) {
  return (
    // ROOT CONTAINER
    // - bg-[#020617]: Matches your deep navy theme
    // - flex justify-center: Centers the "Mobile App" on desktop screens
    <div className="min-h-screen w-full bg-[#020617] text-white flex justify-center overflow-hidden relative selection:bg-[#00A896] selection:text-white">
      
      {/* 1. NOISE TEXTURE (The Premium Detail) */}
      {/* Make sure you added the .bg-noise class to your globals.css as discussed! */}
      <div className="bg-noise" />

      {/* MAIN APP CONTAINER 
         - 'relative z-10': Sits above the background noise
         - 'max-w-lg': Enforces mobile width on desktop (looks like a phone app)
         - 'border-x': Subtle border on desktop to define edges
      */}
      <main className="w-full max-w-lg relative z-10 bg-[#020617] min-h-screen flex flex-col border-x border-white/5 shadow-2xl">
        
        {/* Scrollable Content Area 
           - flex-1: Takes up all available space
           - pb-28: Ensures content isn't hidden behind the bottom nav/FAB
        */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-28 scroll-smooth">
          {children}
        </div>

        {/* FLOATING ACTION BUTTON (FAB)
           - Positioned ABSOLUTE relative to the max-w-lg container.
           - This ensures it stays centered with the app on desktop, 
             rather than floating to the far right of the monitor.
        */}
        {showFab && (
        <div className="absolute bottom-24 right-6 z-50 pointer-events-auto">
          <FabButton 
            onClick={() => setAddExpenseOpen(true)} 
            activeTab={activeTab} 
          />
        </div>
        )}

        {/* BOTTOM NAVIGATION
           - Absolute bottom of the container
        */}
        <div className="absolute bottom-0 left-0 right-0 z-40">
           <BottomNav 
             activeTab={activeTab} 
             onTabChange={onTabChange} 
           />
        </div>
        
      </main>
    </div>
  )
}