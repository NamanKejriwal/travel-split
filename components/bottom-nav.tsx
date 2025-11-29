"use client"

import { LayoutDashboard, Activity, Users, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "activity", icon: Activity, label: "Activity" },
  { id: "groups", icon: Users, label: "Groups" },
  { id: "account", icon: User, label: "Account" },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="flex-none border-t border-border bg-card/95 backdrop-blur-lg pb-safe">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="flex flex-1 flex-col items-center gap-1 py-2"
            >
              <Icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
