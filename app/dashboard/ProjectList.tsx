'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function LaunchScheduleModal({
  projects,
  onClose,
}: {
  projects: any[]
  onClose: () => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewYear, setViewYear] = useState(today.getFullYear())

  const withLaunch = projects.filter((p) => p.target_launch_date)

  // year → month(0~11) → day → items
  const byYearMonth = useMemo(() => {
    const map: Record<number, Record<number, Record<number, any[]>>> = {}
    withLaunch.forEach((p) => {
      const d = new Date(p.target_launch_date)
      const y = d.getFullYear()
      const m = d.getMonth()
      const day = d.getDate()
      if (!map[y]) map[y] = {}
      if (!map[y][m]) map[y][m] = {}
      if (!map[y][m][day]) map[y][m][day] = []
      map[y][m][day].push(p)
    })
    return map
  }, [projects])

  const yearData = byYearMonth[viewYear] ?? {}
  const totalInYear = Object.values(yearData).flatMap(m => Object.values(m).flat()).length

  // 연도 범위: 데이터가 있는 연도 + 현재 연도
  const allYears = useMemo(() => {
    const years = new Set([today.getFullYear(), ...Object.keys(byYearMonth).map(Number)])
    return Array.from(years).sort()
  }, [byYearMonth])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">출시 일정</h2>
              <p className="text-xs text-gray-400 mt-0.5">출시 목표일별 품목 연간 현황</p>
            </div>
            {/* 연도 탐색 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
              <button
                onClick={() => setViewYear((y) => y - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-gray-800 transition-all text-sm font-bold"
              >
                ‹
              </button>
              <span className="font-bold text-gray-800 text-sm px-2 min-w-[56px] text-center">
                {viewYear}년
              </span>
              <button
                onClick={() => setViewYear((y) => y + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-gray-800 transition-all text-sm font-bold"
              >
                ›
              </button>
            </div>
            {/* 연도별 총계 */}
            {totalInYear > 0 && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                {viewYear}년 총 {totalInYear}개 품목
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* ── 12개월 그리드 ── */}
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, monthIdx) => {
              const dayMap = yearData[monthIdx] ?? {}
              const hasItems = Object.keys(dayMap).length > 0
              const totalItems = Object.values(dayMap).flat().length
              const isCurrentMonth =
                today.getFullYear() === viewYear && today.getMonth() === monthIdx
              const isPastMonth =
                viewYear < today.getFullYear() ||
                (viewYear === today.getFullYear() && monthIdx < today.getMonth())

              return (
                <div
                  key={monthIdx}
                  className={`rounded-xl border flex flex-col transition-all ${
                    isCurrentMonth
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : hasItems
                      ? 'border-gray-200 bg-white shadow-sm'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  {/* 월 헤더 */}
                  <div
                    className={`flex items-center justify-between px-3 py-2 border-b rounded-t-xl ${
                      isCurrentMonth
                        ? 'border-blue-200 bg-blue-100'
                        : hasItems
                        ? 'border-gray-100 bg-gray-50'
                        : 'border-transparent'
                    }`}
                  >
                    <span
                      className={`font-bold text-sm ${
                        isCurrentMonth
                          ? 'text-blue-700'
                          : hasItems
                          ? 'text-gray-800'
                          : isPastMonth
                          ? 'text-gray-300'
                          : 'text-gray-400'
                      }`}
                    >
                      {MONTH_NAMES[monthIdx]}
                      {isCurrentMonth && (
                        <span className="ml-1.5 text-[10px] font-semibold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full">
                          이번달
                        </span>
                      )}
                    </span>
                    {totalItems > 0 && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isCurrentMonth
                            ? 'bg-blue-200 text-blue-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {totalItems}
                      </span>
                    )}
                  </div>

                  {/* 품목 목록 */}
                  <div className="p-2.5 flex-1 flex flex-col gap-1.5">
                    {hasItems ? (
                      Object.entries(dayMap)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([day, items]) => (
                          <div key={day}>
                            {/* 날짜 구분선 */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[11px] font-semibold shrink-0 ${
                                  isCurrentMonth ? 'text-blue-500' : 'text-gray-400'
                                }`}
                              >
                                {day}일
                              </span>
                              <div className="flex-1 h-px bg-gray-200" />
                            </div>
                            {/* 품목 카드들 */}
                            {(items as any[]).map((p) => (
                              <Link
                                key={p.id}
                                href={`/projects/${p.id}`}
                                onClick={onClose}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all group mb-1 block"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-700 group-hover:text-blue-700 truncate leading-tight">
                                    {p.item_name || p.title}
                                  </p>
                                  {p.item_name && p.title !== p.item_name && (
                                    <p className="text-[10px] text-gray-400 truncate mt-0.5 leading-tight">
                                      {p.title}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                                    STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {STATUS_LABEL[p.status] ?? p.status}
                                </span>
                              </Link>
                            ))}
                          </div>
                        ))
                    ) : (
                      <div className="flex items-center justify-center flex-1 min-h-[64px]">
                        <span className="text-xs text-gray-300">-</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 푸터 ── */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-400">
              출시일 등록{' '}
              <span className="font-semibold text-gray-600">{withLaunch.length}</span>개 품목
              {' '}/ 전체{' '}
              <span className="font-semibold text-gray-600">{projects.length}</span>개
            </p>
            {/* 연도 빠른 이동 */}
            <div className="flex items-center gap-1">
              {allYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setViewYear(y)}
                  className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all ${
                    y === viewYear
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [showLaunchModal, setShowLaunchModal] = useState(false)

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
      {showLaunchModal && (
        <LaunchScheduleModal projects={projects} onClose={() => setShowLaunchModal(false)} />
      )}

      {/* 출시일정 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowLaunchModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
        >
          <span>📅</span> 출시일정
        </button>
      </div>

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
