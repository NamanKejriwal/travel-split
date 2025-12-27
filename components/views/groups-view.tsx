"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClient()

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

import { TripSettingsDialog } from "@/components/trip-settings-dialog"

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { 
      type: "spring" as const, // <--- Added "as const"
      stiffness: 260, 
      damping: 20 
    }
  }
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

  useEffect(() => {
    const stored = localStorage.getItem("lastViewedGroupId")
    if (stored) setSelectedGroupId(stored)
    fetchGroups()
  }, [])

  async function fetchGroups() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

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
        .eq("user_id", user.id)

      if (error) throw error

      const formatted = (data || [])
        // @ts-ignore
        .map(item => Array.isArray(item.groups) ? item.groups[0] : item.groups)
        .filter(Boolean)

      setGroups(formatted)
    } catch (err) {
      console.error("Error fetching groups:", err)
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
      const { data, error } = await supabase.rpc("join_trip", {
        share_code: joinCode.trim()
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.message)

      setJoinCode("")
      setJoinOpen(false)
      fetchGroups()
      alert("Successfully joined the trip!")
    } catch (err: any) {
      alert(err.message || "Failed to join group.")
    } finally {
      setJoining(false)
    }
  }

  async function handleDeleteGroup(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm("Delete trip? This cannot be undone.")) return

    try {
      await supabase.from("groups").delete().eq("id", id)
      fetchGroups()
    } catch {
      alert("Failed to delete group")
    }
  }

  const handleViewCode = (code?: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (code) setViewCode(code)
  }

  const copyCode = () => {
    if (!viewCode) return
    navigator.clipboard.writeText(viewCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 pb-24 relative overflow-hidden">
      
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] left-[-20%] w-[50%] h-[50%] bg-[#00A896]/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="relative z-10 space-y-6"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">Your Trips</h2>

            <div className="flex gap-3">
            
            {/* JOIN DIALOG */}
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-full px-4">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join
                </Button>
                </DialogTrigger>

                <DialogContent className="bg-[#020617]/95 backdrop-blur-xl border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="text-white">Join a Trip</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                    Enter the 6-character invite code shared with you.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleJoinGroup} className="space-y-4 pt-2">
                    <div className="flex justify-center">
                        <Input
                        placeholder="ABC123"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        maxLength={6}
                        className="uppercase tracking-[0.5em] font-mono text-center text-2xl h-16 bg-white/5 border-white/10 text-[#00A896] placeholder:text-zinc-700 rounded-2xl focus-visible:ring-[#00A896]"
                        required
                        />
                    </div>

                    <DialogFooter>
                    <Button type="submit" disabled={joining} className="w-full bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold rounded-xl h-12 shadow-[0_0_15px_rgba(0,168,150,0.3)]">
                        {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Join Trip
                    </Button>
                    </DialogFooter>
                </form>
                </DialogContent>
            </Dialog>

            {/* NEW TRIP BUTTON */}
            <Button
                size="sm"
                className="bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold rounded-full px-4 shadow-[0_0_15px_rgba(0,168,150,0.4)]"
                onClick={handleCreateClick}
            >
                <Plus className="mr-2 h-4 w-4" />
                New
            </Button>
            </div>
        </div>

        {/* Trip Create / Edit Dialog */}
        <TripSettingsDialog
            open={tripDialogOpen}
            onOpenChange={setTripDialogOpen}
            existingGroup={editingGroup}
            onSuccess={fetchGroups}
        />

        {/* Invite Code Dialog */}
        <Dialog open={!!viewCode} onOpenChange={(v) => !v && setViewCode(null)}>
            <DialogContent className="bg-[#020617]/95 backdrop-blur-xl border-white/10 text-white">
            <DialogHeader>
                <DialogTitle className="text-center text-[#00A896] text-xl">
                Invite Code
                </DialogTitle>
                <DialogDescription className="text-center text-zinc-400">
                Share this code with friends to let them join.
                </DialogDescription>
            </DialogHeader>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl text-4xl font-mono font-bold text-center tracking-[0.2em] text-white shadow-inner my-4">
                {viewCode}
            </div>

            <Button className="w-full bg-white/10 hover:bg-white/20 text-white border-none h-12 rounded-xl" onClick={copyCode}>
                {copied ? <Check className="mr-2 h-4 w-4 text-emerald-400" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied to Clipboard" : "Copy Code"}
            </Button>
            </DialogContent>
        </Dialog>

        {/* LIST */}
        {loading ? (
            <div className="grid gap-4">
                {[1,2,3].map(i => (
                <div key={i} className="p-6 rounded-3xl border border-white/5 bg-white/5 space-y-4">
                    <div className="flex justify-between">
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-40 bg-white/10" />
                        <Skeleton className="h-4 w-28 bg-white/5" />
                    </div>
                    <Skeleton className="h-8 w-16 rounded-md bg-white/5" />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-6 w-24 rounded-full bg-white/5" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded-md bg-white/5" />
                        <Skeleton className="h-8 w-8 rounded-md bg-white/5" />
                    </div>
                    </div>
                </div>
                ))}
            </div>
        ) : groups.length === 0 ? (

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring" as const, duration: 0.5 }}
                className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]"
            >
                <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-zinc-500" />
                </div>
                <h3 className="text-lg font-bold text-white">No trips yet</h3>
                <p className="text-zinc-500 max-w-xs mt-2">Create a new trip or join one to start tracking expenses.</p>
                <Button 
                    className="mt-6 bg-[#00A896] hover:bg-[#00A896]/90 text-white rounded-full"
                    onClick={handleCreateClick}
                >
                    Create your first trip
                </Button>
            </motion.div>
        ) : (
            <motion.div 
                className="grid gap-4 pb-12"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
            <AnimatePresence>
            {groups.map(group => {
                const isCreator = group.created_by === currentUserId
                const isActive = selectedGroupId === group.id
                const destCount = Array.isArray(group.destinations) ? group.destinations.length : 0

                return (
                <motion.div
                    key={group.id}
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-xl p-5 ${
                    isActive 
                        ? "bg-[#00A896]/10 border-[#00A896]/50 shadow-[0_0_20px_rgba(0,168,150,0.15)]" 
                        : "bg-[#020617]/60 border-white/10 hover:bg-white/5 hover:border-white/20"
                    }`}
                    onClick={() => {
                        localStorage.setItem("lastViewedGroupId", group.id)
                        setSelectedGroupId(group.id)
                        onSelectGroup?.(group)
                    }}
                >
                    {/* Active Indicator Line */}
                    {isActive && (
                        <motion.div 
                            layoutId="active-indicator"
                            className="absolute left-0 top-0 bottom-0 w-1 bg-[#00A896]" 
                        />
                    )}

                    {/* Header */}
                    <div className="flex flex-row justify-between items-start mb-4">
                    <div className="pl-2">
                        <div className="flex items-center gap-3">
                            <h3 className={`text-xl font-bold tracking-tight ${isActive ? 'text-white' : 'text-zinc-100'}`}>
                                {group.name}
                            </h3>
                            {isActive && (
                                <motion.span 
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-[10px] font-bold bg-[#00A896] text-white px-2 py-0.5 rounded-full shadow-[0_0_10px_#00A896]"
                                >
                                ACTIVE
                                </motion.span>
                            )}
                        </div>

                        {destCount > 0 && (
                        <div className="flex items-center text-sm text-zinc-400 mt-1">
                            <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#00A896]" />
                            {group.destinations?.[0]?.name}
                            {destCount > 1 && ` +${destCount - 1} more`}
                        </div>
                        )}

                        {group.start_date && (
                        <div className="flex items-center text-xs text-zinc-500 mt-1.5 font-medium">
                            <Calendar className="w-3 h-3 mr-1.5" />
                            {new Date(group.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        )}
                    </div>

                    {isCreator && (
                        <Button
                        size="sm"
                        variant="ghost"
                        className="bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl h-8 text-xs border border-white/5"
                        onClick={(e) => handleEditClick(e, group)}
                        >
                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                        Settings
                        </Button>
                    )}
                    </div>

                    {/* Footer / Stats */}
                    <div className="flex justify-between items-center border-t border-white/5 pt-4 pl-2">
                    {group.budget_per_person ? (
                        <span className="text-xs font-bold px-3 py-1.5 bg-[#00A896]/10 border border-[#00A896]/20 text-[#00A896] rounded-lg flex items-center">
                        <Wallet className="w-3.5 h-3.5 mr-1.5" />
                        ₹{group.budget_per_person.toLocaleString()}/person
                        </span>
                    ) : (
                        <span className="text-xs text-zinc-600 italic">No budget set</span>
                    )}

                    <div className="flex gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
                            onClick={(e) => handleViewCode(group.invite_code, e)}
                            title="View Invite Code"
                        >
                        <Eye className="w-4 h-4" />
                        </Button>

                        {isCreator && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            onClick={(e) => handleDeleteGroup(group.id, e)}
                            title="Delete Trip"
                        >
                            <Trash2 className="w-4 h-4" />
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