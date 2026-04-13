import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ProjectTimeline from '@/components/ProjectTimeline'
import ProjectTabs from './ProjectTabs'

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
    .select('id, name, role')

  const { data: pms } = await supabase
    .from('profiles')
    .select('id, name')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name} userRole={profile?.role} isAdmin={profile?.is_admin} />
      <ProjectTimeline currentStatus={project.status} schedules={schedules ?? []} />

      <ProjectTabs
        project={project}
        schedules={schedules ?? []}
        files={files ?? []}
        designers={designers ?? []}
        pms={pms ?? []}
        profile={profile}
      />
    </div>
  )
}
