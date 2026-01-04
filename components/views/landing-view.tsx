"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { 
  ArrowRight, Sparkles, FileText, CreditCard, Instagram, Mail, Zap, Brain, 
  TrendingUp, TrendingDown, Bell, Download, Search, Check, Loader2 
} from "lucide-react"
import { 
  motion, useScroll, useTransform, useSpring, useMotionTemplate, useMotionValue,
  useInView, AnimatePresence
} from "framer-motion"
import Link from "next/link"

// --- ANIMATION VARIANTS (With Build Fixes) ---
const fadeInUp = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } 
  }
}

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.15 } }
}

// --- MOCKUP COMPONENTS ---

// 1. AI Insights Mockup (Feed Style) - FIXED HYDRATION
function AIInsightsMockup() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" })
  
  // Fixed: Generate stable initial positions
  const particlePositions = React.useMemo(() => {
    // Use stable values that won't change between server/client
    return [
      { x: 30, y: 20 },
      { x: 60, y: 50 },
      { x: 80, y: 70 }
    ]
  }, [])

  return (
    <div ref={ref} className="w-full h-full flex flex-col justify-center gap-4 relative z-10 px-4">
      {/* Insight 1 */}
      <motion.div 
        initial={{ x: -40, opacity: 0, scale: 0.9 }}
        animate={isInView ? { x: 0, opacity: 1, scale: 1 } : {}}
        transition={{ 
          duration: 0.6, 
          type: "spring",
          stiffness: 100,
          damping: 15
        }}
        whileHover={{ 
          y: -5,
          transition: { duration: 0.2 }
        }}
        className="w-full bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex items-start gap-4 shadow-xl relative overflow-hidden group"
      >
        {/* Animated background effect */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent"
          initial={{ x: "-100%" }}
          animate={isInView ? { x: "100%" } : {}}
          transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
        />
        
        <div className="p-2.5 bg-rose-500/10 rounded-lg text-rose-500 shrink-0 mt-1 relative z-10">
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1, 1.1, 1]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2
            }}
          >
            <TrendingUp className="h-5 w-5" />
          </motion.div>
        </div>
        <div className="relative z-10">
          <h4 className="text-sm font-semibold text-zinc-200">High Spending Velocity</h4>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            You're spending <motion.span 
              className="text-white font-medium inline-block"
              animate={{ color: ["#ffffff", "#f43f5e", "#ffffff"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >₹2,500/day</motion.span> higher than planned. 
            Budget projected to end on Day 5.
          </p>
        </div>
      </motion.div>

      {/* Insight 2 */}
      <motion.div 
        initial={{ x: 40, opacity: 0, scale: 0.9 }}
        animate={isInView ? { x: 0, opacity: 1, scale: 1 } : {}}
        transition={{ 
          duration: 0.6, 
          delay: 0.2,
          type: "spring",
          stiffness: 100,
          damping: 15
        }}
        whileHover={{ 
          y: -5,
          transition: { duration: 0.2 }
        }}
        className="w-full bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex items-start gap-4 shadow-xl relative overflow-hidden group"
      >
        {/* Pulsing border */}
        <motion.div 
          className="absolute inset-0 border border-emerald-500/30 rounded-xl"
          animate={{ 
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
        
        <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0 mt-1 relative z-10">
          <motion.div
            animate={{ 
              y: [0, -2, 0, -2, 0],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
            }}
          >
            <TrendingDown className="h-5 w-5" />
          </motion.div>
        </div>
        <div className="relative z-10">
          <h4 className="text-sm font-semibold text-zinc-200">Savings Opportunity</h4>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            Transport is 40% of total. 
            <motion.span 
              className="text-emerald-400 mt-1 block font-medium"
              animate={{ 
                scale: [1, 1.05, 1],
                textShadow: ["0 0 0px rgba(52, 211, 153, 0)", "0 0 10px rgba(52, 211, 153, 0.5)", "0 0 0px rgba(52, 211, 153, 0)"]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1
              }}
            >
              ✨ Switch to weekly metro pass to save ₹1,200.
            </motion.span>
          </p>
        </div>
      </motion.div>

      {/* Floating particles background - FIXED: Stable initial positions */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particlePositions.map((pos, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-amber-400/20 rounded-full"
            initial={{ 
              x: `${pos.x}%`,
              y: `${pos.y}%`,
              opacity: 0
            }}
            animate={{ 
              y: [null, `${pos.y - 20}%`, `${pos.y}%`],
              opacity: [0, 0.5, 0],
            }}
            transition={{ 
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  )
}

// 2. Settlement Mockup - FIXED FOR MOBILE CENTERING
function SettlementMockup() {
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    const cycle = async () => {
      while (true) {
        setStep(0); await new Promise(r => setTimeout(r, 1800))
        setStep(1); await new Promise(r => setTimeout(r, 1200))
        setStep(2); await new Promise(r => setTimeout(r, 2500))
      }
    }
    
    const timeoutId = setTimeout(() => {
      cycle()
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [mounted])
  
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-xs mx-auto">
        <AnimatePresence mode="wait">
          {mounted && step === 0 && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-16 bg-white/20 rounded-full" />
                  <div className="h-1.5 w-10 bg-white/10 rounded-full" />
                </div>
              </div>
              <div className="h-8 w-full bg-[#00A896]/10 rounded-lg flex items-center justify-center border border-[#00A896]/20">
                <span className="text-[10px] font-bold text-[#00A896]">Add Expense</span>
              </div>
            </motion.div>
          )}
          {mounted && step === 1 && (
            <motion.div
              key="calc"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center gap-2"
            >
              <Loader2 className="h-10 w-10 text-[#00A896] animate-spin" />
              <span className="text-[10px] font-bold text-zinc-400">OPTIMIZING...</span>
            </motion.div>
          )}
          {mounted && step === 2 && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full bg-gradient-to-br from-[#00A896]/20 to-[#00A896]/5 border border-[#00A896]/30 rounded-2xl p-4 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <span className="text-[10px] font-bold text-[#00A896] uppercase">Debt Simplified</span>
                <motion.div 
                  className="bg-[#00A896] rounded-full p-0.5"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  <Check className="h-3 w-3 text-black stroke-[3]" />
                </motion.div>
              </div>
              <div className="text-center py-2 relative z-10">
                <motion.span 
                  className="text-2xl font-black text-white inline-block"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  ₹1,200
                </motion.span>
                <p className="text-[9px] text-zinc-400">Total settlement</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// 3. Email Notification Mockup
function EmailMockup() {
  return (
    <div className="w-full flex items-center justify-center p-2">
      <motion.div 
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        whileInView={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="w-full bg-[#1c1c1e] border border-white/10 rounded-2xl p-4 shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#00A896] flex items-center justify-center">
               <Mail className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">TravelSplit</span>
          </div>
          <span className="text-[9px] text-zinc-500">now</span>
        </div>
        <div className="pl-0 space-y-1">
          <h4 className="text-sm font-semibold text-white">New Expense Added</h4>
          <p className="text-xs text-zinc-400 leading-snug">
            Rahul added <span className="text-white">Flight Tickets</span>. 
            You owe <span className="text-[#00A896] font-bold">₹5,200</span>.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// 4. Analytics Mockup
function AnalyticsMockup() {
  return (
    <div className="w-full h-full flex flex-col justify-end px-3 pb-3">
      <div className="relative h-32 w-full bg-gradient-to-t from-[#00A896]/10 to-transparent rounded-xl border-b border-[#00A896]/20 overflow-hidden">
        <svg className="absolute bottom-0 left-0 right-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 50">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00A896" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00A896" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path 
            d="M0,50 L0,30 C20,45 40,15 60,30 C80,45 100,20 L100,50 Z" 
            fill="url(#chartGradient)" 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.path 
            d="M0,30 C20,45 40,15 60,30 C80,45 100,20" 
            fill="none" 
            stroke="#00A896" 
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </svg>
        <motion.div 
          className="absolute top-0 bottom-0 w-[1px] bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          initial={{ left: "0%" }}
          whileInView={{ left: "100%" }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
      </div>
      <div className="w-full h-[1px] bg-white/10 mt-1" />
      <div className="flex justify-between mt-2 px-1">
         {['M','T','W','T','F','S','S'].map((d, i) => (
           <span key={i} className="text-[8px] text-zinc-600 font-medium">{d}</span>
         ))}
      </div>
    </div>
  )
}

// 5. Export Mockup
function ExportMockup() {
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    const cycle = async () => {
      while (true) {
        setStep(0); await new Promise(r => setTimeout(r, 1500))
        setStep(1); await new Promise(r => setTimeout(r, 1500))
        setStep(2); await new Promise(r => setTimeout(r, 2000))
      }
    }
    
    const timeoutId = setTimeout(() => {
      cycle()
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [mounted])
  
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <AnimatePresence mode="wait">
        {mounted && step === 0 && (
          <motion.div
            key="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="h-9 px-4 bg-[#00A896] rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(0,168,150,0.4)]"
          >
            <Download className="h-3.5 w-3.5 text-white" />
            <span className="text-[10px] font-bold text-white">Export Data</span>
          </motion.div>
        )}
        {mounted && step === 1 && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2 w-full px-6"
          >
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.2, ease: "linear" }} className="h-full bg-[#00A896]" />
            </div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Generating PDF...</span>
          </motion.div>
        )}
        {mounted && step === 2 && (
          <motion.div
            key="files"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex gap-4"
          >
            <div className="h-14 w-12 bg-[#0a0a0a] border border-red-500/30 rounded-xl flex flex-col items-center justify-center gap-1 shadow-2xl relative">
              <div className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 border border-zinc-800"><Check className="h-2 w-2 text-green-500" /></div>
              <FileText className="h-5 w-5 text-red-500" />
              <span className="text-[7px] font-bold text-red-400">PDF</span>
            </div>
            <div className="h-14 w-12 bg-[#0a0a0a] border border-emerald-500/30 rounded-xl flex flex-col items-center justify-center gap-1 shadow-2xl relative">
              <div className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 border border-zinc-800"><Check className="h-2 w-2 text-green-500" /></div>
              <FileText className="h-5 w-5 text-emerald-500" />
              <span className="text-[7px] font-bold text-emerald-400">XLS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 6. Search Mockup
// 6. Search Mockup - WITH TYPEWRITER EFFECT
function SearchMockup() {
  const [displayText, setDisplayText] = useState("")
  const fullText = "Dinner at Manali"
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  
  useEffect(() => {
    if (!isInView) return
    
    let i = 0
    const typingInterval = setInterval(() => {
      if (i < fullText.length) {
        setDisplayText(fullText.substring(0, i + 1))
        i++
      } else {
        clearInterval(typingInterval)
      }
    }, 60)
    
    return () => clearInterval(typingInterval)
  }, [isInView])

  return (
    <div ref={ref} className="w-full flex flex-col gap-3">
      <div className="h-10 w-full bg-[#0a0a0a] border border-white/10 rounded-xl flex items-center px-3 gap-3 shadow-inner">
        <Search className="h-4 w-4 text-zinc-500" />
        <div className="flex-1 overflow-hidden relative h-5">
          <div className="absolute left-0 top-0 h-full whitespace-nowrap overflow-hidden flex items-center">
            <div className="relative">
              <span className="text-sm text-zinc-300">"{displayText}"</span>
              {isInView && displayText.length < fullText.length && (
                <motion.span 
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="ml-0.5 h-4 w-[1px] bg-[#00A896] inline-block"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
            <Zap className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Dinner at Manali</p>
            <p className="text-[10px] text-zinc-500">Paid by You • Yesterday</p>
          </div>
        </div>
        <span className="text-xs font-bold text-white">₹4,500</span>
      </motion.div>
    </div>
  )
}

// --- SPOTLIGHT CARD ---
function SpotlightCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`group relative border border-white/10 bg-white/5 overflow-hidden rounded-3xl hover:border-white/20 transition-all duration-300 ${className}`}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(20, 184, 166, 0.15),
              transparent 80%
            )
          `,
        }}
      />
      <div className="relative h-full">{children}</div>
    </motion.div>
  )
}

interface LandingViewProps {
  onGetStarted: () => void
}

export function LandingView({ onGetStarted }: LandingViewProps) {
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0])
  const heroScale = useTransform(scrollY, [0, 600], [1, 0.9])

  return (
    <div className="relative flex min-h-screen flex-col font-sans text-white selection:bg-teal-400 selection:text-black bg-[#050505]">
      
      {/* --- CINEMATIC BACKGROUND --- */}
      <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0 z-10 bg-black/40" /> 
        <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/80" />
        
        <motion.video
          autoPlay
          loop
          muted
          playsInline
          style={{ scale: useSpring(useTransform(scrollY, [0, 1000], [1.1, 1.2]), { stiffness: 50, damping: 20 }) }}
          className="h-full w-full object-cover opacity-80"
        >
          <source src="/background.mp4" type="video/mp4" />
          <source src="https://videos.pexels.com/video-files/3252226/3252226-hd_1920_1080_25fps.mp4" type="video/mp4" />
        </motion.video>
      </div>

      {/* --- NAVBAR --- */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
        className="fixed left-0 right-0 top-0 z-50 py-6"
      >
        <div className="container mx-auto flex items-center justify-between px-6">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-lg transition-transform duration-500 group-hover:rotate-12">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C7.58172 2 4 5.58172 4 10C4 14.4183 12 22 12 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 6V14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="12" cy="10" r="3.5" fill="white"/>
                <path d="M9 10H15" stroke="#14b8a6" strokeWidth="2"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">TravelSplit</span>
          </div>
        </div>
      </motion.nav>

      {/* --- HERO SECTION --- */}
      <motion.main 
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative z-20 flex flex-col items-center justify-center px-4 pt-40 pb-32 text-center sm:px-6 lg:px-8 min-h-screen"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.h1 variants={fadeInUp} className="mx-auto max-w-5xl text-6xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-9xl drop-shadow-2xl">
          Travel <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-teal-400 to-teal-200 animate-gradient-x">Together.</span> <br />
          Split <span className="font-serif italic text-white/80">Smarter.</span>
        </motion.h1>

        <motion.p variants={fadeInUp} className="mx-auto mt-8 max-w-2xl text-lg text-gray-300 sm:text-xl font-medium leading-relaxed drop-shadow-md">
          The fintech operating system for modern explorers. 
          Real-time expense tracking, automatic debt calculation, and AI-powered budget insights.
        </motion.p>

        <motion.div variants={fadeInUp} className="mt-12 flex justify-center">
          <Button 
            size="lg" 
            onClick={onGetStarted}
            className="group relative h-16 overflow-hidden rounded-full bg-white px-12 text-lg font-bold text-slate-900 shadow-[0_0_50px_-12px_rgba(255,255,255,0.5)] transition-all duration-300 hover:scale-[1.03]"
          >
            <span className="relative z-10 flex items-center">
              Start Splitting
              <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Button>
        </motion.div>
      </motion.main>

      {/* --- FEATURES SECTION --- */}
      <div className="relative z-30 w-full bg-[#020617] rounded-t-[3rem] shadow-[0_-50px_100px_rgba(0,0,0,0.8)] border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 py-24 sm:py-32">
          
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <h2 className="text-4xl font-black text-white md:text-6xl tracking-tight mb-6">Designed for clarity.</h2>
            <p className="text-zinc-400 text-lg">We stripped away the complexity. What remains is the fastest, most intelligent way to manage shared expenses.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            
            {/* ROW 1 */}
            {/* 1. AI COMPANION (Hero) */}
            <SpotlightCard className="lg:col-span-2 p-8 sm:p-10 flex flex-col sm:flex-row gap-10 bg-gradient-to-br from-[#0a0a0a] to-black min-h-[420px]">
               {/* LEFT TEXT BLOCK */}
               <div className="flex-1 flex flex-col justify-center z-10">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-6 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                    <Brain className="h-6 w-6" />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">AI Financial Companion</h3>
                  <p className="text-base text-zinc-400 leading-relaxed">
                    Not just a tracker. Our AI analyzes your spending patterns in real-time, sending smart alerts when you overspend and tips to save money.
                  </p>
               </div>
               
               {/* RIGHT MOCKUP PANEL */}
               <div className="flex-1 relative mt-6 sm:mt-0 min-h-[300px] sm:min-h-[460px]">
                  <div className="absolute inset-0 bg-[#020617] rounded-3xl border border-white/10 shadow-2xl p-4 flex flex-col justify-center overflow-visible">
                     {/* Top Accent Bar */}
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-blue-500 opacity-70 rounded-t-3xl" />
                     {/* AI CARDS */}
                     <AIInsightsMockup />
                  </div>
               </div>
            </SpotlightCard>

            {/* 2. ACCURATE SETTLEMENT (Tall) - FIXED FOR MOBILE */}
            <SpotlightCard delay={0.1} className="lg:col-span-1 lg:row-span-2 p-8 flex flex-col bg-[#050505] min-h-[450px]">
               <div className="mb-8">
                  <div className="h-12 w-12 rounded-2xl bg-[#00A896]/10 flex items-center justify-center text-[#00A896] mb-6 border border-[#00A896]/20 shadow-[0_0_20px_rgba(0,168,150,0.1)]">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Accurate Settlement</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Just add the expense and forget the math. We simplify complex debts into minimal transactions instantly.
                  </p>
               </div>
               {/* FIXED: Added flex-grow and proper centering */}
               <div className="flex-grow flex items-center justify-center w-full">
                  <div className="w-full max-w-sm mx-auto h-full flex items-center justify-center">
                    <SettlementMockup />
                  </div>
               </div>
            </SpotlightCard>

            {/* ROW 2 */}
            {/* 3. VISUAL ANALYTICS (Wide) */}
            <SpotlightCard delay={0.3} className="lg:col-span-2 p-8 flex flex-col justify-between bg-black min-h-[320px]">
               <div className="flex items-start justify-between">
                 <div>
                    <h3 className="text-2xl font-bold text-white">Visual Analytics</h3>
                    <p className="mt-2 text-sm text-zinc-500 max-w-sm">
                      Track your burn rate and category spend with interactive, real-time charts.
                    </p>
                 </div>
                 <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                 </div>
               </div>
               <div className="mt-6 h-48">
                 <AnalyticsMockup />
               </div>
            </SpotlightCard>

            {/* ROW 3 - 3 Equal Columns */}
            
            {/* 4. NOTIFICATIONS */}
            <SpotlightCard delay={0.2} className="p-8 flex flex-col justify-center bg-black min-h-[300px]">
               <div className="mb-6">
                 <div className="flex items-center gap-3 mb-4">
                    <Bell className="h-6 w-6 text-blue-400" />
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Updates</span>
                 </div>
                 <h3 className="text-xl font-bold text-white">Notifications</h3>
                 <p className="mt-2 text-sm text-zinc-500">
                   Get premium alerts for every trip update.
                 </p>
               </div>
               <div className="mt-2">
                  <EmailMockup />
               </div>
            </SpotlightCard>

            {/* 5. EXPORT */}
            <SpotlightCard delay={0.4} className="p-8 flex flex-col justify-center bg-[#050505] min-h-[300px]">
               <div className="mb-6">
                 <div className="flex items-center gap-3 mb-4">
                    <Download className="h-6 w-6 text-green-400" />
                    <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Offline</span>
                 </div>
                 <h3 className="text-xl font-bold text-white">Export Data</h3>
                 <p className="mt-2 text-sm text-zinc-500">
                   Download full trip reports in PDF or Excel.
                 </p>
               </div>
               <div className="mt-2 h-24">
                  <ExportMockup />
               </div>
            </SpotlightCard>

            {/* 6. SEARCH */}
            <SpotlightCard delay={0.5} className="p-8 flex flex-col justify-center bg-[#0a0a0a] min-h-[300px]">
               <div className="mb-6">
                 <div className="flex items-center gap-3 mb-4">
                    <Search className="h-6 w-6 text-orange-400" />
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Search</span>
                 </div>
                 <h3 className="text-xl font-bold text-white">Universal Search</h3>
                 <p className="mt-2 text-sm text-zinc-500">
                   Instantly locate any expense or person.
                 </p>
               </div>
               <SearchMockup />
            </SpotlightCard>

          </div>
        </div>

        {/* --- FOOTER --- */}
        <footer className="border-t border-white/5 bg-black pt-24 pb-12 relative z-40">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
              <div className="md:col-span-1 space-y-6">
                <div className="flex items-center gap-3">
                   <span className="text-2xl font-serif font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>TravelSplit</span>
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
                  We believe financial clarity shouldn't come at the cost of adventure. 
                  Built with precision in India for the global explorer.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Product</h4>
                <ul className="space-y-4 text-sm text-zinc-500">
                  <li>
                    <Link href="/features" className="hover:text-[#00A896] transition-colors cursor-pointer flex items-center gap-2">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="/security" className="hover:text-[#00A896] transition-colors cursor-pointer flex items-center gap-2">
                      Security
                    </Link>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Legal</h4>
                <ul className="space-y-4 text-sm text-zinc-500">
                  <li>
                    <Link href="/privacy" className="hover:text-[#00A896] transition-colors cursor-pointer flex items-center gap-2">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-[#00A896] transition-colors cursor-pointer flex items-center gap-2">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <a href="mailto:tripsplit8@gmail.com" className="hover:text-[#00A896] transition-colors cursor-pointer flex items-center gap-2">
                      Contact Support
                    </a>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Connect</h4>
                <div className="flex gap-3">
                  <motion.a 
                    whileTap={{ scale: 0.98 }}
                    href="#" 
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all duration-300"
                  >
                    <Instagram className="h-5 w-5" />
                  </motion.a>
                  <motion.a 
                    whileTap={{ scale: 0.98 }}
                    href="mailto:tripsplit8@gmail.com" 
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all duration-300"
                  >
                    <Mail className="h-5 w-5" />
                  </motion.a>
                </div>
              </div>
            </div>
            
            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">&copy; 2025 TravelSplit Inc. All rights reserved.</p>
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 tracking-wide">SYSTEMS OPERATIONAL</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}