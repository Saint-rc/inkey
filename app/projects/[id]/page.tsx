import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ProjectTimeline from '@/components/ProjectTimeline'
import PMReviewSection from './PMReviewSection'
import DesignSection from './DesignSection'
import SamplingSection from './SamplingSection'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      planner:profiles!projects_planner_id_fkey(id, name, email),
      pm:profiles!projects_pm_id_fkey(id, name, email),
      design_leader:profiles!projects_design_leader_id_fkey(id, name, email),
      designer:profiles!projects_designer_id_fkey(id, name, email)
    `)
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: schedules } = await supabase
    .from('project_schedules')
    .select('*')
    .eq('project_id', id)
    .order('id')

  const { data: files } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', id)
    .order('created_at')

  const { data: designers } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'DESIGNER')

  const { data: pms } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'PM')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name} userRole={profile?.role} isAdmin={profile?.is_admin} />
      <ProjectTimeline currentStatus={project.status} schedules={schedules ?? []} />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* 프로젝트 기본 정보 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{project.item_name}</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              {project.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['재질', project.material],
              ['패키지 사양', project.package_spec],
              ['예상 수량', project.quantity ? `${project.quantity.toLocaleString()}개` : null],
              ['프로젝트 시작일', project.start_date ? new Date(project.start_date).toLocaleDateString('ko-KR') : null],
              ['목표 입고일', project.target_delivery_date ? new Date(project.target_delivery_date).toLocaleDateString('ko-KR') : null],
              ['기획자', (project.planner as any)?.name],
            ].map(([label, value]) =>
              value ? (
                <div key={label as string} className="flex gap-2">
                  <span className="text-gray-400 w-24 shrink-0">{label}</span>
                  <span className="text-gray-800 font-medium">{value}</span>
                </div>
              ) : null
            )}
          </div>

          {project.memo && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <span className="font-medium text-gray-700">메모: </span>{project.memo}
            </div>
          )}

          {/* 레퍼런스 이미지 */}
          {files && files.filter(f => f.file_type === 'REFERENCE').length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">레퍼런스 이미지</p>
              <div className="flex gap-2 flex-wrap">
                {files.filter(f => f.file_type === 'REFERENCE').map(file => (
                  <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer">
                    <img
                      src={file.file_url}
                      alt={file.file_name}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PM 검토 섹션 */}
        <PMReviewSection
          project={project}
          schedules={schedules ?? []}
          profile={profile}
          pms={pms ?? []}
        />

        {/* 디자인 섹션 */}
        {['DESIGN', 'SAMPLING', 'CLOSED'].includes(project.status) && (
          <DesignSection
            project={project}
            files={files ?? []}
            profile={profile}
            designers={designers ?? []}
          />
        )}

        {/* 샘플/양산 섹션 */}
        {['SAMPLING', 'CLOSED'].includes(project.status) && (
          <SamplingSection
            project={project}
            schedules={schedules ?? []}
            profile={profile}
          />
        )}
      </div>
    </div>
  )
}
