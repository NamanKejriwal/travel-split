"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { createClient } from "@/utils/supabase/client"
import { Users, Crown, UserMinus, LogOut, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const supabase = createClient()

interface ViewMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string | null
  createdBy: string | null
  onMemberRemoved?: () => void
}

interface Member {
  id: string
  full_name: string
  joined_at: string
  balance?: number
  email?: string // <--- NEW: Added email field
}

const AVATAR_COLORS = [
  "bg-red-500","bg-orange-500","bg-amber-500","bg-yellow-500",
  "bg-lime-500","bg-green-500","bg-emerald-500","bg-teal-500",
  "bg-cyan-500","bg-sky-500","bg-blue-500","bg-indigo-500",
  "bg-violet-500","bg-purple-500","bg-fuchsia-500","bg-pink-500","bg-rose-500"
]

function getAvatarColor(name: string) {
  if (!name) return "bg-zinc-700"
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  if (!name) return "?"
  const parts = name.split(" ").filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ViewMembersDialog({
  open,
  onOpenChange,
  groupId,
  createdBy,
  onMemberRemoved
}: ViewMembersDialogProps) {

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isCreator, setIsCreator] = useState(false)

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)

  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [myBalance, setMyBalance] = useState<number>(0)
  
  const [groupName, setGroupName] = useState("Trip") // <--- NEW: State for group name

  useEffect(() => {
    if (open && groupId) fetchMembers()
  }, [open, groupId])

  // FIX: Subscribe to both members AND expenses to keep balances fresh
  useEffect(() => {
    if (!open || !groupId) return

    const channel = supabase.channel(`members-${groupId}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "group_members",
          event: "*",
          filter: `group_id=eq.${groupId}`
        },
        () => fetchMembers()
      )
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "expenses", // <--- Added subscription to expenses
          event: "*",
          filter: `group_id=eq.${groupId}`
        },
        () => fetchMembers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [open, groupId])

  async function fetchMembers() {
    if (!groupId) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        setIsCreator(user.id === createdBy)
      }

      // 1. Fetch Group Name (NEW)
      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single()
      if (groupData) setGroupName(groupData.name)

      // 2. Fetch Members with Emails (NEW)
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          user_id,
          joined_at,
          profiles ( id, full_name, email ) 
        `)
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true })

      if (error) throw error

      const balancesResult = await supabase.rpc("get_trip_balances", {
        p_group_id: groupId
      })

      const balances = balancesResult.data || []

      const formatted: Member[] = (data || []).map((m: any) => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        const bal = balances.find((b: any) => b.user_id === m.user_id)

        if (m.user_id === currentUserId) setMyBalance(bal?.net_balance || 0)

        return {
          id: m.user_id,
          full_name: profile?.full_name || "Unknown Member",
          email: profile?.email, // <--- Store Email
          joined_at: m.joined_at,
          balance: bal?.net_balance || 0
        }
      })

      setMembers(formatted)
    } catch (err) {
      toast.error("Failed to load members")
    } finally {
      setLoading(false)
    }
  }

  function openRemoveDialog(member: Member) {
    setMemberToRemove(member)
    setConfirmRemoveOpen(true)
  }

  async function logAudit(action: string, target?: string) {
    await supabase.from("ai_audit_logs").insert({
      group_id: groupId,
      action,
      actor_id: currentUserId,
      target_user: target || null
    })
  }

  async function handleRemoveMember() {
    if (!memberToRemove || !groupId) return

    setRemovingMemberId(memberToRemove.id)
    setConfirmRemoveOpen(false)

    try {
      // Check balance with tolerance
      const balance = memberToRemove.balance || 0
      if (Math.abs(balance) > 0.5) {
        toast.error(`Cannot remove: ${memberToRemove.full_name} has a balance of ₹${balance.toFixed(2)}. Settle up first.`)
        return
      }

      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", memberToRemove.id)

      if (error) throw error

      await logAudit("member_removed", memberToRemove.id)

      // === EMAIL NOTIFICATION (NEW) ===
      if (memberToRemove.email) {
        fetch('/api/notify', {
          method: 'POST',
          body: JSON.stringify({
            type: 'GROUP',
            action: 'MEMBER_REMOVED',
            groupName: groupName,
            recipients: [{ email: memberToRemove.email, name: memberToRemove.full_name }]
          })
        })
      }
      // ================================

      toast.success("Member removed successfully")
      fetchMembers()
      onMemberRemoved?.()

    } catch (err: any) {
      console.error("Remove Error:", err)
      toast.error(err.message || "Failed to remove member")
    } finally {
      setRemovingMemberId(null)
      setMemberToRemove(null)
    }
  }

  async function handleLeaveGroup() {
    if (!currentUserId || !groupId) return

    setLeaving(true)
    setConfirmLeaveOpen(false)

    try {
      if (members.length === 1 && isCreator) {
        toast.error("You cannot leave as the only member.")
        return
      }

      if (Math.round(myBalance) !== 0) {
        toast.error(`Cannot leave: you must settle ₹${Math.abs(Math.round(myBalance))}`)
        return
      }

      // Check if ownership transfer is needed
      if (isCreator && members.length > 1) {
        // Find the next member (who is NOT me)
        const nextCreator = members.find(m => m.id !== currentUserId)

        if (nextCreator) {
          const { error: updateError } = await supabase
            .from("groups")
            .update({ created_by: nextCreator.id })
            .eq("id", groupId)

          if (updateError) throw updateError

          await logAudit("ownership_transferred", nextCreator.id)

          // === EMAIL NOTIFICATION (NEW) ===
          if (nextCreator.email) {
             fetch('/api/notify', {
                method: 'POST',
                body: JSON.stringify({
                  type: 'GROUP',
                  action: 'OWNERSHIP_TRANSFERRED',
                  groupName: groupName,
                  recipients: [{ email: nextCreator.email, name: nextCreator.full_name }]
                })
             })
          }
          // ================================
        }
      }

      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", currentUserId)

      if (error) throw error

      await logAudit("member_left", currentUserId)

      toast.success("You left the group")
      onOpenChange(false)
      onMemberRemoved?.()

    } catch (err: any) {
      console.error("Leave Error:", err)
      toast.error("Failed to leave group")
    } finally {
      setLeaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#020617]/95 backdrop-blur-2xl border-white/10 text-white w-[95%] max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#00A896]/10 border border-[#00A896]/20">
                <Users className="w-5 h-5 text-[#00A896]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Trip Members</DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                  {members.length} people in this trip
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {members.map((member, index) => {
                    const isMember = member.id === currentUserId
                    const isMemberCreator = member.id === createdBy
                    const unsettled = Math.round(member.balance || 0) !== 0
                    const owes = (member.balance || 0) < 0

                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: .95 }}
                        transition={{ delay: index * 0.04 }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-2xl border transition-all",
                          unsettled
                            ? owes
                              ? "border-rose-400/30 bg-rose-500/5"
                              : "border-emerald-400/30 bg-emerald-500/5"
                            : isMember
                            ? "bg-[#00A896]/5 border-[#00A896]/20"
                            : "bg-white/[0.02] border-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-11 w-11 border-2 border-white/10">
                            <AvatarFallback className={cn("text-sm", getAvatarColor(member.full_name))}>
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">
                                {member.full_name}
                                {isMember && <span className="text-[#00A896] ml-1">(You)</span>}
                              </p>

                              {isMemberCreator && (
                                <div className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400">
                                  Creator
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              {unsettled
                                ? owes
                                  ? `Owes ₹${Math.abs(Math.round(member.balance || 0))}`
                                  : `Gets ₹${Math.abs(Math.round(member.balance || 0))}`
                                : "Settled"}
                            </p>
                          </div>
                        </div>

                        {isCreator && !isMember && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openRemoveDialog(member)}
                            className="h-9 w-9 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="p-6 pt-4 border-t border-white/5 bg-[#020617]/60">
            <Button
              variant="outline"
              onClick={() => setConfirmLeaveOpen(true)}
              disabled={leaving}
              className="w-full h-12 rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-semibold active:scale-[0.98] transition-all"
            >
              {leaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Leaving...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave Group
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent className="bg-[#0f172a]/95 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-400 flex gap-2">
              <AlertTriangle className="h-5" /> Remove {memberToRemove?.full_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They can only be removed if fully settled. History remains intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-rose-500">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent className="bg-[#0f172a]/95 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-400 flex gap-2">
              <AlertTriangle className="h-5" /> Leave Group?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCreator
                ? "You are the creator. If you leave, next earliest member becomes creator. You must be fully settled."
                : "You can only leave if your balance is ₹0. Your past activity remains in history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} className="bg-rose-500">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}