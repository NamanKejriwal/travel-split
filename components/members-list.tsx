"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { members } from "@/lib/members-data"

export function MembersList() {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Member Balances</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {members.map((member) => (
          <div key={member.id} className="flex flex-shrink-0 flex-col items-center gap-1.5 snap-start">
            <div className="relative">
              <Avatar className="h-14 w-14 border-2 border-card shadow-md">
                <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                  {member.initials}
                </AvatarFallback>
              </Avatar>
              {member.balance !== 0 && (
                <div
                  className={cn(
                    "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm",
                    member.balance > 0
                      ? "bg-success text-success-foreground"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {member.balance > 0 ? "+" : ""}${Math.abs(member.balance).toFixed(0)}
                </div>
              )}
            </div>
            <span className="w-16 truncate text-center text-xs font-medium text-foreground">{member.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
