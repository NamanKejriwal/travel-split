import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, LogOut, User, Mail, Save } from "lucide-react"

interface AccountViewProps {
  onLogout: () => void
}

export function AccountView({ onLogout }: AccountViewProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUser(user)
      setEmail(user.email || "")

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (data) {
        setFullName(data.full_name || "")
      }
    } catch (error) {
      console.error('Error loading user data!', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          email: email, // Keep email in sync
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      alert('Profile updated!')
    } catch (error) {
      alert('Error updating the data!')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    onLogout()
  }

  if (loading) {
    return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-zinc-400" /></div>
  }

  return (
    <div className="p-4 pb-20 space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Account</h2>

      {/* Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-16 w-16">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`} />
            <AvatarFallback>
                {fullName ? fullName[0].toUpperCase() : <User />}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{fullName || "User"}</CardTitle>
            <CardDescription>{email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input id="email" value={email} disabled className="pl-9 bg-zinc-50" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input 
                    id="name" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    className="pl-9"
                />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
            <Button onClick={updateProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save Changes"}
            </Button>
        </CardFooter>
      </Card>

      {/* Logout Zone */}
      <div className="pt-4">
        <Button 
            variant="destructive" 
            className="w-full" 
            onClick={handleSignOut}
        >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
        </Button>
        <p className="text-center text-xs text-zinc-400 mt-4">
            TravelSplit v1.0
        </p>
      </div>
    </div>
  )
}