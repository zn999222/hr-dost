import { createClient } from '@supabase/supabase-js'

// Single shared Supabase client, reused for all auth and data calls.
// Supabase project: aeqkzgekrzbytbmkfbqb (HR Dost backend — 6 tables:
// profiles, companies, employees, attendance, leave_requests, payroll_records)
// The anon key is public-safe by design: row-level security enforces that
// each signed-in user only ever sees their own company's rows.
// The service-role key is never used here and must never be embedded.
const SUPABASE_URL = 'https://aeqkzgekrzbytbmkfbqb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWt6Z2VrcnpieXRibWtmYnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxOTUyMjksImV4cCI6MjExMDc3MTIyOX0.JR16NDmK2cGZl1UfFu4IgeY0Al0y7DUM7vBw5-miukU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
