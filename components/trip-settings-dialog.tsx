"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Loader2, Sparkles, MapPin, Calendar, Plane } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { Group } from "@/components/views/groups-view"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClient()

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
      type: "spring" as const, // <--- ADD "as const" HERE
      stiffness: 260, 
      damping: 20 
    }
  }
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, height: 0, marginBottom: 0 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    height: "auto", 
    marginBottom: 12,
    transition: { 
      type: "spring" as const, // <--- ADD THIS HERE
      stiffness: 300, 
      damping: 25 
    }
  },
  exit: { opacity: 0, scale: 0.9, height: 0, marginBottom: 0, transition: { duration: 0.2 } }
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

  // LOAD INITIAL DATA
  useEffect(() => {
    if (!open) return

    if (existingGroup) {
      setName(existingGroup.name || "")
      setBudgetPerPerson(existingGroup.budget_per_person?.toString() || "")
      setType(existingGroup.trip_type || "Leisure")
      setDescription(existingGroup.description || "")
      setAiEnabled(existingGroup.ai_alerts_enabled ?? true)

      if (Array.isArray(existingGroup.destinations) && existingGroup.destinations.length > 0) {
        setDestinations(existingGroup.destinations as any)
      } else {
        setDestinations([{ name: "", arrival: "", departure: "" }])
      }
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

      // derive trip dates
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

      // UPDATE
      if (existingGroup) {
        const { error } = await supabase.from("groups").update(payload).eq("id", existingGroup.id)
        if (error) throw error
        toast.success("Trip updated")
      }

      // CREATE
      else {
        const { data, error } = await supabase
          .from("groups")
          .insert({ ...payload, created_by: user.id })
          .select()
          .single()

        if (error) throw error

        groupId = data.id

        await supabase.from("group_members").insert({
          group_id: data.id,
          user_id: user.id
        })

        toast.success("Trip created!")
      }

      // AI BUDGET GENERATION
      if (aiEnabled && payload.budget_per_person > 0 && groupId) {
        setGeneratingLimits(true)

        try {
          const res = await fetch("/api/generate-budget-limits", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              ...payload,
              totalDays
            })
          })

          const limits = await res.json()

          if (limits && !limits.error) {
            const { error: limitError } = await supabase
              .from("groups")
              .update({ category_limits: limits })
              .eq("id", groupId)

            if (limitError) throw limitError
            toast.success("AI budget designed!")
          } else {
            toast.error("AI returned invalid budget. Using basic mode.")
          }
        } catch (err) {
          toast.error("Trip saved but AI unavailable.")
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(typeof error === "string" ? error : "Failed to save trip")
    } finally {
      setLoading(false)
      setGeneratingLimits(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#020617]/95 backdrop-blur-xl border-white/10 text-white max-h-[90vh] overflow-y-auto sm:max-w-lg custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            {existingGroup ? "Edit Trip Details" : "Plan New Trip"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {generatingLimits ? "AI is calculating your budget..." : "Add details to help us track your spending."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="py-4">
          <motion.div 
            className="space-y-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >

            {/* Trip basic fields */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Trip Name</Label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="e.g. Summer in Goa"
                  className="bg-white/5 border-white/10 text-white h-11 rounded-xl focus-visible:ring-[#00A896] transition-all focus:scale-[1.01]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#00A896] uppercase tracking-wider">Budget / Person</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-zinc-400 font-bold">₹</span>
                  <Input 
                      className="pl-8 bg-white/5 border-white/10 text-white h-11 rounded-xl transition-all focus:scale-[1.01]" 
                      type="number" 
                      placeholder="5000"
                      value={budgetPerPerson}
                      onChange={e => setBudgetPerPerson(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Trip Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 rounded-xl transition-all hover:bg-white/10">
                      <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                    <SelectItem value="Leisure">Leisure</SelectItem>
                    <SelectItem value="Backpacking">Backpacking</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Luxury">Luxury</SelectItem>
                    <SelectItem value="Road Trip">Road Trip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            {/* Destinations */}
            <motion.div variants={itemVariants} className="space-y-3 border border-white/10 rounded-2xl p-4 bg-white/[0.02]">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-white font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#00A896]" /> Itinerary & Stops
                </Label>
                <Button type="button" variant="ghost" size="sm" onClick={handleAddDest} className="text-[#00A896] hover:text-[#00A896] hover:bg-[#00A896]/10 text-xs h-8">
                  <Plus className="w-3 h-3 mr-1" /> Add Stop
                </Button>
              </div>

              <AnimatePresence initial={false}>
              {destinations.map((dest, i) => (
                <motion.div 
                    key={i} 
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className="p-4 bg-[#020617] border border-white/10 rounded-xl relative space-y-3 group hover:border-white/20 transition-colors overflow-hidden"
                >
                  {destinations.length > 1 && (
                    <Button type="button" variant="ghost" size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-zinc-500 hover:text-rose-500 transition-colors"
                      onClick={() => handleRemoveDest(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Stop Name</label>
                      <Input 
                          placeholder="e.g. North Goa"
                          value={dest.name}
                          onChange={e => handleDestChange(i, "name", e.target.value)} 
                          className="bg-white/5 border-white/10 text-white h-9 rounded-lg text-sm transition-all focus:bg-white/10"
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Arrival</label>
                      <Input type="datetime-local"
                          value={dest.arrival}
                          onChange={e => handleDestChange(i, "arrival", e.target.value)} 
                          className="bg-white/5 border-white/10 text-white h-9 rounded-lg text-xs transition-all focus:bg-white/10"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Departure</label>
                      <Input type="datetime-local"
                          value={dest.departure}
                          onChange={e => handleDestChange(i, "departure", e.target.value)} 
                          className="bg-white/5 border-white/10 text-white h-9 rounded-lg text-xs transition-all focus:bg-white/10"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            </motion.div>

            {/* Description */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Notes</Label>
              <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A896] min-h-[80px] transition-all focus:scale-[1.01]"
                  placeholder="Add trip description or notes..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
              />
            </motion.div>

            {/* AI Toggle */}
            <motion.div variants={itemVariants} className="flex items-center justify-between border-t border-white/10 pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#00A896]/10 rounded-lg text-[#00A896]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <Label className="text-white font-medium block">AI Budget Coach</Label>
                  <p className="text-xs text-zinc-400">Automatically optimize limits</p>
                </div>
              </div>
              <Switch 
                  checked={aiEnabled} 
                  onCheckedChange={setAiEnabled}
                  className="data-[state=checked]:bg-[#00A896] data-[state=unchecked]:bg-zinc-700" 
              />
            </motion.div>

            <DialogFooter className="mt-4">
              <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  className="w-full h-12 bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,168,150,0.3)] transition-all"
                  disabled={loading || generatingLimits}
                >
                  {generatingLimits ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-pulse" /> Designing Budget…
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                    </>
                  ) : existingGroup ? "Save Changes" : "Create Trip"}
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </form>
      </DialogContent>
    </Dialog>
  )
}