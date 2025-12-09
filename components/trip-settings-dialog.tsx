import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Loader2, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Group } from "@/components/views/groups-view"
import { toast } from "sonner"

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

  // Load data
  useEffect(() => {
    if (open) {
      if (existingGroup) {
        setName(existingGroup.name || "")
        // @ts-ignore
        setBudgetPerPerson(existingGroup.budget_per_person?.toString() || "")
        setType(existingGroup.trip_type || "Leisure")
        // @ts-ignore
        setDescription(existingGroup.description || "")
        setAiEnabled(existingGroup.ai_alerts_enabled ?? true)
        
        if (existingGroup.destinations && Array.isArray(existingGroup.destinations) && existingGroup.destinations.length > 0) {
          setDestinations(existingGroup.destinations.map((d: any) => ({
            name: d.name || "",
            arrival: d.arrival || "",
            departure: d.departure || ""
          })))
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
    }
  }, [open, existingGroup])

  const handleAddDest = () => setDestinations([...destinations, { name: "", arrival: "", departure: "" }])
  
  const handleDestChange = (index: number, field: keyof Destination, value: string) => {
    const newDest = [...destinations]
    newDest[index][field] = value
    setDestinations(newDest)
  }

  const handleRemoveDest = (index: number) => {
    setDestinations(destinations.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!user || !session) throw new Error("No user found")

      const validDestinations = destinations.filter(d => d.name.trim() !== "")
      
      // Calculate derived dates
      let start_date = null
      let end_date = null
      let totalDays = 3
      if (validDestinations.length > 0) {
        const sorted = [...validDestinations].sort((a,b) => (a.arrival > b.arrival ? 1 : -1))
        if(sorted[0].arrival) start_date = sorted[0].arrival.split('T')[0]
        if(sorted[sorted.length-1].departure) end_date = sorted[sorted.length-1].departure.split('T')[0]
        
        if (start_date && end_date) {
            const start = new Date(start_date)
            const end = new Date(end_date)
            totalDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1
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

      // 1. Save Group Basic Details
      if (existingGroup) {
        const { error } = await supabase.from('groups').update(payload).eq('id', existingGroup.id)
        if (error) throw error
        toast.success("Trip updated")
      } else {
        const { data, error } = await supabase.from('groups').insert({ ...payload, created_by: user.id }).select().single()
        if (error) throw error
        groupId = data.id
        await supabase.from('group_members').insert({ group_id: data.id, user_id: user.id })
        toast.success("Trip created!")
      }

      // 2. Trigger AI Limit Generation
      // Note: We use the session token here to authorize the API call
      if (aiEnabled && payload.budget_per_person > 0 && groupId) {
        setGeneratingLimits(true)
        try {
            console.log("Calling AI to generate limits...")
            const res = await fetch('/api/generate-budget-limits', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}` 
                },
                body: JSON.stringify({
                    ...payload,
                    totalDays
                })
            })
            const limits = await res.json()
            console.log("AI Response:", limits)

            if (limits && !limits.error) {
                // Save limits to DB
                const { error: limitError } = await supabase
                    .from('groups')
                    .update({ category_limits: limits })
                    .eq('id', groupId)
                
                if (limitError) {
                    console.error("Limit Save Error:", limitError)
                    toast.error("Trip saved, but failed to generate AI budget.")
                } else {
                    console.log("Limits saved successfully!")
                    toast.success("AI has generated your budget limits!")
                }
            }
        } catch (aiError) {
            console.error("AI Limit Gen Failed", aiError)
            toast.error("Trip saved, but AI service is currently unavailable.")
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to save trip")
    } finally {
      setLoading(false)
      setGeneratingLimits(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingGroup ? "Edit Trip Details" : "Plan New Trip"}</DialogTitle>
          <DialogDescription>
            {generatingLimits ? "AI is calculating your budget..." : "Add details to help us track your spending."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
                <Label>Trip Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Summer Eurotrip" required />
            </div>
            <div className="space-y-2">
                <Label>Budget Per Person</Label>
                <div className="relative">
                    <span className="absolute left-3 top-2.5 text-zinc-500">₹</span>
                    <Input className="pl-7" type="number" value={budgetPerPerson} onChange={e => setBudgetPerPerson(e.target.value)} placeholder="15000" />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Trip Type</Label>
                <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Leisure">Leisure</SelectItem>
                        <SelectItem value="Backpacking">Backpacking</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Luxury">Luxury</SelectItem>
                        <SelectItem value="Road Trip">Road Trip</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

          <div className="space-y-3 border rounded-lg p-3 bg-zinc-50/50">
            <div className="flex justify-between items-center">
                <Label className="text-emerald-700 font-semibold">Itinerary & Stops</Label>
                <Button type="button" variant="ghost" size="sm" onClick={handleAddDest} className="h-6 text-xs text-emerald-600 hover:text-emerald-700">
                    <Plus className="w-3 h-3 mr-1" /> Add Stop
                </Button>
            </div>
            {destinations.map((dest, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 bg-white rounded border shadow-sm relative">
                    {destinations.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-zinc-300 hover:text-red-500" onClick={() => handleRemoveDest(i)}>
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    )}
                    <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Destination Name</Label>
                        <Input placeholder="e.g. Paris" value={dest.name} onChange={e => handleDestChange(i, 'name', e.target.value)} className="h-8" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs text-zinc-500">Arriving</Label>
                            <Input type="datetime-local" value={dest.arrival} onChange={e => handleDestChange(i, 'arrival', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-zinc-500">Leaving</Label>
                            <Input type="datetime-local" value={dest.departure} onChange={e => handleDestChange(i, 'departure', e.target.value)} className="h-8 text-xs" />
                        </div>
                    </div>
                </div>
            ))}
          </div>

          {/* UPDATED DESCRIPTION FIELD FOR BETTER AI CONTEXT */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
                Trip Description <span className="text-xs font-normal text-muted-foreground">(Origin, Transport, Vibe)</span>
            </Label>
            <textarea 
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g. Traveling from Mumbai to Goa by Train. We are renting scooters there. Focused on nightlife and beach shacks."
                value={description}
                onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-0.5">
                <Label className="cursor-pointer text-base" htmlFor="ai-toggle">AI Budget Coach</Label>
                <p className="text-xs text-zinc-500">Use AI to enforce category limits.</p>
            </div>
            <Switch id="ai-toggle" checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading || generatingLimits}>
                {generatingLimits ? (
                    <><Sparkles className="animate-pulse w-4 h-4 mr-2" /> Designing Budget...</>
                ) : loading ? (
                    <><Loader2 className="animate-spin w-4 h-4 mr-2" /> Saving...</>
                ) : (
                    existingGroup ? "Save Details" : "Create Trip"
                )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}