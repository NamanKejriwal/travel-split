"use client"

import { Component, type ReactNode } from "react"
import { AlertCircle, RefreshCw, Home, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

// --- FALLBACK UI COMPONENT (Functional for Animations) ---
const ErrorFallback = ({ error, reset }: { error: Error | null, reset: () => void }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 relative overflow-hidden font-sans">
       
       {/* Ambient Background Glows (Red for Error) */}
       <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] bg-rose-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] bg-red-900/10 rounded-full blur-[100px]" />
       </div>
       
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         transition={{ type: "spring" as const, stiffness: 260, damping: 20 }}
         className="relative z-10 w-full max-w-md bg-[#020617]/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl text-center"
       >
         {/* Icon with Pulse */}
         <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-rose-500/20"
            />
            <AlertCircle className="h-10 w-10 text-rose-500 relative z-10" />
         </div>

         <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">System Malfunction</h2>
         
         <p className="text-zinc-400 mb-8 text-sm leading-relaxed max-w-[90%] mx-auto">
            {error?.message || "An unexpected error occurred. Our systems have logged this event."}
         </p>

         {/* Action Buttons */}
         <div className="flex flex-col gap-3">
             <Button 
                onClick={reset}
                className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-transform active:scale-[0.98]"
             >
                <RefreshCw className="h-4 w-4 mr-2" /> Try Again
             </Button>
             
             <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full h-12 bg-transparent border-white/10 text-white hover:bg-white/5 rounded-xl transition-transform active:scale-[0.98]"
             >
                <Home className="h-4 w-4 mr-2" /> Return Home
             </Button>
         </div>

         {/* Developer Stack Trace (Only in Dev) */}
         {process.env.NODE_ENV === 'development' && error && (
             <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-8 p-4 bg-black/40 rounded-xl border border-white/5 text-left overflow-hidden"
             >
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-2 font-mono uppercase tracking-widest font-bold">
                    <Terminal className="h-3 w-3" /> Stack Trace
                </div>
                <p className="text-[10px] font-mono text-rose-300 break-all opacity-80 leading-relaxed">
                    {error.stack?.slice(0, 350)}...
                </p>
             </motion.div>
         )}
       </motion.div>
    </div>
  )
}

// --- MAIN CLASS COMPONENT (Required for Error Boundaries) ---

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Use the custom Fallback component for animations
      return this.props.fallback || (
        <ErrorFallback 
            error={this.state.error} 
            reset={() => this.setState({ hasError: false, error: null })} 
        />
      )
    }

    return this.props.children
  }
}