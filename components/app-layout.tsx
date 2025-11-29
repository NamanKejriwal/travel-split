import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Home, List, Users, User, Plus, Scale } from "lucide-react"

interface AppLayoutProps {
  children: ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
  addExpenseOpen: boolean
  setAddExpenseOpen: (open: boolean) => void
  settleUpOpen: boolean
  setSettleUpOpen: (open: boolean) => void
}

export function AppLayout({
  children,
  activeTab,
  onTabChange,
  addExpenseOpen,
  setAddExpenseOpen,
  settleUpOpen,
  setSettleUpOpen,
}: AppLayoutProps) {
  
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 max-w-md mx-auto border-x shadow-2xl relative">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* FAB - Add Expense (Floating Button) */}
      <div className="absolute bottom-20 right-4 z-50">
        <Button 
            size="icon" 
            className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg"
            onClick={() => setAddExpenseOpen(true)}
        >
            <Plus className="h-6 w-6 text-white" />
        </Button>
      </div>

      {/* Bottom Navigation */}
      <nav className="border-t bg-white sticky bottom-0 z-40 pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          
          <NavButton 
            active={activeTab === "dashboard"} 
            onClick={() => onTabChange("dashboard")} 
            icon={<Home className="h-5 w-5" />} 
            label="Home" 
          />
          
          <NavButton 
            active={activeTab === "balance"} 
            onClick={() => onTabChange("balance")} 
            icon={<Scale className="h-5 w-5" />} 
            label="Balances" 
          />

          <NavButton 
            active={activeTab === "activity"} 
            onClick={() => onTabChange("activity")} 
            icon={<List className="h-5 w-5" />} 
            label="Activity" 
          />

          <NavButton 
            active={activeTab === "groups"} 
            onClick={() => onTabChange("groups")} 
            icon={<Users className="h-5 w-5" />} 
            label="Groups" 
          />

          <NavButton 
            active={activeTab === "account"} 
            onClick={() => onTabChange("account")} 
            icon={<User className="h-5 w-5" />} 
            label="Account" 
          />
        </div>
      </nav>
    </div>
  )
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
    return (
        <button 
            onClick={onClick} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"}`}
        >
            {icon}
            <span className="text-[10px] font-medium">{label}</span>
        </button>
    )
}