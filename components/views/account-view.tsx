"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { LogOut, User, Mail, Sparkles, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClient()

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
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
      type: "spring" as const, // <--- ADD THIS HERE
      stiffness: 260, 
      damping: 20 
    }
  }
}

interface AccountViewProps {
  onLogout: () => void
}

export function AccountView({ onLogout }: AccountViewProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [aiEnabled, setAiEnabled] = useState(false)

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUser(user)
      setEmail(user.email || "")

      const { data } = await supabase
        .from("profiles")
        .select("full_name, ai_alerts_enabled")
        .eq("id", user.id)
        .single()

      if (data) {
        setFullName(data.full_name || "")
        setAiEnabled(data.ai_alerts_enabled || false)
      }
    } catch (err) {
      console.error("Profile load failed", err)
    } finally {
      // Small artificial delay to let animation settle if loading is too fast
      setTimeout(() => setLoading(false), 300)
    }
  }

  async function updateProfile() {
    if (!user) return
    setSaving(true)

    try {
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        email,
        ai_alerts_enabled: aiEnabled,
      })

      toast.success("Profile updated successfully!")
    } catch (e: any) {
      toast.error(`Failed to update profile: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    onLogout()
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 pb-24 space-y-8 relative overflow-hidden">
      
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] right-[-20%] w-[50%] h-[50%] bg-[#00A896]/10 rounded-full blur-[100px]" />
      </div>

      <motion.h2 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="text-3xl font-bold tracking-tight text-white relative z-10 flex items-center gap-2"
      >
        Account Settings
      </motion.h2>

      <AnimatePresence mode="wait">
      {loading ? (
        // SKELETON UI
        <motion.div 
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl border border-white/5 bg-[#020617]/80 p-6 space-y-6"
        >
            <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-white/10 animate-pulse" />
                <div className="space-y-2 flex-1">
                    <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-56 bg-white/5 rounded animate-pulse" />
                </div>
            </div>
            <div className="h-12 w-full bg-white/5 rounded animate-pulse" />
            <div className="h-12 w-full bg-white/5 rounded animate-pulse" />
        </motion.div>
      ) : (
        // REAL UI
        <motion.div 
            key="content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 space-y-8"
        >
            
          {/* PROFILE CARD */}
          <motion.div variants={itemVariants} className="relative rounded-3xl border border-white/10 bg-[#020617]/60 backdrop-blur-xl shadow-xl overflow-hidden">
            
            {/* Header Section */}
            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex flex-row items-center gap-5">
                    <motion.div 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        transition={{ type: "spring" as const, stiffness: 200, delay: 0.3 }}
                        className="relative"
                    >
                        <div className="absolute inset-0 bg-[#00A896] blur-md opacity-40 rounded-full" />
                        <Avatar className="h-20 w-20 border-2 border-[#00A896]/50 shadow-lg relative z-10">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${fullName}&backgroundColor=0f172a`} />
                            <AvatarFallback className="bg-slate-800 text-[#00A896] text-xl font-bold">
                            {fullName ? fullName[0].toUpperCase() : <User />}
                            </AvatarFallback>
                        </Avatar>
                    </motion.div>

                    <div className="flex-1 overflow-hidden">
                        <h3 className="text-xl font-bold text-white truncate">{fullName || "Traveler"}</h3>
                        <p className="text-sm text-zinc-400 truncate flex items-center gap-1.5 mt-1">
                            <Mail className="w-3 h-3" />
                            {email}
                        </p>
                        <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-[#00A896]/10 border border-[#00A896]/20 text-[10px] font-medium text-[#00A896]"
                        >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Verified Account
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6 space-y-6">
              
              {/* Full Name Input */}
              <motion.div variants={itemVariants} className="space-y-2">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Full Name</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500 group-hover:text-[#00A896] transition-colors" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white h-12 rounded-xl focus-visible:ring-[#00A896] placeholder:text-zinc-600 transition-all focus:bg-white/10 focus:scale-[1.01]"
                    placeholder="Enter your name"
                  />
                </div>
              </motion.div>

              {/* Email Input (Disabled) */}
              <motion.div variants={itemVariants} className="space-y-2 opacity-70">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                  <Input 
                    value={email} 
                    disabled 
                    className="pl-10 bg-black/20 border-white/5 text-zinc-400 h-12 rounded-xl cursor-not-allowed" 
                  />
                </div>
              </motion.div>

              {/* AI Toggle Section */}
              <motion.div 
                variants={itemVariants} 
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between rounded-2xl border border-[#00A896]/20 bg-[#00A896]/5 p-4 relative overflow-hidden transition-all"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#00A896]/10 blur-xl rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                
                <div className="relative z-10 pr-4">
                  <Label className="text-base font-semibold text-white flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-[#00A896]" />
                    AI Finance Coach
                  </Label>
                  <p className="text-xs text-zinc-400 max-w-[200px] leading-relaxed">
                    Get intelligent spending alerts and budget tips powered by AI.
                  </p>
                </div>

                <Switch
                  checked={aiEnabled}
                  onCheckedChange={setAiEnabled}
                  className="data-[state=checked]:bg-[#00A896] data-[state=unchecked]:bg-zinc-700 border-2 border-transparent relative z-10 scale-110"
                />
              </motion.div>
            </div>

            {/* Footer Actions */}
            <motion.div variants={itemVariants} className="p-6 pt-0 flex justify-end">
              <Button
                onClick={updateProfile}
                disabled={saving}
                className="rounded-full bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold px-8 shadow-[0_0_20px_rgba(0,168,150,0.3)] transition-all hover:scale-105"
              >
                {saving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                ) : "Save Changes"}
              </Button>
            </motion.div>
          </motion.div>

          {/* DANGER ZONE */}
          <motion.div variants={itemVariants} className="pt-2 relative z-10">
            <Button 
                variant="ghost" 
                className="w-full h-12 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all group" 
                onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Sign Out
            </Button>

            <p className="text-center text-[10px] text-zinc-600 mt-6 uppercase tracking-widest font-medium">
              TravelSplit v2.0 • 2025 Edition
            </p>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}