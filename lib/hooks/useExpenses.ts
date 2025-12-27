"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

export function useExpenses(groupId: string | null) {
  return useQuery({
    queryKey: ["expenses", groupId],
    queryFn: async () => {
      if (!groupId) return []

      const { data, error } = await supabase
        .from("expenses")
        .select(`*, profiles(full_name)`)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!groupId,
    staleTime: 1000 * 60 * 2
  })
}
