"use client"

import { useState, useEffect } from "react" 
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Dashboard } from "@/components/dashboard"
import { ActivityView } from "@/components/views/activity-view"
import { AccountView } from "@/components/views/account-view"
import { GroupsView } from "@/components/views/groups-view"
import { LandingView } from "@/components/views/landing-view"
import { AuthView } from "@/components/views/auth-view"
import { BalanceView } from "@/components/views/balance-view"
import { ProfileSetupView } from "@/components/views/profile-setup-view"
import { AddExpenseDrawer, ExpenseToEdit } from "@/components/add-expense-drawer"
import { SettleUpDialog } from "@/components/settle-up-dialog"
import { AppLoadingScreen } from "@/components/app-loading-screen"
import { createClient } from "@/utils/supabase/client"
import type { User } from "@supabase/supabase-js"
import { toast } from "sonner"
import { useGroups } from "@/lib/hooks/useGroups"
import { motion, AnimatePresence } from "framer-motion"

type Tab = "dashboard" | "activity" | "groups" | "account" | "balance"

interface MainAppProps {
  initialUser: User | null
  hasProfile: boolean
}

// --- ANIMATION VARIANTS ---
const pageVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(5px)", scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)", 
    scale: 1,
    transition: { 
      type: "spring" as const,
      stiffness: 260, 
      damping: 20 
    }
  },
  exit: { opacity: 0, y: -20, filter: "blur(5px)", scale: 0.95, transition: { duration: 0.2 } }
}

export function MainApp({ initialUser, hasProfile }: MainAppProps) {
  const router = useRouter()
  const supabase = createClient()

  // -------- UI State --------
  const [currentView, setCurrentView] = useState(
    initialUser ? "app" : "landing"
  )
  // Track if profile is completed locally to update UI immediately
  const [isProfileCompleted, setIsProfileCompleted] = useState(hasProfile)
  
  const [activeTab, setActiveTab] = useState<Tab>("dashboard")
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [settleUpOpen, setSettleUpOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseToEdit | null>(null)
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false)
  const [latestTip, setLatestTip] = useState<string | null>(null)

  // -------- Groups State (React Query powered) --------
  const { activeGroup, selectGroup, isLoadingGroups } =
    useGroups(initialUser?.id || null)

  // -------- SCROLL FIX: Scroll to top on tab change --------
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [activeTab])

  // -------- Public Users Logic (Animated) --------
  if (!initialUser) {
    return (
      <div className="min-h-screen bg-[#020617]">
        <AnimatePresence mode="wait">
          {currentView === "landing" && (
            <motion.div key="landing" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <LandingView onGetStarted={() => setCurrentView("signup")} />
            </motion.div>
          )}
      
          {currentView === "login" && (
            <motion.div key="login" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <AuthView
                mode="login"
                onSubmit={() => router.refresh()}
                onSwitchMode={() => setCurrentView("signup")}
                onBack={() => setCurrentView("landing")}
              />
            </motion.div>
          )}
      
          {currentView === "signup" && (
            <motion.div key="signup" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <AuthView
                mode="signup"
                onSubmit={() => router.refresh()}
                onSwitchMode={() => setCurrentView("login")}
                onBack={() => setCurrentView("landing")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
  
  // -------- First Load --------
  if (isLoadingGroups) {
    return (
        <AnimatePresence>
            <motion.div key="loading" exit={{ opacity: 0, transition: { duration: 0.5 } }}>
                <AppLoadingScreen />
            </motion.div>
        </AnimatePresence>
    )
  }

  // -------- Profile Setup Logic --------
  if (initialUser && !isProfileCompleted) {
    return (
      <ProfileSetupView 
        onComplete={() => {
          setIsProfileCompleted(true)
          router.refresh() // Refresh server data to confirm profile exists
        }} 
      />
    )
  }

  // -------- Logout --------
  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem("lastViewedGroupId")
    setCurrentView("landing")
    router.refresh()
  }

  // Edit Expense Handler
  const handleEditExpense = (expense: ExpenseToEdit) => {
    setExpenseToEdit(expense)
    setAddExpenseOpen(true)
  }

  return (
    // Global Dark Wrapper to prevent white flashes during tab switches
    <div className="min-h-screen bg-[#020617] text-white">
      <AppLayout
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as Tab)}
        addExpenseOpen={addExpenseOpen}
        setAddExpenseOpen={() => {
            setExpenseToEdit(null) // Reset edit state when opening normally
            setAddExpenseOpen(true)
        }}
        settleUpOpen={settleUpOpen}
        setSettleUpOpen={setSettleUpOpen}
      >
        <AnimatePresence mode="wait">
          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <motion.div 
                key="dashboard" 
                variants={pageVariants} 
                initial="hidden" 
                animate="visible" 
                exit="exit"
                className="w-full"
            >
              <Dashboard
                activeGroup={activeGroup}
                onSettleUp={() => setSettleUpOpen(true)}
                onEditExpense={handleEditExpense}
                isAnalyzing={isAIAnalyzing}
                latestTip={latestTip}
                // FIX: Type assertion here to satisfy TypeScript
                setActiveTab={(t: string) => setActiveTab(t as Tab)}
              />
            </motion.div>
          )}

          {/* BALANCE */}
          {activeTab === "balance" && (
            <motion.div 
                key="balance" 
                variants={pageVariants} 
                initial="hidden" 
                animate="visible" 
                exit="exit"
                className="w-full"
            >
              <BalanceView
                activeGroup={activeGroup}
                onSettleUp={() => setSettleUpOpen(true)}
              />
            </motion.div>
          )}

          {/* ACTIVITY */}
          {activeTab === "activity" && (
            <motion.div 
                key="activity" 
                variants={pageVariants} 
                initial="hidden" 
                animate="visible" 
                exit="exit"
                className="w-full"
            >
              <ActivityView
                activeGroup={activeGroup}
                onEditExpense={handleEditExpense}
              />
            </motion.div>
          )}

          {/* GROUPS */}
          {activeTab === "groups" && (
            <motion.div 
                key="groups" 
                variants={pageVariants} 
                initial="hidden" 
                animate="visible" 
                exit="exit"
                className="w-full"
            >
              <GroupsView
                onSelectGroup={(g) => {
                  selectGroup(g)
                  setActiveTab("dashboard")
                  toast.success(`Switched to ${g.name}`)
                }}
              />
            </motion.div>
          )}

          {/* ACCOUNT */}
          {activeTab === "account" && (
            <motion.div 
                key="account" 
                variants={pageVariants} 
                initial="hidden" 
                animate="visible" 
                exit="exit"
                className="w-full"
            >
              <AccountView onLogout={handleLogout} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ADD EXPENSE DRAWER */}
        <AddExpenseDrawer
          open={addExpenseOpen}
          onOpenChange={(o) => {
            setAddExpenseOpen(o)
            if (!o) setTimeout(() => setExpenseToEdit(null), 200)
          }}
          activeGroup={activeGroup}
          onExpenseAdded={(ai) => {
            if (ai) setIsAIAnalyzing(true)
            setAddExpenseOpen(false)
          }}
          onAnalysisComplete={(tip) => {
            setIsAIAnalyzing(false)
            if (tip) setLatestTip(tip)
          }}
          expenseToEdit={expenseToEdit}
        />

        {/* SETTLE UP DIALOG */}
       <SettleUpDialog
            open={settleUpOpen}
            onOpenChange={setSettleUpOpen}
            activeGroup={activeGroup}
            onSettled={() => setSettleUpOpen(false)}
          />
      </AppLayout>
    </div>
  )
}