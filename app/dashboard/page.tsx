import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ProjectList from './ProjectList'

const STATUS_LABEL: Record<string, string> = {
  INITIATED: '발의됨',
  PM_REVIEW: '상품기획 검토중',
  DESIGN: '디자인 진행',
  SAMPLING: '샘플/양산',
  CLOSED: '완료',
}

const STATUS_COLOR: Record<string, string> = {
  INITIATED: 'bg-yellow-100 text-yellow-700',
  PM_REVIEW: 'bg-blue-100 text-blue-700',
  DESIGN: 'bg-purple-100 text-purple-700',
  SAMPLING: 'bg-orange-100 text-orange-700',
  CLOSED: 'bg-green-100 text-green-700',
}

export default async function DashboardPage() {
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
      id, title, status, item_name, target_delivery_date, target_launch_date, created_at, planner_id, sample_step,
      planner:profiles!projects_planner_id_fkey(name),
      pm:profiles!projects_pm_id_fkey(name),
      designer:profiles!projects_designer_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  const { data: schedules } = await supabase
    .from('project_schedules')
    .select('project_id, stage_name, pm_adjusted_date, auto_estimated_date')
    .in('stage_name', ['SAMPLE_1ST', 'SAMPLE_2ND'])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name} userRole={profile?.role} isAdmin={profile?.is_admin} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">프로젝트 현황</h1>
            <p className="text-gray-500 text-sm mt-0.5">전체 {projects?.length ?? 0}개</p>
          </div>
          <Link
            href="/projects/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> 새 프로젝트
          </Link>
        </div>

        <ProjectList projects={projects ?? []} profile={profile} schedules={schedules ?? []} />
      </div>
    </div>
  )
}
