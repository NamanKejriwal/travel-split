import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// This check ensures you don't run the app without keys
if (!supabaseUrl || !supabaseAnonKey) {
  // Log strictly to console for debugging
  console.error("Supabase Error: Missing Environment Variables")
  console.error("NEXT_PUBLIC_SUPABASE_URL found:", !!supabaseUrl)
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY found:", !!supabaseAnonKey)
  
  throw new Error(
    'Missing Supabase environment variables. \n' +
    'Please check your .env.local file and RESTART your server (npm run dev).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)