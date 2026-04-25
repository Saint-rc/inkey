import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import TrackerClient from './TrackerClient'

export default async function TrackerPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, title, item_name, status, design_step, design_expected_date, design_rejected,
      sample_step, start_date, target_delivery_date, target_launch_date, thumbnail_url,
      planner:profiles!projects_planner_id_fkey(name),
      pm:profiles!projects_pm_id_fkey(name),
      design_leader:profiles!projects_design_leader_id_fkey(name),
      designer:profiles!projects_designer_id_fkey(name)
    `)
    .neq('status', 'CLOSED')
    .order('created_at', { ascending: false })

  const { data: schedules } = await supabase
    .from('project_schedules')
    .select('*')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name} userRole={profile?.role} isAdmin={profile?.is_admin} />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">일정 현황</h1>
          <p className="text-gray-500 text-sm mt-1">진행 중인 모든 프로젝트의 단계별 일정을 확인합니다</p>
        </div>
        <TrackerClient projects={projects ?? []} schedules={schedules ?? []} />
      </div>
    </div>
  )
}
