import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"
import { Plus, Users, Loader2, UserPlus, Copy, Check, Trash2, Eye } from "lucide-react"

export interface Group {
  id: string
  name: string
  created_at: string
  invite_code?: string
  created_by: string
}

interface GroupsViewProps {
  onSelectGroup?: (group: Group) => void
}

export function GroupsView({ onSelectGroup }: GroupsViewProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  
  // Create State
  const [open, setOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [creating, setCreating] = useState(false)

  // Join State
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)

  // Success State (After Create or View Code)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // 1. Fetch Groups from Supabase
  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id,
            name,
            created_at,
            invite_code,
            created_by
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // FIXED: robust mapping to handle if 'groups' is returned as object or array
      // @ts-ignore
      const formattedGroups = (data || []).map(item => {
        const groupData = Array.isArray(item.groups) ? item.groups[0] : item.groups
        return groupData
      }).filter(Boolean) as Group[]

      setGroups(formattedGroups)
    } catch (error: any) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoading(false)
    }
  }

  // 2. Create New Group Logic
  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user found")

      // Step A: Insert the Group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName,
          created_by: user.id
        })
        .select()
        .single()

      if (groupError) throw groupError
      
      if (!groupData) throw new Error("Group created but no ID returned.")

      // Step B: Add YOU as the first member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id
        })

      if (memberError) throw memberError

      // Step C: Success! Show code and refresh.
      setNewGroupName("")
      setOpen(false)
      setCreatedCode(groupData.invite_code) // Show success dialog
      fetchGroups()

    } catch (error: any) {
      console.error('Error creating group:', error)
      alert(error.message || "Failed to create group.")
    } finally {
      setCreating(false)
    }
  }

  // 3. Join Group Logic (Updated to use Secure Database Function)
  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault()
    setJoining(true)

    try {
      // Call the secure RPC function we created in SQL
      // This bypasses RLS to check the code and adds the member safely
      const { data, error } = await supabase.rpc('join_trip', { 
        share_code: joinCode.trim() 
      })

      if (error) throw error

      // Check the custom response from our SQL function
      if (data && !data.success) {
        throw new Error(data.message)
      }

      // Success
      setJoinCode("")
      setJoinOpen(false)
      fetchGroups()
      alert("Successfully joined the trip!")

    } catch (error: any) {
      console.error('Error joining group:', error)
      alert(error.message || "Failed to join group.")
    } finally {
      setJoining(false)
    }
  }

  // 4. Delete Group Logic
  async function handleDeleteGroup(groupId: string, e: React.MouseEvent) {
    e.stopPropagation() // Prevent entering the group when clicking delete
    
    if (!confirm("Are you sure you want to delete this trip? This action cannot be undone and will remove all expenses.")) {
        return
    }

    try {
        const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', groupId)

        if (error) throw error
        
        // Refresh list
        fetchGroups()

    } catch (error: any) {
        console.error("Error deleting group:", error)
        alert("Failed to delete group. Make sure you have the 'Delete' policy enabled in Supabase.")
    }
  }

  // 5. View Code Logic
  const handleViewCode = (code: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (code) setCreatedCode(code)
  }

  const copyCreatedCode = () => {
    if (createdCode) {
        navigator.clipboard.writeText(createdCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-4 pb-20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Your Trips</h2>
        
        <div className="flex gap-2">
            {/* JOIN GROUP DIALOG */}
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                        <UserPlus className="mr-2 h-4 w-4" /> Join
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join an existing trip</DialogTitle>
                        <DialogDescription>
                            Enter the 6-character code shared by your friend.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleJoinGroup} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Invite Code</Label>
                            <Input 
                                id="code" 
                                placeholder="e.g. x7k9p2" 
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                maxLength={6}
                                className="font-mono tracking-widest"
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={joining}>
                                {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {joining ? "Joining..." : "Join Trip"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* CREATE GROUP DIALOG */}
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" /> New
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create a new trip</DialogTitle>
                <DialogDescription>
                    Start tracking expenses for a new adventure.
                </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Trip Name</Label>
                    <Input 
                    id="name" 
                    placeholder="e.g. Goa 2024" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                    />
                </div>
                <DialogFooter>
                    <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {creating ? "Creating..." : "Create Trip"}
                    </Button>
                </DialogFooter>
                </form>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* SUCCESS/VIEW CODE DIALOG */}
      <Dialog open={!!createdCode} onOpenChange={(val) => !val && setCreatedCode(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-center text-emerald-600">Invite Code</DialogTitle>
                <DialogDescription className="text-center">
                    Share this code with friends so they can join this trip.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center space-x-2 my-4">
                <div className="bg-zinc-100 px-6 py-3 rounded-lg text-2xl font-mono tracking-widest font-bold border border-zinc-200">
                    {createdCode}
                </div>
            </div>
            <Button className="w-full" onClick={copyCreatedCode}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied to Clipboard" : "Copy Code"}
            </Button>
        </DialogContent>
      </Dialog>

      {/* LIST OF GROUPS */}
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-10 w-10 text-zinc-300 mb-4" />
            <p className="text-zinc-500">You haven't joined any trips yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => {
            const isCreator = group.created_by === currentUserId
            return (
                <Card 
                key={group.id} 
                className="cursor-pointer hover:bg-zinc-50 transition-colors relative group"
                onClick={() => onSelectGroup?.(group)}
                >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-semibold">{group.name}</CardTitle>
                    <Users className="h-4 w-4 text-zinc-400" />
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-zinc-500 mb-2">Created {new Date(group.created_at).toLocaleDateString()}</p>
                    
                    {/* Creator Actions */}
                    {isCreator && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100">
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs flex-1"
                                onClick={(e) => handleViewCode(group.invite_code, e)}
                             >
                                <Eye className="w-3 h-3 mr-1" /> View Code
                             </Button>
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDeleteGroup(group.id, e)}
                             >
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                             </Button>
                        </div>
                    )}
                </CardContent>
                </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}