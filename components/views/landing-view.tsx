"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, FileText, CreditCard, Instagram, Twitter, Linkedin, Globe, ShieldCheck, Zap } from "lucide-react"
import { motion, useScroll, useTransform, useSpring, useMotionTemplate, useMotionValue } from "framer-motion"

// --- ANIMATION VARIANTS ---
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

// --- SPOTLIGHT CARD COMPONENT ---
function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <div
      className={`group relative border border-white/10 bg-white/5 overflow-hidden rounded-3xl on-hover-glow ${className}`}
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
    </div>
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
          <source 
            src="https://videos.pexels.com/video-files/3252226/3252226-hd_1920_1080_25fps.mp4" 
            type="video/mp4" 
          />
        </motion.video>
      </div>

      {/* --- NAVBAR --- */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 right-0 top-0 z-50 py-6"
      >
        <div className="container mx-auto flex items-center justify-between px-6">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-lg transition-transform duration-500 group-hover:rotate-12">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-glow">
                <path d="M12 2C7.58172 2 4 5.58172 4 10C4 14.4183 12 22 12 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 6V14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="12" cy="10" r="3.5" stroke="white" strokeWidth="0" fill="white"/>
                <path d="M9 10H15" stroke="#14b8a6" strokeWidth="2"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">TravelSplit</span>
          </div>
          
          {/* Removed Login Button */}
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
        
        {/* Removed V2.0 Badge - Headline is now top element */}

        {/* Headline */}
        <motion.h1 variants={fadeInUp} className="mx-auto max-w-5xl text-6xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-9xl drop-shadow-2xl">
          Travel <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-teal-400 to-teal-200 animate-gradient-x">Together.</span> <br />
          Split <span className="font-serif italic text-white/80">Smarter.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p variants={fadeInUp} className="mx-auto mt-8 max-w-2xl text-lg text-gray-300 sm:text-xl font-medium leading-relaxed drop-shadow-md">
          The fintech operating system for modern explorers. 
          Real-time expense tracking, instant multi-currency settlement, and AI budgeting.
        </motion.p>

        {/* Main CTA */}
        <motion.div variants={fadeInUp} className="mt-12 flex justify-center">
          <Button 
            size="lg" 
            onClick={onGetStarted}
            className="group relative h-16 overflow-hidden rounded-full bg-white px-12 text-lg font-bold text-slate-900 shadow-[0_0_50px_-12px_rgba(255,255,255,0.5)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_80px_-15px_rgba(255,255,255,0.7)]"
          >
            <span className="relative z-10 flex items-center">
              Start Splitting Free
              <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Button>
        </motion.div>
      </motion.main>

      {/* --- FEATURES BENTO GRID --- */}
      <div className="relative z-30 w-full rounded-t-[3rem] border-t border-white/10 bg-[#0a0a0a]/80 backdrop-blur-3xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,1)]">
        <div className="container mx-auto px-6 py-32">
          
          <div className="mb-20 text-center">
            <h2 className="text-3xl font-bold text-white md:text-5xl">Everything you need.</h2>
            <p className="mt-4 text-gray-400">Designed for power users, built for vacationers.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-2 h-auto md:h-[600px]">
            
            {/* Large Card (Left) */}
            <SpotlightCard className="md:col-span-2 md:row-span-2 p-10 flex flex-col justify-between bg-gradient-to-br from-white/5 to-transparent">
               <div>
                  <div className="h-14 w-14 rounded-2xl bg-teal-500/20 flex items-center justify-center text-teal-400 mb-6">
                    <Zap className="h-7 w-7" />
                  </div>
                  <h3 className="text-3xl font-bold text-white">Instant Settlement</h3>
                  <p className="mt-4 text-lg text-gray-400 max-w-md">
                    No more "I'll pay you later." Connect your cards via Plaid™ and settle debts instantly with a single tap. Supports 140+ currencies.
                  </p>
               </div>
               {/* Mock UI Element */}
               <div className="mt-8 w-full rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-500" />
                      <div className="text-sm">
                        <div className="text-white font-medium">Sarah sent you</div>
                        <div className="text-gray-500 text-xs">Just now</div>
                      </div>
                    </div>
                    <span className="text-teal-400 font-bold">+$124.50</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <ShieldCheck className="h-3 w-3" /> Encrypted Transaction
                  </div>
               </div>
            </SpotlightCard>

            {/* Small Card (Top Right) */}
            <SpotlightCard className="p-8 flex flex-col justify-center bg-black/20">
               <Sparkles className="h-8 w-8 text-teal-400 mb-4" />
               <h3 className="text-xl font-bold text-white">AI Accountant</h3>
               <p className="mt-2 text-sm text-gray-400">
                 "Hey AI, how much did we spend on sushi in Tokyo?" Get instant answers.
               </p>
            </SpotlightCard>

            {/* Small Card (Bottom Right) */}
            <SpotlightCard className="p-8 flex flex-col justify-center bg-black/20">
               <FileText className="h-8 w-8 text-blue-400 mb-4" />
               <h3 className="text-xl font-bold text-white">Export & Report</h3>
               <p className="mt-2 text-sm text-gray-400">
                 Generate beautiful PDF reports for business trips or personal records.
               </p>
            </SpotlightCard>

          </div>
        </div>

        {/* --- FOOTER --- */}
        <footer className="border-t border-white/5 bg-black/40 py-20">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:gap-20">
              <div className="col-span-2 lg:col-span-1">
                <span className="text-2xl font-bold text-white">TravelSplit</span>
                <p className="mt-4 text-sm text-gray-500">
                  Designed in California. <br/> Built for the world.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white">Product</h4>
                <ul className="mt-4 space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-white transition-colors">Download</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white">Legal</h4>
                <ul className="mt-4 space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                </ul>
              </div>
              <div>
                 <h4 className="font-semibold text-white">Social</h4>
                 <div className="mt-4 flex gap-4">
                    <Twitter className="h-5 w-5 text-gray-500 hover:text-white cursor-pointer transition-colors"/>
                    <Instagram className="h-5 w-5 text-gray-500 hover:text-white cursor-pointer transition-colors"/>
                 </div>
              </div>
            </div>
            <div className="mt-20 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-xs text-gray-600 md:flex-row">
              <p>&copy; 2025 TravelSplit Inc.</p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"/>
                <span>All Systems Operational</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}