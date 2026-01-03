"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { useEffect, useState } from "react"

const supabase = createClient()
const LS_KEY = "lastViewedGroupId"

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

export function useGroups(userId: string | null) {
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)

  const groupsQuery = useQuery({
    queryKey: ["groups", userId],
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await supabase
        .from("group_members")
        .select(`groups(*)`)
        .eq("user_id", userId)

      if (error) throw error
      return (data || []).map(g => g.groups).filter(Boolean) as unknown as Group[]
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 3,
  })

  const groups = groupsQuery.data || []

  // ------------------------------------------------
  // AUTO SELECT BEST GROUP
  // ------------------------------------------------
  useEffect(() => {
    if (!groupsQuery.isSuccess) return

    if (!groups.length) {
      setActiveGroup(null)
      return
    }

    // 1️⃣ LocalStorage restore
    const last = localStorage.getItem(LS_KEY)
    if (last) {
      const found = groups.find(g => g.id === last)
      if (found) {
        setActiveGroup(found)
        return
      } else {
        localStorage.removeItem(LS_KEY)
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 2️⃣ Ongoing Trips
    const ongoing = groups.filter(g => {
      if (!g.start_date || !g.end_date) return false
      const s = new Date(g.start_date)
      const e = new Date(g.end_date)
      s.setHours(0,0,0,0)
      e.setHours(0,0,0,0)
      return today >= s && today <= e
    })

    if (ongoing.length) {
      setActiveGroup(ongoing[0])
      localStorage.setItem(LS_KEY, ongoing[0].id)
      return
    }

    // 3️⃣ Upcoming Trips
    const upcoming = groups
      .filter(g => g.start_date && new Date(g.start_date) > today)
      .sort((a, b) =>
        new Date(a.start_date!).getTime() -
        new Date(b.start_date!).getTime()
      )

    if (upcoming.length) {
      setActiveGroup(upcoming[0])
      localStorage.setItem(LS_KEY, upcoming[0].id)
      return
    }

    // 4️⃣ Latest Past Trip
    const past = [...groups].sort((a, b) => {
      const A = gEnd(a)
      const B = gEnd(b)
      return B - A
    })

    const chosen = past[0]
    setActiveGroup(chosen)
    localStorage.setItem(LS_KEY, chosen.id)

  }, [groups, groupsQuery.isSuccess])

  // helper
  function gEnd(g: Group) {
    return g.end_date
      ? new Date(g.end_date).getTime()
      : new Date(g.created_at).getTime()
  }

  // ------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------
  const selectGroup = (g: Group) => {
    localStorage.setItem(LS_KEY, g.id)
    setActiveGroup(g)
  }

  return {
    groups,
    isLoadingGroups: groupsQuery.isLoading,
    activeGroup,
    selectGroup,
  }
}
