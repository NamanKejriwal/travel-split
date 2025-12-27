import { createClient } from "@/utils/supabase/server"
import { MainApp } from "@/components/main-app"

export default async function Home() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <MainApp initialUser={user} />
}