"use client"

import type React from "react"
import { Utensils, Car, Home, Plane, ShoppingBag, Ticket, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const categoryIcons: Record<string, React.ElementType> = {
  food: Utensils,
  transport: Car,
  accommodation: Home,
  flights: Plane,
  shopping: ShoppingBag,
  activities: Ticket,
}

const categoryColors: Record<string, string> = {
  food: "bg-orange-500/10 text-orange-500",
  transport: "bg-blue-500/10 text-blue-500",
  accommodation: "bg-[#00A896]/10 text-[#00A896]",
  flights: "bg-sky-500/10 text-sky-500",
  shopping: "bg-pink-500/10 text-pink-500",
  activities: "bg-amber-500/10 text-amber-500",
}

const expenses = [
  {
    id: 1,
    date: "Nov 28",
    description: "Beach Club Dinner",
    category: "food",
    payer: "You",
    amount: 185.0,
    splitBetween: 4,
  },
  {
    id: 2,
    date: "Nov 27",
    description: "Scooter Rentals",
    category: "transport",
    payer: "Mike",
    amount: 120.0,
    splitBetween: 4,
  },
  {
    id: 3,
    date: "Nov 27",
    description: "Villa Accommodation",
    category: "accommodation",
    payer: "Sarah",
    amount: 850.0,
    splitBetween: 4,
  },
  {
    id: 4,
    date: "Nov 26",
    description: "Temple Tour Entry",
    category: "activities",
    payer: "Emma",
    amount: 80.0,
    splitBetween: 4,
  },
  {
    id: 5,
    date: "Nov 26",
    description: "Souvenir Shopping",
    category: "shopping",
    payer: "You",
    amount: 65.5,
    splitBetween: 2,
  },
  {
    id: 6,
    date: "Nov 25",
    description: "Airport Transfer",
    category: "transport",
    payer: "Jake",
    amount: 45.0,
    splitBetween: 4,
  },
]

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { 
      type: "spring" as const, // <--- ADD "as const" HERE
      stiffness: 260, 
      damping: 20 
    }
  }
}
export function ExpensesList() {
  return (
    <motion.div 
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recent Expenses</h2>
        <button className="text-xs font-bold text-[#00A896] hover:text-[#00A896]/80 transition-colors">View All</button>
      </motion.div>

      <div className="space-y-3">
        {expenses.map((expense) => {
          const Icon = categoryIcons[expense.category] || Utensils
          const colorClass = categoryColors[expense.category] || categoryColors.food

          return (
            <motion.div
              key={expense.id}
              layout // Allows smooth shuffling if list order changes
              variants={itemVariants}
              whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.08)" }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-[#020617]/60 p-3 shadow-sm backdrop-blur-md transition-colors duration-200 cursor-pointer"
            >
              {/* Category Icon */}
              <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-colors", colorClass)}>
                <Icon className="h-5 w-5" />
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white group-hover:text-[#00A896] transition-colors">{expense.description}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {expense.date} • Paid by <span className={expense.payer === 'You' ? "text-white font-medium" : ""}>{expense.payer}</span>
                </p>
              </div>

              {/* Amount */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-bold text-white">${expense.amount.toFixed(2)}</p>
                  <p className="text-[10px] text-zinc-500 font-medium bg-white/5 px-1.5 py-0.5 rounded inline-block mt-0.5">
                    ÷{expense.splitBetween}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors" />
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}