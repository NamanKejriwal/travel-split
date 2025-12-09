import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabaseClient"
import { Plus, Users, Loader2, UserPlus, Copy, Check, Trash2, Eye, Settings, MapPin, Calendar, Wallet } from "lucide-react"
import { TripSettingsDialog } from "@/components/trip-settings-dialog"

export interface Group {
  id: string
  name: string
  created_at: string
  invite_code?: string
  created_by: string
  budget_per_person?: number
  destinations?: any[]
  trip_type?: string
  description?: string 
  ai_alerts_enabled?: boolean
  start_date?: string
  end_date?: string
  category_limits?: Record<string, number> 
  ai_alerts?: any[] // ADDED THIS
}

interface GroupsViewProps {
  onSelectGroup?: (group: Group) => void
}

export function GroupsView({ onSelectGroup }: GroupsViewProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  
  const [tripDialogOpen, setTripDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined)

  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)

  const [viewCode, setViewCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
            id, name, created_at, invite_code, created_by,
            budget_per_person, destinations, trip_type, description, ai_alerts_enabled, start_date, end_date, category_limits, ai_alerts
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // @ts-ignore
      const formattedGroups = (data || []).map(item => Array.isArray(item.groups) ? item.groups[0] : item.groups).filter(Boolean) as Group[]
      setGroups(formattedGroups)
    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClick = () => {
    setEditingGroup(undefined)
    setTripDialogOpen(true)
  }

  const handleEditClick = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation()
    setEditingGroup(group)
    setTripDialogOpen(true)
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault()
    setJoining(true)
    try {
      const { data, error } = await supabase.rpc('join_trip', { share_code: joinCode.trim() })
      if (error) throw error
      if (data && !data.success) throw new Error(data.message)

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

  async function handleDeleteGroup(groupId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm("Are you sure? This deletes all expenses and cannot be undone.")) return

    try {
        const { error } = await supabase.from('groups').delete().eq('id', groupId)
        if (error) throw error
        fetchGroups()
    } catch (error: any) {
        console.error("Error deleting group:", error)
        alert("Failed to delete group.")
    }
  }

  const handleViewCode = (code: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (code) setViewCode(code)
  }

  const copyCode = () => {
    if (viewCode) {
        navigator.clipboard.writeText(viewCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-4 pb-20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Your Trips</h2>
        <div className="flex gap-2">
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                        <UserPlus className="mr-2 h-4 w-4" /> Join
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join a Trip</DialogTitle>
                        <DialogDescription>Enter the 6-character invite code.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleJoinGroup} className="space-y-4">
                        <Input 
                            placeholder="e.g. x7k9p2" 
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            maxLength={6}
                            className="font-mono tracking-widest text-center text-lg uppercase"
                            required
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={joining} className="w-full">
                                {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Join Trip
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" /> New
            </Button>
        </div>
      </div>

      <TripSettingsDialog 
        open={tripDialogOpen} 
        onOpenChange={setTripDialogOpen} 
        existingGroup={editingGroup}
        onSuccess={fetchGroups}
      />

      <Dialog open={!!viewCode} onOpenChange={(val) => !val && setViewCode(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-center text-emerald-600">Invite Code</DialogTitle>
                <DialogDescription className="text-center">Share this with friends.</DialogDescription>
            </DialogHeader>
            <div className="bg-zinc-100 p-4 rounded-lg text-3xl font-mono font-bold text-center tracking-widest border border-zinc-200">
                {viewCode}
            </div>
            <Button className="w-full" onClick={copyCode}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy Code"}
            </Button>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-zinc-400" /></div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-10 w-10 text-zinc-300 mb-4" />
            <p className="text-zinc-500">No trips yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => {
            const isCreator = group.created_by === currentUserId
            const destCount = Array.isArray(group.destinations) ? group.destinations.length : 0
            
            return (
                <Card 
                    key={group.id} 
                    className="cursor-pointer hover:bg-zinc-50 transition-colors group relative"
                    onClick={() => onSelectGroup?.(group)}
                >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-lg font-semibold">{group.name}</CardTitle>
                        {destCount > 0 && (
                            <div className="flex items-center text-xs text-zinc-500 mt-1">
                                <MapPin className="w-3 h-3 mr-1" />
                                {group.destinations?.[0]?.name} {destCount > 1 ? `+${destCount - 1} more` : ''}
                            </div>
                        )}
                        {group.start_date && (
                            <div className="flex items-center text-xs text-zinc-400 mt-1">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(group.start_date).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                    {isCreator && (
                        <div className="flex flex-col gap-2">
                            <Button 
                                variant="secondary"
                                size="sm" 
                                className="h-8 px-3 text-xs border border-zinc-200"
                                onClick={(e) => handleEditClick(e, group)}
                            >
                                <Settings className="w-4 h-4 mr-1" /> Details
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-end mt-2 pt-2 border-t border-zinc-100">
                        {group.budget_per_person && group.budget_per_person > 0 ? (
                            <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center">
                                <Wallet className="w-3 h-3 mr-1" /> ₹{group.budget_per_person}/person
                            </span>
                        ) : <span />}
                        
                        {isCreator && (
                            <div className="flex gap-2">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-zinc-400"
                                    onClick={(e) => handleViewCode(group.invite_code, e)}
                                    title="Invite Code"
                                >
                                    <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-red-300 hover:text-red-500"
                                    onClick={(e) => handleDeleteGroup(group.id, e)}
                                    title="Delete Trip"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
                </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}