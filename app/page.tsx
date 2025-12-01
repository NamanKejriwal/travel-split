"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { Dashboard } from "@/components/dashboard"
import { ActivityView } from "@/components/views/activity-view"
import { AccountView } from "@/components/views/account-view"
import { GroupsView, Group } from "@/components/views/groups-view"
import { LandingView } from "@/components/views/landing-view"
import { AuthView } from "@/components/views/auth-view"
import { BalanceView } from "@/components/views/balance-view"
import { AddExpenseDrawer, ExpenseToEdit } from "@/components/add-expense-drawer"
import { SettleUpDialog } from "@/components/settle-up-dialog"
import { ProfileSetupView } from "@/components/views/profile-setup-view"
import { supabase } from "@/lib/supabaseClient"
import { Toaster, toast } from "sonner"
import { Loader2 } from "lucide-react"

type View = "landing" | "login" | "signup" | "profile-setup" | "app"
type Tab = "dashboard" | "activity" | "groups" | "account" | "balance"

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("landing")
  const [isGlobalLoading, setIsGlobalLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState("Initializing...")
  const [activeTab, setActiveTab] = useState<Tab>("dashboard")
  
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [settleUpOpen, setSettleUpOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseToEdit | null>(null)
  
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)

  // Helper to detect if we are currently processing a Google Redirect
  const isUrlRedirect = () => {
    if (typeof window === "undefined") return false
    return (
        window.location.hash.includes("access_token") || 
        window.location.hash.includes("type=recovery") ||
        window.location.search.includes("code=")
    )
  }

  useEffect(() => {
    let mounted = true
    console.log("App mounted. Checking auth...")

    // 1. IMMEDIATE CHECK: Are we waiting for a redirect?
    if (isUrlRedirect()) {
        setLoadingStatus("Verifying account...")
        setIsGlobalLoading(true)
    }

    const initAuth = async () => {
      try {
        // 2. Check Session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
           if (error.message !== 'Auth session missing!') console.warn("Session error:", error.message)
           // Only force landing if we definitely failed and aren't redirecting
           if (!isUrlRedirect() && mounted) {
               setCurrentView("landing")
               setIsGlobalLoading(false)
           }
           return
        }

        if (session) {
           // 3. SUCCESS: We have a session! Ignore redirect flags and load app.
           if (mounted) await checkProfileAndNavigate(session.user.id)
        } else {
           // 4. No Session found.
           if (!isUrlRedirect() && mounted) {
              setCurrentView("landing")
              setIsGlobalLoading(false)
           } else {
              console.log("Redirect detected. Waiting for auth listener...")
           }
        }
      } catch (err) {
        console.error("Auth check failed", err)
        if (mounted) setIsGlobalLoading(false)
      }
    }

    initAuth()

    // 5. Listener for Auth Events (Handles Google Login completion)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth Event:", event)
        
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session && mounted) {
                await checkProfileAndNavigate(session.user.id)
            }
        } else if (event === 'SIGNED_OUT') {
             if (mounted && !isUrlRedirect()) {
                 setCurrentView("landing")
                 setActiveGroup(null)
                 setIsGlobalLoading(false)
                 localStorage.removeItem("lastActiveGroupId")
             }
        }
    })

    return () => {
        mounted = false
        authListener.subscription.unsubscribe()
    }
  }, [])

  // Safety Timeout (8s)
  useEffect(() => {
    if (isGlobalLoading) {
        const timer = setTimeout(() => {
            if (isGlobalLoading) {
                console.log("Auth timeout. Assuming public user.")
                setIsGlobalLoading(false)
                setCurrentView((prev) => prev === 'app' ? 'app' : 'landing')
            }
        }, 8000)
        return () => clearTimeout(timer)
    }
  }, [isGlobalLoading])

  // Auto-Refresh Logic
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') setRefreshKey(prev => prev + 1)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Realtime Logic
  useEffect(() => {
    if (!activeGroup) return
    const channel = supabase
      .channel('realtime expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${activeGroup.id}` }, () => {
          setRefreshKey(prev => prev + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeGroup])

  const checkProfileAndNavigate = async (userId: string) => {
    setLoadingStatus("Loading profile...")
    
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single()

      if (profile && profile.full_name) {
        setCurrentView("app")
        
        // Optional: Restore last group
        const lastGroupId = localStorage.getItem("lastActiveGroupId")
        if (lastGroupId && !activeGroup) {
             const { data: group } = await supabase.from('groups').select('*').eq('id', lastGroupId).single()
             if (group) {
                 setActiveGroup(group)
                 setActiveTab("dashboard")
             }
        }
      } else {
        setCurrentView("profile-setup")
      }
    } catch (error) {
      console.error("Profile check failed:", error)
      setCurrentView("profile-setup") 
    } finally {
      setIsGlobalLoading(false)
    }
  }

  // Handlers
  const handleGetStarted = () => setCurrentView("signup")
  const handleAuthSuccess = () => { /* Listener handles navigation */ }
  const handleSwitchToLogin = () => setCurrentView("login")
  const handleSwitchToSignup = () => setCurrentView("signup")
  const handleBackToLanding = () => setCurrentView("landing")
  
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleTabChange = (tab: string) => setActiveTab(tab as Tab)

  const handleGroupSelect = (group: Group) => {
    setActiveGroup(group)       
    setActiveTab("dashboard")   
    localStorage.setItem("lastActiveGroupId", group.id)
  }

  const handleSettleUp = () => setSettleUpOpen(true)
  
  const handleOpenAddExpense = () => {
    setExpenseToEdit(null)
    setAddExpenseOpen(true)
  }

  const handleEditExpense = (expense: ExpenseToEdit) => {
    setExpenseToEdit(expense)
    setAddExpenseOpen(true)
  }

  const handleDrawerChange = (open: boolean) => {
    setAddExpenseOpen(open)
    if (!open) setTimeout(() => setExpenseToEdit(null), 300) 
  }

  const handleExpenseAdded = () => {
      setRefreshKey(prev => prev + 1) 
      setAddExpenseOpen(false) 
      toast.success("Saved successfully")
  }

  const renderAppTab = () => {
    switch (activeTab) {
      case "dashboard":
        // @ts-ignore
        return <Dashboard key={refreshKey} activeGroup={activeGroup} onSettleUp={handleSettleUp} onEditExpense={handleEditExpense} />
      case "balance":
        // @ts-ignore
        return <BalanceView key={refreshKey} activeGroup={activeGroup} onSettleUp={handleSettleUp} />
      case "activity":
        // @ts-ignore
        return <ActivityView key={refreshKey} activeGroup={activeGroup} />
      case "groups":
        return <GroupsView onSelectGroup={handleGroupSelect} />
      case "account":
        return <AccountView onLogout={handleLogout} />
      default:
        // @ts-ignore
        return <Dashboard key={refreshKey} activeGroup={activeGroup} onSettleUp={handleSettleUp} />
    }
  }

  if (isGlobalLoading) {
      return (
          <div className="flex min-h-screen items-center justify-center bg-zinc-50">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-zinc-500 text-sm animate-pulse">{loadingStatus}</p>
              </div>
          </div>
      )
  }

  if (currentView === "landing") return <LandingView onGetStarted={handleGetStarted} />
  if (currentView === "login") return <AuthView mode="login" onSubmit={handleAuthSuccess} onSwitchMode={handleSwitchToSignup} onBack={handleBackToLanding} />
  if (currentView === "signup") return <AuthView mode="signup" onSubmit={handleAuthSuccess} onSwitchMode={handleSwitchToLogin} onBack={handleBackToLanding} />
  if (currentView === "profile-setup") return <ProfileSetupView onComplete={() => setCurrentView("app")} />

  return (
    <>
        <Toaster position="top-center" />
        <AppLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        addExpenseOpen={addExpenseOpen}
        setAddExpenseOpen={handleOpenAddExpense} 
        settleUpOpen={settleUpOpen}
        setSettleUpOpen={setSettleUpOpen}
        >
        {renderAppTab()}

        <AddExpenseDrawer 
            open={addExpenseOpen} 
            onOpenChange={handleDrawerChange}
            activeGroup={activeGroup}
            onExpenseAdded={handleExpenseAdded}
            expenseToEdit={expenseToEdit}
        />

        <SettleUpDialog 
            open={settleUpOpen}
            onOpenChange={setSettleUpOpen}
            activeGroup={activeGroup}
            onSettled={handleExpenseAdded}
        />
        </AppLayout>
    </>
  )
}