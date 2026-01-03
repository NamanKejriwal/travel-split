"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Loader2, Sparkles, MapPin, Calendar, Wallet, X } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { Group } from "@/components/views/groups-view"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Variants } from "framer-motion"


const supabase = createClient()

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { 
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24 } as const
  }
}

interface Destination {
  name: string
  arrival: string
  departure: string
}

interface TripSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingGroup?: Group
  onSuccess: () => void
}

export function TripSettingsDialog({ open, onOpenChange, existingGroup, onSuccess }: TripSettingsDialogProps) {
  const [name, setName] = useState("")
  const [budgetPerPerson, setBudgetPerPerson] = useState("")
  const [type, setType] = useState("Leisure")
  const [description, setDescription] = useState("")
  const [destinations, setDestinations] = useState<Destination[]>([{ name: "", arrival: "", departure: "" }])
  const [aiEnabled, setAiEnabled] = useState(true)

  const [loading, setLoading] = useState(false)
  const [generatingLimits, setGeneratingLimits] = useState(false)

  // 🔒 Lock scroll when dialog open (native app feel)
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto"
  }, [open])

  // Load existing data
  useEffect(() => {
    if (!open) return

    if (existingGroup) {
      setName(existingGroup.name || "")
      setBudgetPerPerson(existingGroup.budget_per_person?.toString() || "")
      setType(existingGroup.trip_type || "Leisure")
      setDescription(existingGroup.description || "")
      setAiEnabled(existingGroup.ai_alerts_enabled ?? true)

      if (Array.isArray(existingGroup.destinations) && existingGroup.destinations.length > 0)
        setDestinations(existingGroup.destinations as any)
      else setDestinations([{ name: "", arrival: "", departure: "" }])
    } else {
      setName("")
      setBudgetPerPerson("")
      setType("Leisure")
      setDescription("")
      setAiEnabled(true)
      setDestinations([{ name: "", arrival: "", departure: "" }])
    }
  }, [open, existingGroup])

  const handleAddDest = () =>
    setDestinations([...destinations, { name: "", arrival: "", departure: "" }])

  const handleDestChange = (i: number, field: keyof Destination, value: string) => {
    const copy = [...destinations]
    copy[i][field] = value
    setDestinations(copy)
  }

  const handleRemoveDest = (i: number) =>
    setDestinations(destinations.filter((_, idx) => idx !== i))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!user || !session) throw new Error("Authentication lost. Please login again.")

      const validDestinations = destinations.filter(d => d.name.trim() !== "")

      let start_date: string | null = null
      let end_date: string | null = null
      let totalDays = 3

      if (validDestinations.length > 0) {
        const sorted = [...validDestinations].sort((a, b) => a.arrival.localeCompare(b.arrival))
        if (sorted[0].arrival) start_date = sorted[0].arrival.split("T")[0]
        if (sorted[sorted.length - 1].departure)
          end_date = sorted[sorted.length - 1].departure.split("T")[0]

        if (start_date && end_date) {
          const s = new Date(start_date)
          const e2 = new Date(end_date)
          totalDays = Math.ceil((e2.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
        }
      }

      const payload = {
        name,
        budget_per_person: parseFloat(budgetPerPerson) || 0,
        trip_type: type,
        description,
        destinations: validDestinations,
        ai_alerts_enabled: aiEnabled,
        start_date,
        end_date
      }

      let groupId = existingGroup?.id

      if (existingGroup) {
        const { error } = await supabase.from("groups").update(payload).eq("id", existingGroup.id)
        if (error) throw error
        toast.success("Trip updated")
      } else {
        const { data, error } = await supabase
          .from("groups")
          .insert({ ...payload, created_by: user.id })
          .select()
          .single()

        if (error) throw error
        groupId = data.id
        await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id })
        toast.success("Trip created!")
      }

      if (aiEnabled && payload.budget_per_person > 0 && groupId) {
        setGeneratingLimits(true)
        try {
          const res = await fetch("/api/generate-budget-limits", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ ...payload, totalDays })
          })
          const limits = await res.json()
          if (limits && !limits.error)
            await supabase.from("groups").update({ category_limits: limits }).eq("id", groupId)
        } catch {}
      }

      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error("Failed to save trip")
    } finally {
      setLoading(false)
      setGeneratingLimits(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bg-[#020617] border-0 sm:border sm:border-white/10 text-white p-0 gap-0",
          "w-full max-w-full",
          "max-h-[100dvh] min-h-[75dvh]",  // <-- PREMIUM MOBILE HEIGHT
          "sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl",
          "flex flex-col overflow-hidden"
        )}
      >

        {/* HEADER */}
        <DialogHeader className="px-6 py-4 border-b border-white/5 bg-[#020617] flex flex-row items-center justify-between">
          <div className="space-y-1">
            <DialogTitle className="text-lg font-bold">
              {existingGroup ? "Edit Trip Details" : "Plan New Trip"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              {generatingLimits ? "AI is calculating…" : "Fill in the essentials below."}
            </DialogDescription>
          </div>

          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="sm:hidden text-zinc-400">
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <form id="trip-form" onSubmit={handleSubmit} className="p-6 space-y-8">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">

              {/* SECTION: BASIC */}
              <motion.section variants={itemVariants} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase">Trip Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required
                    placeholder="e.g. Goa Escape"
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl text-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold flex items-center gap-1 text-[#00A896] uppercase">
                      <Wallet className="w-3 h-3" /> Budget / Person
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-zinc-400 font-bold text-lg">₹</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="5000"
                        value={budgetPerPerson}
                        onChange={e => setBudgetPerPerson(e.target.value)}
                        className="pl-9 bg-white/5 border-white/10 text-white h-12 rounded-xl text-lg w-full outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase">Trip Type</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                        {["Leisure", "Backpacking", "Business", "Luxury", "Road Trip"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.section>

              {/* SECTION: DESTINATIONS */}
              <motion.section variants={itemVariants} className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00A896]" /> Itinerary & Stops
                  </Label>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={handleAddDest}
                    className="text-[#00A896] hover:bg-[#00A896]/10 rounded-full h-8 px-3 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Add Stop
                  </Button>
                </div>

                <AnimatePresence initial={false}>
                  {destinations.map((dest, i) => (
                    <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="relative pl-4 border-l-2 border-white/10 pb-6 space-y-3">
                      <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-zinc-700 ring-4 ring-[#020617]" />

                      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-4">

                        <div className="flex gap-3">
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-[10px] text-zinc-500 uppercase">Destination</Label>
                            <Input
                              placeholder="e.g. North Goa"
                              value={dest.name}
                              onChange={e => handleDestChange(i, "name", e.target.value)}
                              className="bg-transparent border-white/10 text-white h-10 rounded-lg"
                            />
                          </div>

                          {destinations.length > 1 && (
                            <Button type="button" variant="ghost" size="icon"
                              className="mt-6 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                              onClick={() => handleRemoveDest(i)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[10px] text-zinc-500 uppercase flex gap-1">
                              <Calendar className="w-3 h-3" /> Arrival
                            </Label>
                            <Input type="datetime-local"
                              value={dest.arrival}
                              onChange={e => handleDestChange(i, "arrival", e.target.value)}
                              className="bg-white/5 border-white/10 text-white h-10 rounded-lg text-xs font-mono"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-zinc-500 uppercase flex gap-1">
                              <Calendar className="w-3 h-3" /> Departure
                            </Label>
                            <Input type="datetime-local"
                              value={dest.departure}
                              onChange={e => handleDestChange(i, "departure", e.target.value)}
                              className="bg-white/5 border-white/10 text-white h-10 rounded-lg text-xs font-mono"
                            />
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.section>

              {/* SECTION: NOTES + AI */}
              <motion.section variants={itemVariants} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 uppercase">Notes</Label>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm min-h-[100px] outline-none"
                    placeholder="Any preferences or reminders?"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div className="bg-[#00A896]/5 border border-[#00A896]/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#00A896]/20 rounded-full text-[#00A896]">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <Label className="text-white font-bold text-sm">AI Budget Coach</Label>
                      <p className="text-xs text-zinc-400">Auto-suggests smart limits</p>
                    </div>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>
              </motion.section>

              <div className="h-16 sm:h-0" />
            </motion.div>
          </form>
        </div>

        {/* STICKY FOOTER - SAFE AREA */}
        <div className="p-4 border-t border-white/10 bg-[#020617]/90 backdrop-blur-lg shrink-0 sm:rounded-b-2xl
                        pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <Button
            type="submit"
            form="trip-form"
            disabled={loading || generatingLimits}
            className="w-full h-14 bg-[#00A896] text-lg font-bold rounded-xl shadow-[0_0_25px_rgba(0,168,150,0.35)]"
          >
            {generatingLimits ? "Designing Budget…" : loading ? "Saving…" :
              existingGroup ? "Save Changes" : "Create Trip"}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
