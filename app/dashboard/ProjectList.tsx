'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

const STATUS_COUNT_COLOR: Record<string, { dot: string; active: string }> = {
  INITIATED: { dot: 'bg-yellow-400', active: 'border-yellow-400 bg-yellow-50' },
  PM_REVIEW: { dot: 'bg-blue-400', active: 'border-blue-400 bg-blue-50' },
  DESIGN: { dot: 'bg-purple-400', active: 'border-purple-400 bg-purple-50' },
  SAMPLING: { dot: 'bg-orange-400', active: 'border-orange-400 bg-orange-50' },
  CLOSED: { dot: 'bg-green-400', active: 'border-green-400 bg-green-50' },
}

export default function ProjectList({
  projects,
  profile,
}: {
  projects: any[]
  profile: any
}) {
  const router = useRouter()
  const supabase = createClient()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const canDelete = (project: any) =>
    profile?.is_admin || project.planner_id === profile?.id

  const handleDelete = async (e: React.MouseEvent, projectId: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('프로젝트를 삭제하시겠습니까? 모든 일정과 파일이 함께 삭제됩니다.')) return

    setDeletingId(projectId)
    await supabase.from('projects').delete().eq('id', projectId)
    router.refresh()
    setDeletingId(null)
  }

  const filtered = statusFilter ? projects.filter((p) => p.status === statusFilter) : projects

  if (!projects.length) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-4xl mb-3">📦</div>
        <p>아직 프로젝트가 없습니다</p>
        {profile?.role === 'PLANNER' && (
          <Link href="/projects/new" className="mt-4 inline-block text-blue-600 font-medium">
            첫 프로젝트 시작하기 →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 상태별 카운트 카드 */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(STATUS_LABEL).map(([key, label]) => {
          const count = projects.filter((p) => p.status === key).length
          const isActive = statusFilter === key
          const colors = STATUS_COUNT_COLOR[key]
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(isActive ? null : key)}
              className={`bg-white rounded-xl p-4 border-2 text-center transition-all hover:shadow-sm ${
                isActive ? colors.active : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                <span className="text-2xl font-bold text-gray-900">{count}</span>
              </div>
              <div className="text-xs text-gray-500">{label}</div>
            </button>
          )
        })}
      </div>

      {/* 필터 안내 */}
      {statusFilter && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-800">{STATUS_LABEL[statusFilter]}</span> 프로젝트 {filtered.length}개
          </p>
          <button onClick={() => setStatusFilter(null)} className="text-xs text-gray-400 hover:text-gray-600">
            전체 보기
          </button>
        </div>
      )}

      <div className="space-y-3">
      {filtered.map((project) => (
        <div key={project.id} className="relative group">
          <Link
            href={`/projects/${project.id}`}
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[project.status]}`}>
                    {STATUS_LABEL[project.status]}
                  </span>
                  <h2 className="font-semibold text-gray-900 truncate">{project.title}</h2>
                </div>
                <p className="text-sm text-gray-500">{project.item_name}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  {project.planner && <span>기획: {project.planner?.name}</span>}
                  {project.pm && <span>PM: {project.pm?.name}</span>}
                  {project.designer && <span>디자이너: {project.designer?.name}</span>}
                </div>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <div>
                  <div className="text-xs text-gray-400">목표 입고일</div>
                  <div className="text-sm font-medium text-gray-700">
                    {project.target_delivery_date
                      ? new Date(project.target_delivery_date).toLocaleDateString('ko-KR')
                      : '-'}
                  </div>
                </div>
                {project.target_launch_date && (
                  <div>
                    <div className="text-xs text-gray-400">목표 출시일</div>
                    <div className="text-sm font-medium text-blue-600">
                      {new Date(project.target_launch_date).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* 삭제 버튼 - 호버 시 표시 */}
          {canDelete(project) && (
            <button
              onClick={(e) => handleDelete(e, project.id)}
              disabled={deletingId === project.id}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all disabled:opacity-50"
              title="프로젝트 삭제"
            >
              {deletingId === project.id ? (
                <span className="text-xs">...</span>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      ))}
      </div>
    </div>
  )
}
