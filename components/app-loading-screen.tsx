"use client"

import { useEffect, useState } from "react"
import { Plane } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const messages = [
  "Verifying your account",
  "Preparing your trips",
  "Finding your active journey",
  "Almost there…"
]

export function AppLoadingScreen() {
  const [dots, setDots] = useState("")
  const [msgIndex, setMsgIndex] = useState(0)

  // --- LOGIC PRESERVED 100% ---
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."))
    }, 450)

    const msgInterval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % messages.length)
    }, 2500)

    return () => {
      clearInterval(dotsInterval)
      clearInterval(msgInterval)
    }
  }, [])

  return (
    // RESTORED: bg-[#020617] (Your original dark navy)
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] relative overflow-hidden text-white font-sans">
      
      {/* RESTORED: Your original Purple and Teal Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#00A896]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="flex flex-col items-center gap-10 relative z-10">
        
        {/* Radar Animation */}
        <div className="relative flex items-center justify-center">
          
          {/* Outer Ripples - Using your #00A896 */}
          <motion.div 
            animate={{ scale: [1, 2], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute h-24 w-24 rounded-full border border-[#00A896]/30"
          />
          <motion.div 
            animate={{ scale: [1, 2], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
            className="absolute h-24 w-24 rounded-full border border-[#00A896]/30"
          />

          {/* Central Glass Circle */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
            className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_0_30px_rgba(0,168,150,0.2)]"
          >
            {/* Flying Plane Icon */}
            <motion.div
              animate={{ y: [0, -4, 0], rotate: [0, 5, 0] }} 
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Plane className="h-10 w-10 text-white fill-white/10" strokeWidth={1.5} />
            </motion.div>
          </motion.div>
        </div>

        {/* Typography */}
        <div className="flex flex-col items-center h-16">
          <AnimatePresence mode="wait">
            <motion.p 
              key={msgIndex}
              initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(5px)" }}
              transition={{ duration: 0.4 }}
              className="text-lg font-medium tracking-wide text-white"
            >
              {messages[msgIndex]}
              {/* RESTORED: Text color #00A896 */}
              <span className="inline-block w-4 text-[#00A896] font-bold">{dots}</span>
            </motion.p>
          </AnimatePresence>

          {/* RESTORED: Text-zinc-500 */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-2 text-xs text-zinc-500 uppercase tracking-[0.2em] font-medium"
          >
            Secure Environment
          </motion.p>
        </div>

        {/* Loading Bar - Using your #00A896 */}
        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/5 mt-4">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            // RESTORED: Gradient using #00A896
            className="h-full w-full bg-gradient-to-r from-transparent via-[#00A896] to-transparent opacity-70"
          />
        </div>

      </div>
    </div>
  )
}