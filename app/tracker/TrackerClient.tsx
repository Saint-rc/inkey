'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

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

const PIPELINE = [
  {
    key: 'INITIATED', label: '발의',
    activeNode: 'bg-yellow-400 text-white ring-[3px] ring-yellow-100',
    doneNode:   'bg-yellow-300 text-white',
    doneLine:   'bg-yellow-300',
    activeLabel:'text-yellow-600 font-semibold',
    subLabel:   'text-yellow-500',
    filterActive: 'bg-yellow-400 text-white',
  },
  {
    key: 'PM_REVIEW', label: '상품기획',
    activeNode: 'bg-blue-500 text-white ring-[3px] ring-blue-100',
    doneNode:   'bg-blue-400 text-white',
    doneLine:   'bg-blue-400',
    activeLabel:'text-blue-600 font-semibold',
    subLabel:   'text-blue-500',
    filterActive: 'bg-blue-500 text-white',
  },
  {
    key: 'DESIGN', label: '디자인',
    activeNode: 'bg-purple-500 text-white ring-[3px] ring-purple-100',
    doneNode:   'bg-purple-400 text-white',
    doneLine:   'bg-purple-400',
    activeLabel:'text-purple-600 font-semibold',
    subLabel:   'text-purple-500',
    filterActive: 'bg-purple-500 text-white',
  },
  {
    key: 'SAMPLING', label: '샘플/양산',
    activeNode: 'bg-orange-500 text-white ring-[3px] ring-orange-100',
    doneNode:   'bg-orange-400 text-white',
    doneLine:   'bg-orange-400',
    activeLabel:'text-orange-600 font-semibold',
    subLabel:   'text-orange-500',
    filterActive: 'bg-orange-500 text-white',
  },
  {
    key: 'CLOSED', label: '완료',
    activeNode: 'bg-green-500 text-white ring-[3px] ring-green-100',
    doneNode:   'bg-green-400 text-white',
    doneLine:   'bg-green-400',
    activeLabel:'text-green-600 font-semibold',
    subLabel:   'text-green-500',
    filterActive: 'bg-green-500 text-white',
  },
]
const PIPELINE_ORDER = PIPELINE.map((s) => s.key)

const DESIGN_STEP_PROGRESS: Record<string, number> = {
  DESIGN_1ST_WORK: 1,
  DESIGN_1ST_REVIEW: 2,
  DESIGN_2ND_WORK: 3,
  DESIGN_2ND_REVIEW: 4,
  WORK_ORDER_READY: 5,
  WORK_ORDER_SENT: 6,
}
const DESIGN_STEP_LABEL: Record<string, string> = {
  DESIGN_1ST_WORK: '1차 디자인중',
  DESIGN_1ST_REVIEW: '1차 검수중',
  DESIGN_2ND_WORK: '2차 디자인중',
  DESIGN_2ND_REVIEW: '2차 검수중',
  WORK_ORDER_READY: '작지서 작성중',
  WORK_ORDER_SENT: '작지서 완료',
}

const SAMPLE_STEP_LABEL: Record<string, string> = {
  SAMPLE_REQUESTED:      '1차 샘플 의뢰중',
  SAMPLE_ARRIVED:        '1차 샘플 도착',
  SAMPLE_1ST_REVIEW:     '1차 검수중',
  SAMPLE_2ND_PRODUCTION: '2차 샘플 제작중',
  SAMPLE_2ND_REVIEW:     '2차 검수중',
  MASS_PRODUCTION_START: '양산중',
  SHIPPING_STARTED:      '운송중',
  WAREHOUSED:            '입고완료',
}

const SAMPLE_DATE_STAGES = [
  { stageName: 'SAMPLE_1ST',      label: '1차 샘플 도착 예정일' },
  { stageName: 'SAMPLE_2ND',      label: '2차 샘플 도착 예정일' },
  { stageName: 'MASS_PRODUCTION', label: '양산 완료 예정일' },
  { stageName: 'SHIPPING',        label: '운송 도착 예정일' },
  { stageName: 'WAREHOUSING',     label: '입고 예정일' },
]

