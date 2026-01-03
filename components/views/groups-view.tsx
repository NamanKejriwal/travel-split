"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import { TripSettingsDialog } from "@/components/trip-settings-dialog"
import { ViewMembersDialog } from "@/components/view-members-dialog"
import { toast } from "sonner"

import { 
  Plus,
  Users,
  Loader2,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Eye,
  Settings,
  MapPin,
  Calendar,
  Wallet
} from "lucide-react"

const supabase = createClient()

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 260, damping: 20 }
  },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
}

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
  ai_alerts?: any[]
}

interface GroupsViewProps {
  onSelectGroup?: (group: Group) => void
}

export function GroupsView({ onSelectGroup }: GroupsViewProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState("")

  const [tripDialogOpen, setTripDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined)

  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)

  const [viewCode, setViewCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("lastViewedGroupId")
    if (stored) setSelectedGroupId(stored)
    fetchGroups()
  }, [])

  // Real-time subscription for group changes
// Real-time subscription for group changes
useEffect(() => {
  if (!currentUserId) return

  const channel = supabase
    .channel("user-groups")
    // 1. LISTEN TO MEMBERSHIP CHANGES (Join/Leave/Remove)
    // This is efficient because it only fires when *YOU* are affected.
    .on(
      "postgres_changes",
      {
        schema: "public",
        table: "group_members",
        event: "*",
        filter: `user_id=eq.${currentUserId}`
      },
      () => {
        // Refresh groups silently (background = true)
        fetchGroups(true)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [currentUserId])
  // Updated fetchGroups to handle background refreshes (prevents flickering)
 // Updated fetchGroups to avoid Auth Rate Limiting
 async function fetchGroups(isBackground = false) {
  if (!isBackground) setLoading(true)

  try {
    let targetUserId = currentUserId;

    // FIX: Only hit the Auth API if we don't have the ID yet
    if (!targetUserId) {
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      if (!user) return
      targetUserId = user.id
      setCurrentUserId(user.id)
    }

    // Use the local variable 'targetUserId' instead of fetching 'user' again
    const { data, error } = await supabase
      .from("group_members")
      .select(`
        group_id,
        groups(
          id,
          name,
          created_at,
          invite_code,
          created_by,
          budget_per_person,
          destinations,
          trip_type,
          description,
          ai_alerts_enabled,
          start_date,
          end_date,
          category_limits,
          ai_alerts
        )
      `)
      .eq("user_id", targetUserId) // <--- Use the variable

    if (error) throw error

    const formatted = (data || [])
      .map(item => Array.isArray(item.groups) ? item.groups[0] : item.groups)
      .filter(Boolean)

    setGroups(formatted)
  } catch (err) {
    console.error("❌ Error fetching groups:", err)
    // Only show toast if it's a real error (not just a network blip)
    if (!isBackground) toast.error("Failed to load trips")
  } finally {
    if (!isBackground) setLoading(false)
  }
}

  const handleCreateClick = () => {
    setEditingGroup(undefined)
    setTripDialogOpen(true)
  }

  const handleEditClick = (e: any, group: Group) => {
    e.stopPropagation()
    setEditingGroup(group)
    setTripDialogOpen(true)
  }

  async function handleJoinGroup(e?: any) {
    if (e) e.preventDefault()
    setJoining(true)

    try {
      const code = joinCode.trim()
      if (!code || code.length < 6) throw new Error("Invalid code")

      const { data, error } = await supabase.rpc("join_trip", { share_code: code })

      if (error) throw error
      if (data && !data.success) throw new Error(data.message)

      setJoinCode("")
      setJoinOpen(false)
      fetchGroups()
      toast.success("Successfully joined trip!")
    } catch (err: any) {
      console.error("❌ Join Trip Error:", err)
      toast.error(err?.message || "Failed to join trip")
    } finally {
      setJoining(false)
    }
  }

  async function handleDeleteGroup(id: string, e: any) {
    e.stopPropagation()

    if (!confirm("Delete this trip permanently? This cannot be undone.")) return

    try {
      // =========================================================
      // 1. GUARD: CHECK SETTLEMENTS
      // =========================================================
      const { data: balances, error: balanceError } = await supabase
        .rpc('get_trip_balances', { p_group_id: id })

      if (balanceError) throw balanceError

      // Check if anyone has a balance greater than ₹1 (positive or negative)
      const hasUnsettledMembers = balances?.some((m: any) => Math.abs(m.net_balance) > 1.0)

      if (hasUnsettledMembers) {
        toast.error("Cannot delete trip yet!", {
          description: "All members must be fully settled up (₹0 balance) before the trip can be deleted."
        })
        return; 
      }

      // =========================================================
      // 2. PREPARE EMAIL NOTIFICATIONS
      // =========================================================
      const { data: members } = await supabase
        .from('group_members')
        .select('profiles(full_name, email)')
        .eq('group_id', id)

      const groupName = groups.find(g => g.id === id)?.name || "Trip"

      // =========================================================
      // 3. DELETE THE GROUP
      // =========================================================
      const { error, count } = await supabase
        .from("groups")
        .delete({ count: 'exact' })
        .eq("id", id)

      if (error) throw error

      if (count === 0) {
        throw new Error("Permission denied or group already deleted.")
      }

      // =========================================================
      // 4. UPDATE UI & SEND EMAILS
      // =========================================================
      
      // Optimistic UI update
      setGroups(prev => prev.filter(g => g.id !== id))
      if (selectedGroupId === id) {
        setSelectedGroupId(null)
        localStorage.removeItem("lastViewedGroupId")
      }

      toast.success("Trip deleted successfully")

      // Send Emails
      const recipients = (members || [])
        .map((m: any) => m.profiles)
        .filter((p: any) => p?.email)

      if (recipients.length > 0) {
        fetch('/api/notify', {
          method: 'POST',
          body: JSON.stringify({
            type: 'GROUP',
            action: 'DELETED',
            groupName: groupName,
            payerName: "The Admin",
            recipients: recipients.map((r: any) => ({ email: r.email, name: r.full_name }))
          })
        })
      }

    } catch (err: any) {
      console.error("❌ Delete Trip Error:", err)
      toast.error(err.message || "Failed to delete trip")
    }
  }

  const copyCode = () => {
    if (!viewCode) return
    navigator.clipboard.writeText(viewCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleViewMembers = (e: any, group: Group) => {
    e.stopPropagation()
    setViewingGroup(group)
    setMembersDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 pb-24 relative overflow-hidden">

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[12%] left-[-10%] w-[55%] h-[45%] bg-[#00A896]/10 blur-[110px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="relative z-10 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Trips</h2>
            <p className="text-zinc-500 text-sm mt-1">
              Manage, join and explore your travel groups
            </p>
          </div>

          <div className="flex gap-3">

            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-full bg-white/5 border-white/10 text-white hover:bg-white/10">
                  <UserPlus className="mr-2 h-4 w-4" /> Join
                </Button>
              </DialogTrigger>

              <DialogContent className="bg-[#020617]/95 backdrop-blur-xl border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle>Join a Trip</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Enter the invite code shared with you.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <Input
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(e)=>setJoinCode(e.target.value)}
                    className="uppercase tracking-[0.5em] text-center text-2xl h-16 bg-white/5 border-white/10 text-[#00A896]"
                    maxLength={6}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && joinCode.trim().length >= 6) {
                        handleJoinGroup(e)
                      }
                    }}
                  />

                  <DialogFooter>
                    <Button 
                      onClick={handleJoinGroup}
                      disabled={joining || joinCode.trim().length < 6} 
                      className="w-full bg-[#00A896] hover:bg-[#00A896]/90 h-12 rounded-xl font-bold"
                    >
                      {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Join Trip
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={handleCreateClick} size="sm" className="bg-[#00A896] rounded-full font-bold shadow-[0_0_15px_rgba(0,168,150,0.5)]">
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
        </div>

        <TripSettingsDialog
          open={tripDialogOpen}
          onOpenChange={setTripDialogOpen}
          existingGroup={editingGroup}
          onSuccess={() => fetchGroups(false)}
        />

        <Dialog open={!!viewCode} onOpenChange={(v)=>!v && setViewCode(null)}>
          <DialogContent className="bg-[#020617]/95 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-center text-[#00A896] text-xl">Invite Code</DialogTitle>
              <DialogDescription className="text-center text-zinc-400">
                Share with your friends
              </DialogDescription>
            </DialogHeader>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl text-4xl font-mono text-center tracking-[0.2em]">
              {viewCode}
            </div>

            <Button onClick={copyCode} className="w-full bg-white/10 hover:bg-white/20 h-12 rounded-xl text-white">
              {copied ? <Check className="mr-2 text-emerald-400 "/> : <Copy className="mr-2"/>}
              {copied ? "Copied" : "Copy Code"}
            </Button>
          </DialogContent>
        </Dialog>

        {viewingGroup && (
          <ViewMembersDialog
            open={membersDialogOpen}
            onOpenChange={setMembersDialogOpen}
            groupId={viewingGroup.id}
            createdBy={viewingGroup.created_by}
            onMemberRemoved={() => fetchGroups(false)}
          />
        )}

        {loading ? (
          <div className="grid gap-4">
            {[1,2,3].map(i=>(
              <div key={i} className="p-5 rounded-3xl bg-white/5 border border-white/10">
                <Skeleton className="h-6 w-40 bg-white/10" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (

          <motion.div initial={{opacity:0,scale:.95}} animate={{opacity:1,scale:1}}
            className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]"
          >
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-zinc-500"/>
            </div>
            <h3 className="font-bold text-lg">No trips yet</h3>
            <p className="text-zinc-500 text-sm mt-1">Create or join to get started</p>
            <Button className="mt-5 bg-[#00A896]" onClick={handleCreateClick}>Create Trip</Button>
          </motion.div>

        ) : (

          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4 pb-10">
            <AnimatePresence mode="popLayout">
              {groups.map(group => {
                const isCreator = group.created_by === currentUserId
                const destCount = Array.isArray(group.destinations) ? group.destinations.length : 0
                const isActive = selectedGroupId === group.id

                return (
                  <motion.div
                    layout
                    key={group.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    whileTap={{ scale:0.97 }}
                    className={`relative rounded-3xl border p-5 backdrop-blur-xl transition 
                    ${isActive 
                      ? "bg-[#00A896]/10 border-[#00A896]/40 shadow-[0_0_25px_rgba(0,168,150,0.25)]"
                      : "bg-[#020617]/60 border-white/10 hover:bg-white/5 hover:border-white/20"
                    }`}
                    onClick={()=>{
                      localStorage.setItem("lastViewedGroupId",group.id)
                      setSelectedGroupId(group.id)
                      onSelectGroup?.(group)
                    }}
                  >

                    <div className="flex justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold">{group.name}</h3>

                          {isActive && (
                            <span className="text-[10px] bg-[#00A896] px-2 py-0.5 rounded-full font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        {destCount > 0 && (
                          <p className="text-sm text-zinc-400 mt-1 flex items-center">
                            <MapPin className="h-4 w-4 mr-1 text-[#00A896]" />
                            {group.destinations?.[0]?.name}
                            {destCount > 1 && ` +${destCount-1}`}
                          </p>
                        )}

                        {group.start_date && (
                          <p className="text-xs text-zinc-500 mt-1 flex items-center">
                            <Calendar className="h-3 w-3 mr-1"/> 
                            {new Date(group.start_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {isCreator && (
                        <Button size="sm" variant="ghost"
                          className="bg-white/5 border-white/5"
                          onClick={(e)=>handleEditClick(e,group)}
                        >
                          <Settings className="h-4 w-4 mr-1"/> Settings
                        </Button>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-white/5 pt-3">
                      <div className="flex items-center gap-2">
                        {group.budget_per_person ? (
                          <span className="text-xs px-3 py-1.5 bg-[#00A896]/10 text-[#00A896] border border-[#00A896]/30 rounded-lg flex items-center">
                            <Wallet className="h-4 w-4 mr-2"/> ₹{group.budget_per_person}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600 italic">No budget set</span>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="bg-white/5 border-white/5 h-8"
                          onClick={(e) => handleViewMembers(e, group)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Members
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" className="bg-white/5 h-8 w-8"
                          onClick={(e)=>{e.stopPropagation(); setViewCode(group.invite_code!)}}
                        >
                          <Eye className="h-4 w-4"/>
                        </Button>

                        {isCreator && (
                          <Button size="icon" variant="ghost" className="bg-rose-500/10 text-rose-400 h-8 w-8"
                            onClick={(e)=>handleDeleteGroup(group.id,e)}
                          >
                            <Trash2 className="h-4 w-4"/>
                          </Button>
                        )}
                      </div>
                    </div>

                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}