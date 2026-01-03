"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
// Ensure this import points to your actual data source or interface
import { members } from "@/lib/members-data" 

export function MembersList() {
  return (
    <div className="space-y-4">
      {/* Title with subtle divider feel */}
      <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
        Member Balances
      </h2>

      {/* Horizontal Scroll Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {members.map((member) => (
          <div key={member.id} className="flex flex-col items-center gap-2 snap-start shrink-0 group cursor-pointer">
            
            <div className="relative">
              {/* Glowing ring effect on hover */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00A896] to-purple-500 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>
              
              {/* Avatar */}
              <Avatar className="h-14 w-14 border-2 border-[#00A896]/30 shadow-lg relative z-10 group-hover:border-transparent transition-all duration-300">
                <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                <AvatarFallback className="bg-slate-800 text-[#00A896] font-bold text-sm">
                  {member.initials || member.name[0]}
                </AvatarFallback>
              </Avatar>

              {/* Balance Badge */}
              {member.balance !== 0 && (
                <div
                  className={cn(
                    "absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg border border-white/10 z-20 whitespace-nowrap backdrop-blur-sm",
                    member.balance > 0
                      ? "bg-[#00d2aa]/90 shadow-[0_0_10px_rgba(0,210,170,0.4)]" // Neon Teal for positive
                      : "bg-rose-500/90 shadow-[0_0_10px_rgba(244,63,94,0.4)]"   // Neon Red for negative
                  )}
                >
                  {member.balance > 0 ? "+" : ""}${Math.abs(member.balance).toFixed(0)}
                </div>
              )}
            </div>

            {/* Name */}
            <span className="w-16 truncate text-center text-[10px] font-medium text-zinc-400 group-hover:text-white transition-colors duration-200">
              {member.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}