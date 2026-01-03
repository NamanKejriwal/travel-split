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
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClient()

// --- ANIMATIONS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  visible: { 
    opacity: 1, 
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 240, damping: 22 } as const // FIX: Added 'as const' here
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
    <div className="min-h-screen bg-[#020617] text-white p-4 pb-24 relative overflow-hidden">

      {/* Ambient Pro Lighting */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] bg-[#00A896]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[45%] bg-cyan-500/10 blur-[130px] rounded-full" />
      </div>

      {/* HEADER */}
      <motion.h2 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-[2.2rem] font-black tracking-tight relative z-10"
      >
        Account Settings
      </motion.h2>

      <AnimatePresence mode="wait">
        {loading ? (
          // ---------------- SKELETON ----------------
          <motion.div 
            key="skel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 mt-4 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="h-6 w-36 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-52 bg-white/5 rounded animate-pulse" />
              </div>
            </div>

            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
          </motion.div>

        ) : (
          // ---------------- CONTENT ----------------
          <motion.div
            key="content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 mt-2"
          >

            {/* PROFILE CARD */}
            <motion.div
              variants={itemVariants}
              className="rounded-3xl border border-white/10 bg-[#020617]/60 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.4)] overflow-hidden"
            >
              
              {/* HEADER SECTION */}
              <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex gap-5 items-center">
                  
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" as const, stiffness: 220 }}
                    className="relative"
                  >
                    <div className="absolute inset-0 bg-[#00A896] blur-md opacity-40 rounded-full" />
                    
                    <Avatar className="h-20 w-20 border-2 border-[#00A896]/50 shadow-2xl relative z-10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${fullName}&backgroundColor=0f172a`} />
                      <AvatarFallback className="bg-slate-900 text-[#00A896] font-bold text-xl">
                        {fullName ? fullName[0]?.toUpperCase() : <User />}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>

                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-xl font-bold truncate">{fullName || "Traveler"}</h3>

                    <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1 truncate">
                      <Mail className="w-3 h-3" /> {email}
                    </p>

                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-[#00A896]/10 border border-[#00A896]/20 text-[10px] text-[#00A896] font-semibold"
                    >
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Verified Account
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* FORM CONTENT */}
              <div className="p-6 space-y-6">

                {/* Full Name */}
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Full Name
                  </Label>

                  <div className="relative group">
                    <User className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500 group-hover:text-[#00A896]" />
                    
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-12 pl-10 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-[#00A896] focus:bg-white/[0.08] transition-all"
                      placeholder="Enter your name"
                    />
                  </div>
                </motion.div>

                {/* Email */}
                <motion.div variants={itemVariants} className="space-y-2 opacity-75">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Email Address
                  </Label>

                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                    <Input value={email} disabled className="h-12 pl-10 bg-black/20 border-white/5 text-zinc-400 rounded-xl" />
                  </div>
                </motion.div>

                {/* AI COACH */}
                <motion.div
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                  className="flex justify-between items-center rounded-2xl border border-[#00A896]/20 bg-[#00A896]/5 p-4"
                >
                  <div>
                    <Label className="flex items-center gap-2 font-semibold">
                      <Sparkles className="text-[#00A896] h-4 w-4" />
                      AI Finance Coach
                    </Label>
                    <p className="text-xs text-zinc-400 mt-1">
                      Intelligent budget alerts & smart spending tips.
                    </p>
                  </div>

                  <Switch
                    checked={aiEnabled}
                    onCheckedChange={setAiEnabled}
                    className="data-[state=checked]:bg-[#00A896]"
                  />
                </motion.div>

              </div>

              {/* FOOTER */}
              <motion.div variants={itemVariants} className="p-6 pt-0 flex justify-end">
                <Button
                  disabled={saving}
                  onClick={updateProfile}
                  className="h-11 px-8 rounded-full bg-[#00A896] hover:bg-[#00A896]/90 font-semibold shadow-[0_0_25px_rgba(0,168,150,0.3)] hover:scale-[1.02] transition-all"
                >
                  {saving ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </> : "Save Changes"}
                </Button>
              </motion.div>
            </motion.div>

            {/* SIGN OUT */}
            <motion.div variants={itemVariants}>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full h-12 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>

              <p className="text-center text-[10px] text-zinc-600 mt-6 tracking-wide uppercase">
                TravelSplit V2.0 — 2025 Edition
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}