'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProjectInfoSection from './ProjectInfoSection'
import PMReviewSection from './PMReviewSection'
import DesignSection from './DesignSection'
import SamplingSection, { SamplingPreviewForDesign } from './SamplingSection'
import QuoteSection from './QuoteSection'
import DeadlineSection from './DeadlineSection'

// ── 팀별 탭 정의 ──────────────────────────────────────────
type TabKey = 'planning' | 'design' | 'production'

const STATUS_LABEL: Record<string, string> = {
  INITIATED: '발의됨',
  PM_REVIEW: '검토중',
  DESIGN: '진행중',
  SAMPLING: '진행중',
  CLOSED: '완료',
}

const getDesignStatus = (step: string | null) => {
  if (!step) return null
  const map: Record<string, string> = {
    DESIGN_1ST_WORK: '1차 디자인중',
    DESIGN_1ST_REVIEW: '1차 검수중',
    DESIGN_2ND_WORK: '2차 디자인중',
    DESIGN_2ND_REVIEW: '2차 검수중',
    WORK_ORDER_READY: '작지서 작성중',
    WORK_ORDER_SENT: '작지서 완료',
  }
  return map[step] ?? null
}

const getSampleStatus = (step: string | null) => {
  if (!step) return null
  const map: Record<string, string> = {
    SAMPLE_WAIT:      '샘플 제작 대기',
    SAMPLE_REQUESTED: '1차 샘플 의뢰',
    SAMPLE_ARRIVED: '1차 검수중',
    SAMPLE_2ND_PRODUCTION: '2차 샘플 제작',
    SAMPLE_2ND_REVIEW: '2차 검수중',
    MASS_PRODUCTION_START: '양산중',
    SHIPPING_STARTED: '운송중',
    WAREHOUSED: '입고완료',
  }
  return map[step] ?? null
}

