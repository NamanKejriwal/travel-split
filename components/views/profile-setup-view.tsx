"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, Sparkles, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

const supabase = createClient()

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.5, 
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 260, damping: 20 }
  }
}

export function ProfileSetupView({ onComplete }: { onComplete: () => void }) {
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return
    
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user found")

      // Upsert: Create or Update the profile
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
            id: user.id, 
            full_name: fullName, 
            email: user.email 
        })

      if (error) throw error
      
      // Done!
      onComplete()
    } catch (error) {
      console.error("Error saving profile:", error)
      alert("Failed to save profile. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] p-4 relative overflow-hidden font-sans selection:bg-[#00A896] selection:text-white">
      
      {/* AMBIENT BACKGROUND GLOWS */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.2, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#00A896]/10 rounded-full blur-[120px] pointer-events-none" 
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.2, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" 
      />

      {/* GLASS CARD */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10 bg-[#020617]/60 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl p-8 overflow-hidden"
      >
        {/* Subtle Gradient Shine */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* HEADER */}
        <div className="text-center mb-8 pt-2">
            <motion.div 
              variants={itemVariants}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00A896]/10 text-[#00A896] mb-6 border border-[#00A896]/20 shadow-[0_0_20px_rgba(0,168,150,0.15)]"
            >
                <Sparkles className="h-8 w-8" />
            </motion.div>
            
            <motion.h2 variants={itemVariants} className="text-3xl font-bold text-white mb-2 tracking-tight">
                Complete Your Profile
            </motion.h2>
            <motion.p variants={itemVariants} className="text-zinc-400 text-sm max-w-xs mx-auto leading-relaxed">
                Please enter your full name so your friends can recognize you in the group.
            </motion.p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSave} className="space-y-6">
            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="fullname" className="text-zinc-400 text-xs uppercase font-bold tracking-wider ml-1">Full Name</Label>
              <div className="relative group">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500 group-focus-within:text-[#00A896] transition-colors" />
                <Input 
                  id="fullname" 
                  placeholder="e.g. Alice Smith" 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                  required 
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-[#00A896]/50 focus:bg-[#00A896]/5 transition-all"
                />
              </div>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-bold rounded-xl bg-[#00A896] hover:bg-[#00A896]/90 text-white shadow-[0_0_20px_rgba(0,168,150,0.3)] transition-all"
                    disabled={loading}
                >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        Continue to App <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                )}
                </Button>
            </motion.div>
        </form>

      </motion.div>
    </div>
  )
}