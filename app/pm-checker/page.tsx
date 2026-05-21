import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import PmCheckerClient from './PmCheckerClient'

export const metadata = { title: 'PM 파일 검수 — INKEY' }

export default async function PmCheckerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        userName={profile?.name}
        userRole={profile?.role}
        isAdmin={profile?.is_admin}
      />
      <PmCheckerClient />
    </div>
  )
}
