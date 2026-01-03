// app/page.tsx
import { createClient } from "@/utils/supabase/server"
import { MainApp } from "@/components/main-app"

export default async function Home() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let hasProfile = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()
    
    hasProfile = !!profile
  }

  return <MainApp initialUser={user} hasProfile={hasProfile} />
}