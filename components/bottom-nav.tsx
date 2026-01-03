"use client"

import { LayoutDashboard, Activity, Users, User, Scale } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, label: "Home" },
  { id: "balance", icon: Scale, label: "Balances" },
  { id: "activity", icon: Activity, label: "Activity" },
  { id: "groups", icon: Users, label: "Groups" },
  { id: "account", icon: User, label: "Account" },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999]">
      {/* Gradient Fade above Navbar */}
      <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-[#020617] to-transparent pointer-events-none" />
      
      <motion.nav 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring" as const, stiffness: 260, damping: 20 }}
        className="pb-safe pt-2 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 bg-transparent border-none outline-none cursor-pointer group"
              >
                {/* Active Indicator (Sliding Line) */}
                {isActive && (
                  <motion.div 
                    layoutId="nav-indicator"
                    className="absolute -top-2.5 w-10 h-1 rounded-full bg-[#00A896] shadow-[0_0_12px_#00A896]"
                    transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Icon Container */}
                <motion.div 
                  className={cn(
                    "p-1.5 rounded-2xl transition-colors duration-200",
                    isActive ? "bg-[#00A896]/10" : "group-hover:bg-white/5"
                  )}
                  whileTap={{ scale: 0.9 }}
                  animate={{
                    y: isActive ? -4 : 0,
                  }}
                  transition={{ type: "spring" as const, stiffness: 300, damping: 20 }}
                >
                  <Icon 
                    className={cn(
                      "h-5 w-5 transition-all duration-300", 
                      isActive 
                        ? "text-[#00A896] drop-shadow-[0_0_8px_rgba(0,168,150,0.5)]" 
                        : "text-zinc-500 group-hover:text-zinc-300"
                    )} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </motion.div>
                
                {/* Label */}
                <motion.span
                  className={cn(
                    "text-[10px] font-bold tracking-wide transition-colors duration-200",
                    isActive ? "text-[#00A896]" : "text-zinc-600 group-hover:text-zinc-400"
                  )}
                  animate={{ scale: isActive ? 1.05 : 1 }}
                >
                  {item.label}
                </motion.span>
              </button>
            )
          })}
        </div>
      </motion.nav>
    </div>
  )
}