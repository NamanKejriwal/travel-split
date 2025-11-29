import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabaseClient"
import { ArrowLeft } from "lucide-react"

// This interface now EXACTLY matches what your app/page.tsx is sending
interface AuthViewProps {
  mode: "login" | "signup"
  onSubmit: () => void
  onSwitchMode: () => void
  onBack: () => void
}

export function AuthView({ mode, onSubmit, onSwitchMode, onBack }: AuthViewProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isLogin = mode === "login"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (isLogin) {
        // --- REAL LOGIN LOGIC ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        onSubmit() // Tell parent app we are in!
      } else {
        // --- REAL SIGNUP LOGIC ---
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: "https://travel-split1.vercel.app",
          },
        })
        if (authError) throw authError

        // Logic to handle "Email Verification" setting
        if (data.session) {
            // If Email Confirmation is OFF (Development), we get a session immediately
            onSubmit() 
        } else {
            // If Email Confirmation is ON (Production), session is null until they click the link
            setSuccessMessage("Account created! Please check your email to verify your account, then log in.")
            // We don't switch mode immediately so they can read the message
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md relative">
        {/* Back Button */}
        <Button 
            variant="ghost" 
            size="icon" 
            className="absolute left-2 top-2" 
            onClick={onBack}
        >
            <ArrowLeft className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-zinc-900">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Login to access your trip expenses." : "Sign up to start splitting expenses."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name - Only show for Signup */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="John Doe" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="john@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            {successMessage && <p className="text-sm text-green-600 font-medium">{successMessage}</p>}

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
              {isLoading 
                ? (isLogin ? "Signing in..." : "Creating Account...") 
                : (isLogin ? "Sign In" : "Create Account")
              }
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button variant="link" onClick={onSwitchMode} className="text-zinc-500">
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}