function MiniTimeline({
  status,
  designStep,
  designExpectedDate,
  sampleStep,
}: {
  status: string
  designStep?: string | null
  designExpectedDate?: string | null
  sampleStep?: string | null
}) {
  const currentIdx = PIPELINE_ORDER.indexOf(status)

  return (
    <div className="flex items-start w-full max-w-lg">
      {PIPELINE.map((stage, i) => {
        const isDone = i < currentIdx
        const isActive = i === currentIdx

        // 활성 단계 세부 정보
        const subLabel = isActive && status === 'DESIGN' && designStep
          ? DESIGN_STEP_LABEL[designStep]
          : isActive && status === 'SAMPLING' && sampleStep
          ? SAMPLE_STEP_LABEL[sampleStep]
          : null
        const subDate = isActive && status === 'DESIGN' && designExpectedDate
          ? new Date(designExpectedDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
          : null

        return (
          <div key={stage.key} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center min-w-0 flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    isDone
                      ? 'bg-gray-400 text-white'
                      : isActive
                      ? stage.activeNode
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-[11px] font-bold">{i + 1}</span>
                  )}
                </div>
                <span className={`text-[11px] mt-1 whitespace-nowrap ${isActive ? stage.activeLabel : isDone ? 'text-gray-500' : 'text-gray-300'}`}>
                  {stage.label}
                </span>
                {isActive && (subLabel || subDate) && (
                  <div className="flex flex-col items-center mt-1 gap-0.5">
                    {subLabel && (
                      <span className={`text-[11px] font-medium whitespace-nowrap ${stage.subLabel}`}>{subLabel}</span>
                    )}
                    {subDate && (
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">목표 {subDate}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={`flex-1 h-0.5 mt-3.5 mx-2 shrink-0 ${i < currentIdx ? 'bg-gray-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const STAGE_LABELS: Record<string, string> = {
  DESIGN_1ST: '1차 디자인',
  DESIGN_2ND: '2차 디자인',
  SAMPLE_1ST: '1차 샘플',
  SAMPLE_2ND: '2차 샘플',
  MASS_PRODUCTION: '양산',
  SHIPPING: '운송',
  WAREHOUSING: '입고',
}

const STAGE_ORDER = ['DESIGN_1ST', 'DESIGN_2ND', 'SAMPLE_1ST', 'SAMPLE_2ND', 'MASS_PRODUCTION', 'SHIPPING', 'WAREHOUSING']

function formatDate(d: string | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

function isOverdue(dateStr: string | null | undefined) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

const PIPELINE_FILTER = [
  { key: null,        label: '전체',     activeClass: 'bg-gray-700 text-white',    badgeClass: 'bg-white/20 text-white' },
  { key: 'INITIATED', label: '발의',     activeClass: 'bg-yellow-400 text-white',  badgeClass: 'bg-white/30 text-white' },
  { key: 'PM_REVIEW', label: '상품기획',  activeClass: 'bg-blue-500 text-white',    badgeClass: 'bg-white/20 text-white' },
  { key: 'DESIGN',    label: '디자인',   activeClass: 'bg-purple-500 text-white',  badgeClass: 'bg-white/20 text-white' },
  { key: 'SAMPLING',  label: '샘플/양산', activeClass: 'bg-orange-500 text-white', badgeClass: 'bg-white/20 text-white' },
]

export default function TrackerClient({
  projects,
  schedules,
}: {
  projects: any[]
  schedules: any[]
}) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'title' | 'item' | 'designer'>('title')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  // 디자이너 목록 (중복 제거)
  const designerNames = useMemo(() => {
    const names = new Set<string>()
    for (const p of projects) {
      if (p.designer?.name) names.add(p.designer.name)
    }
    return Array.from(names).sort()
  }, [projects])

  const filtered = useMemo(() => {
    let result = projects
    if (statusFilter) result = result.filter((p) => p.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) => {
        if (filterType === 'title') return p.title?.toLowerCase().includes(q)
        if (filterType === 'item') return p.item_name?.toLowerCase().includes(q)
        if (filterType === 'designer') return p.designer?.name?.toLowerCase().includes(q)
        return true
      })
    }
    // 목표 출시일 오름차순 정렬 (없는 항목은 맨 뒤)
    return [...result].sort((a, b) => {
      if (!a.target_launch_date && !b.target_launch_date) return 0
      if (!a.target_launch_date) return 1
      if (!b.target_launch_date) return -1
      return new Date(a.target_launch_date).getTime() - new Date(b.target_launch_date).getTime()
    })
  }, [projects, search, filterType, statusFilter])

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) counts[p.status] = (counts[p.status] ?? 0) + 1
    return counts
  }, [projects])

  const getProjectSchedules = (projectId: number) =>
    schedules.filter((s) => s.project_id === projectId)

  return (
    <div className="space-y-4">
      {/* 단계 필터 탭 */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2 overflow-x-auto">
        {PIPELINE_FILTER.map((f, i) => {
          const count = f.key ? (countByStatus[f.key] ?? 0) : projects.length
          const isActive = statusFilter === f.key
          return (
            <button
              key={i}
              onClick={() => setStatusFilter(f.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? f.activeClass : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? f.badgeClass : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 검색 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {([
            { key: 'title', label: '프로젝트명' },
            { key: 'item', label: '제품명' },
            { key: 'designer', label: '디자이너' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilterType(key); setSearch('') }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filterType === key ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filterType === 'designer' ? (
          <select
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="">전체 디자이너</option>
            {designerNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={filterType === 'title' ? '프로젝트명 검색...' : '제품명 검색...'}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        )}
        <span className="text-sm text-gray-400">{filtered.length}개</span>
      </div>

      {/* 프로젝트 카드 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">검색 결과가 없습니다</div>
      ) : (
        filtered.map((project) => {
          const pSchedules = getProjectSchedules(project.id)
          const isOpen = expanded === project.id

          return (
            <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 카드 헤더 */}
              <button
                onClick={() => setExpanded(isOpen ? null : project.id)}
                className="w-full px-5 pt-4 pb-3 hover:bg-gray-50 transition-colors text-left"
              >
                {/* 상단: 프로젝트명 + 날짜 + 화살표 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{project.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5 font-medium">{project.item_name}</p>
                    </div>
                    {project.design_step && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full shrink-0">
                        {DESIGN_STEP_LABEL[project.design_step]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">목표 입고일</p>
                      {(() => {
                        const warehouseSc = pSchedules.find((s) => s.stage_name === 'WAREHOUSING')
                        const adjusted = warehouseSc?.pm_adjusted_date
                        const original = project.target_delivery_date
                        const displayDate = adjusted ?? original
                        const isChanged = adjusted && adjusted !== original
                        return (
                          <div className="flex flex-col items-end">
                            <p className={`text-sm font-semibold ${isOverdue(displayDate) ? 'text-red-500' : 'text-gray-700'}`}>
                              {formatDate(displayDate)}
                            </p>
                            {isChanged && (
                              <p className="text-xs text-gray-300 line-through">{formatDate(original)}</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                    {project.target_launch_date && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-400">목표 출시일</p>
                        <p className="text-sm font-semibold text-blue-600">
                          {formatDate(project.target_launch_date)}
                        </p>
                      </div>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* 하단: 미니 타임라인 */}
                <MiniTimeline
                  status={project.status}
                  designStep={project.design_step}
                  designExpectedDate={project.design_expected_date}
                  sampleStep={project.sample_step}
                />
              </button>

              {/* 확장 상세 */}
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                  {/* 담당자 */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {project.planner?.name && (
                      <div><span className="text-gray-400">기획</span> <span className="font-medium text-gray-700">{project.planner.name}</span></div>
                    )}
                    {project.pm?.name && (
                      <div><span className="text-gray-400">PM</span> <span className="font-medium text-gray-700">{project.pm.name}</span></div>
                    )}
                    {project.designer?.name && (
                      <div><span className="text-gray-400">디자이너</span> <span className="font-medium text-gray-700">{project.designer.name}</span></div>
                    )}
                  </div>

                  {/* 디자인 예상 완료일 */}
                  {project.design_expected_date && (
                    <div className="flex items-center gap-2 text-sm bg-purple-50 rounded-lg px-3 py-2">
                      <span className="text-purple-400">✏️</span>
                      <span className="text-gray-500">디자인 예상완료일</span>
                      <span className="font-semibold text-purple-700">
                        {new Date(project.design_expected_date).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  )}

                  {/* 샘플·양산 예상일 */}
                  {project.status === 'SAMPLING' && (() => {
                    const fields = SAMPLE_DATE_STAGES.map((f) => {
                      const s = pSchedules.find((sc) => sc.stage_name === f.stageName)
                      const date = s?.pm_adjusted_date ?? s?.auto_estimated_date
                      return { ...f, date }
                    }).filter((f) => f.date)
                    if (!fields.length) return null
                    return (
                      <div className="bg-orange-50 rounded-lg px-3 py-2.5 space-y-1.5">
                        {fields.map((f) => (
                          <div key={f.stageName} className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              <span className="text-orange-400">📦</span>
                              {f.label}
                            </span>
                            <span className="font-semibold text-orange-700">
                              {new Date(f.date!).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* 단계별 일정 */}
                  {pSchedules.length > 0 ? (
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-max pb-1">
                        {STAGE_ORDER.map((stage) => {
                          const s = pSchedules.find((sc) => sc.stage_name === stage)
                          if (!s) return null
                          const date = s.pm_adjusted_date ?? s.auto_estimated_date
                          const overdue = isOverdue(date)
                          const isAdjusted = s.pm_adjusted_date && s.pm_adjusted_date !== s.auto_estimated_date

                          return (
                            <div
                              key={stage}
                              className={`flex flex-col items-center px-4 py-3 rounded-xl border min-w-[90px] ${
                                s.is_delayed
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <p className="text-xs text-gray-400 mb-1">{STAGE_LABELS[stage]}</p>
                              <p className={`text-sm font-bold ${overdue ? 'text-red-500' : 'text-gray-800'}`}>
                                {formatDate(date)}
                              </p>
                              {isAdjusted && (
                                <p className="text-xs text-gray-300 mt-0.5 line-through">{formatDate(s.auto_estimated_date)}</p>
                              )}
                              {s.is_delayed && (
                                <span className="text-xs text-red-400 mt-1">⚠️ 빠듯</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">PM 일정 미입력</p>
                  )}

                  {/* 상세 보기 링크 */}
                  <div className="pt-1">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      프로젝트 상세 보기 →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
