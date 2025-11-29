"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Dashboard } from "@/components/dashboard"
import { ActivityView } from "@/components/views/activity-view"
import { AccountView } from "@/components/views/account-view"
import { GroupsView, Group } from "@/components/views/groups-view"
import { LandingView } from "@/components/views/landing-view"
import { AuthView } from "@/components/views/auth-view"
// IMPORT NEW VIEW
import { BalanceView } from "@/components/views/balance-view"
import { AddExpenseDrawer, ExpenseToEdit } from "@/components/add-expense-drawer"
import { SettleUpDialog } from "@/components/settle-up-dialog"
import { ProfileSetupView } from "@/components/views/profile-setup-view"
import { supabase } from "@/lib/supabaseClient"

type View = "landing" | "login" | "signup" | "profile-setup" | "app"
// Added "balance" to types
type Tab = "dashboard" | "activity" | "groups" | "account" | "balance"

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("landing")
  const [activeTab, setActiveTab] = useState<Tab>("dashboard")
  
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [settleUpOpen, setSettleUpOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseToEdit | null>(null)
  
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)

  const checkProfileAndNavigate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCurrentView("login")
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (profile && profile.full_name) {
        setCurrentView("app")
      } else {
        setCurrentView("profile-setup")
      }
    } catch (error) {
      console.error("Profile check failed:", error)
      setCurrentView("app") 
    }
  }

  const handleGetStarted = () => setCurrentView("signup")
  const handleAuthSuccess = () => checkProfileAndNavigate()
  const handleSwitchToLogin = () => setCurrentView("login")
  const handleSwitchToSignup = () => setCurrentView("signup")
  const handleBackToLanding = () => setCurrentView("landing")
  
  const handleLogout = () => {
    setCurrentView("landing")
    setActiveTab("dashboard")
    setActiveGroup(null) 
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab)
  }

  const handleGroupSelect = (group: Group) => {
    setActiveGroup(group)       
    setActiveTab("dashboard")   
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
    if (!open) {
        setTimeout(() => setExpenseToEdit(null), 300) 
    }
  }

  const handleExpenseAdded = () => {
      setRefreshKey(prev => prev + 1) 
      setAddExpenseOpen(false) 
  }

  const renderAppTab = () => {
    switch (activeTab) {
      case "dashboard":
        // @ts-ignore
        return <Dashboard 
          key={refreshKey} 
          activeGroup={activeGroup} 
          onSettleUp={handleSettleUp} 
          onEditExpense={handleEditExpense} 
        />
      case "balance":
        // NEW TAB RENDER
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

  if (currentView === "landing") {
    return <LandingView onGetStarted={handleGetStarted} />
  }

  if (currentView === "login") {
    return (
      <AuthView mode="login" onSubmit={handleAuthSuccess} onSwitchMode={handleSwitchToSignup} onBack={handleBackToLanding} />
    )
  }

  if (currentView === "signup") {
    return (
      <AuthView mode="signup" onSubmit={handleAuthSuccess} onSwitchMode={handleSwitchToLogin} onBack={handleBackToLanding} />
    )
  }

  if (currentView === "profile-setup") {
    return <ProfileSetupView onComplete={() => setCurrentView("app")} />
  }

  return (
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
  )
}