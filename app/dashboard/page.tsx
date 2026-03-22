import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

const STATUS_LABEL: Record<string, string> = {
  INITIATED: '발의됨',
  PM_REVIEW: 'PM 검토중',
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
      id, title, status, item_name, target_delivery_date, created_at,
      planner:profiles!projects_planner_id_fkey(name),
      pm:profiles!projects_pm_id_fkey(name),
      designer:profiles!projects_designer_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name} userRole={profile?.role} isAdmin={profile?.is_admin} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">프로젝트 현황</h1>
            <p className="text-gray-500 text-sm mt-0.5">전체 {projects?.length ?? 0}개</p>
          </div>
          {(profile?.role === 'PLANNER') && (
            <Link
              href="/projects/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>+</span> 새 프로젝트
            </Link>
          )}
        </div>

        {/* 상태별 카운트 */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {Object.entries(STATUS_LABEL).map(([key, label]) => {
            const count = projects?.filter((p) => p.status === key).length ?? 0
            return (
              <div key={key} className="bg-white rounded-xl p-4 border border-gray-200 text-center">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            )
          })}
        </div>

        {/* 프로젝트 목록 */}
        <div className="space-y-3">
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[project.status]}`}
                      >
                        {STATUS_LABEL[project.status]}
                      </span>
                      <h2 className="font-semibold text-gray-900">{project.title}</h2>
                    </div>
                    <p className="text-sm text-gray-500">{project.item_name}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      {project.planner && <span>기획: {(project.planner as any)?.name}</span>}
                      {project.pm && <span>PM: {(project.pm as any)?.name}</span>}
                      {project.designer && <span>디자이너: {(project.designer as any)?.name}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">목표 입고일</div>
                    <div className="text-sm font-medium text-gray-700">
                      {project.target_delivery_date
                        ? new Date(project.target_delivery_date).toLocaleDateString('ko-KR')
                        : '-'}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">📦</div>
              <p>아직 프로젝트가 없습니다</p>
              {profile?.role === 'PLANNER' && (
                <Link href="/projects/new" className="mt-4 inline-block text-blue-600 font-medium">
                  첫 프로젝트 시작하기 →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
