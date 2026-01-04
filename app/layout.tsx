import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "sonner"
import { ErrorBoundary } from "@/components/error-boundary"
import { Providers } from "@/app/providers"
import { AnimationConfig } from "@/components/animation-config" // <--- 1. IMPORT THIS
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "TravelSplit - Smart Expense Sharing",
  description: "Split travel expenses with friends effortlessly",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TravelSplit",
  },
}

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body className={`${geist.className} antialiased bg-[#020617] text-white overflow-x-hidden`}>
        <ErrorBoundary>
          <Providers>
            {/* 2. WRAP YOUR CHILDREN HERE */}
            <AnimationConfig>
              {children}
            </AnimationConfig>
          </Providers>
        </ErrorBoundary>
        
        <Toaster 
          position="top-center" 
          theme="dark"
          richColors 
          closeButton
          duration={3000}
          className="toaster-group"
          toastOptions={{
            style: {
              background: 'rgba(2, 6, 23, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
            }
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