// ── 필수 확인사항 공용 타입 & 유틸 ────────────────────────
type Memo = {
  id: number
  content: string
  is_checked: boolean
  created_by_name: string | null
  created_at: string
}

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 공용 메모 콘텐츠 (패널/모달 공용) ─────────────────────
function MemoContent({
  projectId,
  profileName,
  onCountChange,
}: {
  projectId: number
  profileName: string
  onCountChange?: (n: number) => void
}) {
  const supabase = createClient()
  const [memos, setMemos] = useState<Memo[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('project_memos')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    const list = data ?? []
    setMemos(list)
    onCountChange?.(list.length)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [memos])

  const handleAdd = async () => {
    if (!input.trim() || saving) return
    setSaving(true)
    const { data } = await supabase.from('project_memos').insert({
      project_id: projectId,
      content: input.trim(),
      is_checked: false,
      created_by_name: profileName,
    }).select().single()
    if (data) {
      const next = [...memos, data]
      setMemos(next)
      onCountChange?.(next.length)
    }
    setInput('')
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    const next = memos.filter(m => m.id !== id)
    setMemos(next)
    onCountChange?.(next.length)
    await supabase.from('project_memos').delete().eq('id', id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() }
  }

  return (
    <>
      {/* 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 min-h-0">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">불러오는 중...</p>
        ) : memos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">등록된 항목이 없습니다.<br />아래에서 추가해보세요.</p>
        ) : (
          memos.map((memo, idx) => (
            <div
              key={memo.id}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors group"
            >
              {/* 번호 */}
              <span className="text-xs font-bold text-gray-400 shrink-0 mt-0.5 w-4 text-right">
                {idx + 1}.
              </span>
              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug">{memo.content}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {memo.created_by_name ?? '알 수 없음'} · {fmt(memo.created_at)}
                </p>
              </div>
              {/* 삭제 */}
              <button
                onClick={() => handleDelete(memo.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-xs shrink-0 mt-0.5"
              >✕</button>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="항목 입력 후 Enter 또는 추가 버튼"
            rows={2}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim() || saving}
            className="px-3 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl disabled:opacity-30 transition-colors shrink-0"
          >
            {saving ? '...' : '추가'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── 모달 ──────────────────────────────────────────────────
function MemoModal({
  projectId,
  profileName,
  onCountChange,
  onClose,
}: {
  projectId: number
  profileName: string
  onCountChange?: (n: number) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-gray-800">필수 확인사항</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 text-sm transition-colors"
          >✕</button>
        </div>
        <MemoContent projectId={projectId} profileName={profileName} onCountChange={onCountChange} />
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function ProjectTabs({
  project,
  schedules,
  files,
  designers,
  pms,
  profile,
  designRejectCount,
}: {
  project: any
  schedules: any[]
  files: any[]
  designers: any[]
  pms: any[]
  profile: any
  designRejectCount: number
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('planning')
  const [showMemo, setShowMemo] = useState(false)
  const [memoCount, setMemoCount] = useState<number | null>(null)

  const supabase = createClient()

  // 필수 확인사항 갯수 초기 로드 (도트 배지용)
  useEffect(() => {
    supabase
      .from('project_memos')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .then(({ count }) => setMemoCount(count ?? 0))
  }, [project.id])

  const projectStatus = project.status
  const designStep = project.design_step
  const sampleStep = project.sample_step

  const planningStatus = STATUS_LABEL[projectStatus] ?? projectStatus
  const designStatus = getDesignStatus(designStep)
  const sampleStatus = getSampleStatus(sampleStep)

  const isPlanningActive = ['INITIATED', 'PM_REVIEW'].includes(projectStatus)
  const isDesignActive = ['DESIGN'].includes(projectStatus)
  const isProductionActive = ['SAMPLING'].includes(projectStatus)
  const isClosed = projectStatus === 'CLOSED'

  const designNeedsAction =
    projectStatus === 'DESIGN' ||
    (projectStatus === 'SAMPLING' && ['SAMPLE_ARRIVED', 'SAMPLE_2ND_REVIEW'].includes(sampleStep ?? ''))

  const productionNeedsAction =
    projectStatus === 'SAMPLING' &&
    !['SAMPLE_ARRIVED', 'SAMPLE_2ND_REVIEW', 'WAREHOUSED'].includes(sampleStep ?? '')

  const tabs: {
    key: TabKey
    team: string
    icon: string
    desc: string
    badge: string | null
    badgeColor: string
    dotColor: string
    available: boolean
    needsAction: boolean
    extraBadge?: string | null
  }[] = [
    {
      key: 'planning',
      team: '신규기획팀',
      icon: '💡',
      desc: '프로젝트 발의 · 일정 검토',
      badge: planningStatus,
      badgeColor: isPlanningActive
        ? 'bg-blue-100 text-blue-700'
        : isClosed
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-500',
      dotColor: isPlanningActive ? 'bg-blue-500' : isClosed ? 'bg-green-500' : 'bg-gray-300',
      available: true,
      needsAction: false,
    },
    {
      key: 'design',
      team: '디자인팀',
      icon: '🎨',
      desc: '디자인 진행 · 작지서 제작',
      badge: designStatus ?? (
        ['DESIGN', 'SAMPLING', 'CLOSED'].includes(projectStatus) ? '완료' : '대기중'
      ),
      badgeColor: isDesignActive
        ? 'bg-purple-100 text-purple-700'
        : ['SAMPLING', 'CLOSED'].includes(projectStatus)
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-400',
      dotColor: isDesignActive
        ? 'bg-purple-500'
        : ['SAMPLING', 'CLOSED'].includes(projectStatus)
        ? 'bg-green-500'
        : 'bg-gray-200',
      available: ['DESIGN', 'SAMPLING', 'CLOSED'].includes(projectStatus),
      needsAction: designNeedsAction,
    },
    {
      key: 'production',
      team: '상품기획팀',
      icon: '📦',
      desc: '샘플 검수 · 양산 · 입고',
      badge: sampleStatus ?? (
        ['SAMPLING', 'CLOSED'].includes(projectStatus) ? (isClosed ? '입고완료' : '진행중') : '대기중'
      ),
      badgeColor: isProductionActive
        ? 'bg-orange-100 text-orange-700'
        : isClosed
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-400',
      dotColor: isProductionActive
        ? 'bg-orange-500'
        : isClosed
        ? 'bg-green-500'
        : 'bg-gray-200',
      available: ['SAMPLING', 'CLOSED'].includes(projectStatus),
      needsAction: productionNeedsAction,
      extraBadge: project.deadline_step === 'DEADLINE_REQUESTED' ? '데드라인 체크중' : null,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* ── 탭 헤더 ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-150 ${
                isActive
                  ? tab.needsAction
                    ? 'border-amber-400 bg-white shadow-md shadow-amber-100'
                    : 'border-gray-800 bg-white shadow-md'
                  : tab.needsAction
                  ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:shadow-sm'
                  : tab.available
                  ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  : 'border-gray-100 bg-gray-50 cursor-default'
              }`}
            >
              {isActive && (
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${tab.needsAction ? 'bg-amber-400' : 'bg-gray-800'}`} />
              )}

              {tab.needsAction && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  승인 필요
                </div>
              )}

              <div className="flex items-start justify-between mb-2">
                <span className="text-xl">{tab.icon}</span>
                <div className="flex flex-col items-end gap-1">
                  {!tab.needsAction && (
                    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tab.badgeColor}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${tab.dotColor}`} />
                      {tab.badge}
                    </div>
                  )}
                  {tab.extraBadge && (
                    <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      {tab.extraBadge}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className={`text-sm font-bold ${isActive ? 'text-gray-900' : tab.available ? 'text-gray-700' : 'text-gray-400'}`}>
                  {tab.team}
                </p>
                <p className={`text-xs mt-0.5 ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                  {tab.desc}
                </p>
              </div>

              {!tab.available && (
                <div className="absolute inset-0 rounded-2xl flex items-end justify-end p-3">
                  <span className="text-xs text-gray-300 font-medium">이전 단계 완료 후 활성화</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── 다른 팀 현황 미리보기 + 체크리스트 버튼 ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {tabs.filter(t => t.key !== activeTab && t.available).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors text-xs text-gray-500 hover:text-gray-700"
            >
              <span>{t.icon}</span>
              <span className="font-medium">{t.team}</span>
              <span className={`px-1.5 py-0.5 rounded-full ${t.badgeColor}`}>{t.badge}</span>
            </button>
          ))}
        </div>

        {/* 필수 확인사항 버튼 */}
        <button
          onClick={() => setShowMemo(true)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all text-xs text-gray-600 hover:text-gray-800 font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          필수 확인사항
          {memoCount !== null && memoCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-400" />
          )}
        </button>
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="space-y-5">

        {activeTab === 'planning' && (
          <>
            <ProjectInfoSection project={project} files={files} profile={profile} />
            {['SAMPLING', 'CLOSED'].includes(projectStatus) && (
              <QuoteSection project={project} role="planning" />
            )}
            <DeadlineSection project={project} role="planning" />
            <PMReviewSection project={project} schedules={schedules} profile={profile} pms={pms} files={files} />
          </>
        )}

        {activeTab === 'design' && (
          <>
            {['DESIGN', 'SAMPLING', 'CLOSED'].includes(projectStatus) ? (
              <>
                <DesignSection project={project} files={files} profile={profile} designers={designers} designRejectCount={designRejectCount} />
                {['SAMPLING', 'CLOSED'].includes(projectStatus) && (
                  <SamplingPreviewForDesign project={project} schedules={schedules} />
                )}
              </>
            ) : (
              <EmptyState
                icon="🎨"
                title="아직 디자인 단계가 아닙니다"
                desc="신규기획팀에서 상품기획 검토를 완료하면 디자인 작업이 시작됩니다"
              />
            )}
          </>
        )}

        {activeTab === 'production' && (
          <>
            <DeadlineSection project={project} role="production" />
            {['SAMPLING', 'CLOSED'].includes(projectStatus) ? (
              <>
                <SamplingSection project={project} schedules={schedules} profile={profile} />
                <QuoteSection project={project} role="production" />
              </>
            ) : (
              <EmptyState
                icon="📦"
                title="아직 샘플/양산 단계가 아닙니다"
                desc="디자인팀에서 작지서 완료 후 샘플 제작이 시작됩니다"
              />
            )}
          </>
        )}
      </div>

      {/* ── 필수 확인사항 모달 ── */}
      {showMemo && (
        <MemoModal
          projectId={project.id}
          profileName={profile?.name ?? '알 수 없음'}
          onCountChange={setMemoCount}
          onClose={() => setShowMemo(false)}
        />
      )}
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">{desc}</p>
    </div>
  )
}
