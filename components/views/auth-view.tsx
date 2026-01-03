"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"
import { ArrowLeft, Loader2, Sparkles, Mail, Lock, User } from "lucide-react"
import { trackEvent } from '@/lib/analytics'
import { motion, AnimatePresence } from "framer-motion"

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.5, 
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.08 
    }
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { 
      type: "spring" as const,
      stiffness: 260, 
      damping: 20 
    }
  }
}

interface AuthViewProps {
  mode: "login" | "signup"
  onSubmit: () => void
  onSwitchMode: () => void
  onBack: () => void
}

export function AuthView({ mode, onSubmit, onSwitchMode, onBack }: AuthViewProps) {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState<string | null>(null)
  
  const isLogin = mode === "login"

  // --- LOGIC ---
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    try {
      trackEvent.signIn('google')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // FIX: Force Google to show the account chooser
          queryParams: {
            access_type: 'offline',
            prompt: 'consent select_account',
          },
        },
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message)
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        trackEvent.signIn('email')
        
        // FIX: Ensure session is valid before refreshing to avoid race conditions
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
           onSubmit() 
        } else {
           throw new Error("Login failed to establish session.")
        }
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (authError) throw authError
        
        // FIX: Only proceed if a session exists (auto-confirm enabled)
        if (data.session) {
            trackEvent.signIn('email')
            onSubmit() 
        } else if (data.user && !data.session) {
            alert("Account created! Please check your email to confirm.")
            setIsLoading(false)
            return
        }
      }
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
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
        layout 
        className="w-full max-w-md relative z-10 bg-[#020617]/60 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl p-8 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.95 }}
            className="absolute left-6 top-6 p-2 text-zinc-400 rounded-full transition-colors" 
            onClick={onBack}
        >
            <ArrowLeft className="h-5 w-5" />
        </motion.button>

        <div className="text-center mb-8 pt-6">
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const,  stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00A896]/10 text-[#00A896] mb-8 border border-[#00A896]/20 shadow-[0_0_15px_rgba(0,168,150,0.15)]"
            >
                <Sparkles className="h-7 w-7" />
            </motion.div>
            
            <AnimatePresence mode="wait">
                <motion.div
                    key={mode} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                        {isLogin ? "Welcome Back" : "Create Account"}
                    </h2>
                    <p className="text-zinc-400 text-sm">
                        {isLogin ? "Enter your credentials to access your trips." : "Start splitting expenses smartly today."}
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="space-y-6">
          {/* GOOGLE BUTTON */}
          <motion.div variants={itemVariants}>
            <Button 
                variant="outline" 
                className="w-full h-12 bg-white/5 text-white hover:bg-white/10 border-white/10 hover:border-white/20 font-semibold text-sm rounded-xl transition-all shadow-lg" 
                onClick={handleGoogleLogin} 
                disabled={isGoogleLoading || isLoading}
            >
                {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-zinc-400" />
                ) : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                )}
                Continue with Google
            </Button>
          </motion.div>

          {/* DIVIDER */}
          <motion.div variants={itemVariants} className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-[#0b1021] px-3 text-zinc-500 rounded-full">Or continue with email</span>
            </div>
          </motion.div>

          {/* EMAIL FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <AnimatePresence mode="popLayout">
                {!isLogin && (
                <motion.div 
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    className="space-y-2"
                >
                    <Label htmlFor="name" className="text-zinc-400 text-xs uppercase font-bold tracking-wider ml-1">Full Name</Label>
                    <div className="relative group">
                        <User className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500 group-focus-within:text-[#00A896] transition-colors" />
                        <Input 
                            id="name" 
                            placeholder="John Doe" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            required 
                            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11 rounded-xl focus:border-[#00A896]/50 focus:bg-[#00A896]/5 transition-all"
                        />
                    </div>
                </motion.div>
                )}
            </AnimatePresence>

            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="email" className="text-zinc-400 text-xs uppercase font-bold tracking-wider ml-1">Email</Label>
              <div className="relative group">
                 <Mail className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500 group-focus-within:text-[#00A896] transition-colors" />
                 <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11 rounded-xl focus:border-[#00A896]/50 focus:bg-[#00A896]/5 transition-all"
                 />
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400 text-xs uppercase font-bold tracking-wider ml-1">Password</Label>
              <div className="relative group">
                 <Lock className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500 group-focus-within:text-[#00A896] transition-colors" />
                 <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11 rounded-xl focus:border-[#00A896]/50 focus:bg-[#00A896]/5 transition-all"
                 />
              </div>
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 overflow-hidden"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-bold rounded-xl bg-[#00A896] hover:bg-[#00A896]/90 text-white shadow-[0_0_20px_rgba(0,168,150,0.3)] transition-all mt-2" 
                    disabled={isLoading || isGoogleLoading}
                >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isLogin ? "Signing in..." : "Creating Account..."}
                    </>
                ) : (
                    isLogin ? "Sign In" : "Create Account"
                )}
                </Button>
            </motion.div>
          </form>
        </div>

        <motion.div variants={itemVariants} className="mt-6 text-center">
          <Button 
            variant="link" 
            onClick={onSwitchMode} 
            className="text-zinc-400 hover:text-[#00A896] transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}