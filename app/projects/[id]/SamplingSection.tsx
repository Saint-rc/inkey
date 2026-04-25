'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SamplePhase = '1차샘플' | '2차샘플' | '양산·운송'

const getPhase = (step: string | null): SamplePhase => {
  if (!step) return '1차샘플'
  if (['SAMPLE_REQUESTED', 'SAMPLE_ARRIVED', 'SAMPLE_1ST_REJECTED'].includes(step)) return '1차샘플'
  if (['SAMPLE_2ND_PRODUCTION', 'SAMPLE_2ND_REVIEW', 'SAMPLE_2ND_REJECTED'].includes(step)) return '2차샘플'
  return '양산·운송'
}

type StepBtn = {
  key: string
  label: string
  color: string
  transitionTo?: string
  closeProject?: boolean
  isReject?: boolean
}

const STEP_BUTTONS: Record<SamplePhase, StepBtn[]> = {
  '1차샘플': [
    { key: 'SAMPLE_REQUESTED',    label: '샘플제작중', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { key: 'SAMPLE_ARRIVED',      label: '검수중',     color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { key: 'MASS_PRODUCTION_START', label: '검수완료', color: 'bg-green-100 text-green-700 border-green-300', transitionTo: 'MASS_PRODUCTION_START' },
    { key: 'SAMPLE_2ND_PRODUCTION', label: '검수반려', color: 'bg-red-100 text-red-700 border-red-300', transitionTo: 'SAMPLE_2ND_PRODUCTION', isReject: true },
  ],
  '2차샘플': [
    { key: 'SAMPLE_2ND_PRODUCTION', label: '샘플제작중',       color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { key: 'SAMPLE_2ND_REVIEW',     label: '검수중',           color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { key: 'MASS_PRODUCTION_START', label: '검수완료',         color: 'bg-green-100 text-green-700 border-green-300', transitionTo: 'MASS_PRODUCTION_START' },
    { key: 'SAMPLE_2ND_REJECTED',   label: '검수반려(재제작)', color: 'bg-red-100 text-red-700 border-red-300', transitionTo: 'SAMPLE_2ND_PRODUCTION', isReject: true },
  ],
  '양산·운송': [
    { key: 'MASS_PRODUCTION_START', label: '양산중',   color: 'bg-orange-100 text-orange-700 border-orange-300' },
    { key: 'SHIPPING_STARTED',      label: '운송중',   color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { key: 'WAREHOUSED',            label: '입고완료', color: 'bg-green-100 text-green-700 border-green-300', closeProject: true },
  ],
}

const PHASE_DATE_FIELDS: Record<SamplePhase, { stageName: string; label: string }[]> = {
  '1차샘플': [
    { stageName: 'SAMPLE_1ST', label: '1차 샘플 도착 예정일' },
  ],
  '2차샘플': [
    { stageName: 'SAMPLE_2ND', label: '2차 샘플 도착 예정일' },
  ],
  '양산·운송': [
    { stageName: 'MASS_PRODUCTION', label: '양산 완료 예정일' },
    { stageName: 'SHIPPING',        label: '운송 도착 예정일' },
    { stageName: 'WAREHOUSING',     label: '입고 예정일' },
  ],
}

const STEP_LABEL: Record<string, string> = {
  SAMPLE_REQUESTED:      '샘플제작중',
  SAMPLE_ARRIVED:        '검수중',
  SAMPLE_2ND_PRODUCTION: '2차 샘플제작중',
  SAMPLE_2ND_REVIEW:     '2차 검수중',
  MASS_PRODUCTION_START: '양산중',
  SHIPPING_STARTED:      '운송중',
  WAREHOUSED:            '입고완료',
  REJECTED:              '검수반려',
}

type HistoryEntry = {
  id: number
  from_step: string | null
  to_step: string
  note: string | null
  created_at: string
}

const fmt = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function formatDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

// ── 반려 사유 모달 ─────────────────────────────────────────
function RejectModal({
  label,
  onConfirm,
  onCancel,
}: {
  label: string
  onConfirm: (note: string) => Promise<void>
  onCancel: () => void
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-red-50">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-base">⚠️</span>
            <h3 className="text-sm font-bold text-red-700">{label}</h3>
          </div>
          <button onClick={onCancel} className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xs">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500">반려 사유를 입력해주세요. (선택사항)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="예: 사이즈 수정 필요, 색상 변경 요청..."
            className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-red-50/30"
            autoFocus
          />
        </div>
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={async () => { setLoading(true); await onConfirm(note); setLoading(false) }}
            disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? '처리중...' : '반려 확정'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 히스토리 모달 ──────────────────────────────────────────
function HistoryModal({
  history,
  onClose,
}: {
  history: HistoryEntry[]
  onClose: () => void
}) {
  const sorted = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  let rejectCount = 0
  const rejectLabels = new Map<number, number>()
  sorted.forEach((h) => {
    if (h.to_step === 'REJECTED') {
      rejectCount++
      rejectLabels.set(h.id, rejectCount)
    }
  })
  const displayList = [...sorted].reverse()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-gray-800">검수 히스토리</h3>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{history.length}건</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xs">✕</button>
        </div>

        <div className="px-5 py-4 max-h-96 overflow-y-auto">
          {displayList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">기록이 없습니다</p>
          ) : (
            <div className="space-y-4">
              {displayList.map((entry, i) => {
                const isReject = entry.to_step === 'REJECTED'
                const rejectNum = rejectLabels.get(entry.id)
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${isReject ? 'bg-red-400' : 'bg-orange-400'}`} />
                      {i < displayList.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {entry.from_step && (
                          <>
                            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                              {STEP_LABEL[entry.from_step] ?? entry.from_step}
                            </span>
                            <span className="text-gray-300 text-xs">→</span>
                          </>
                        )}
                        <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
                          isReject ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {STEP_LABEL[entry.to_step] ?? entry.to_step}
                        </span>
                        {isReject && rejectNum && (
                          <span className="text-xs bg-red-50 text-red-500 ring-1 ring-red-200 rounded-full px-2 py-0.5 font-medium">
                            {rejectNum}차 반려
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <div className="mt-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-100">
                          <span className="font-medium">사유: </span>{entry.note}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-400">{fmt(entry.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function SamplingSection({
  project,
  schedules,
  profile,
}: {
  project: any
  schedules: any[]
  profile: any
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [pendingBtn, setPendingBtn] = useState<StepBtn | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const isPM = true
  const phase = getPhase(project.sample_step)
  const phaseOrder = (['1차샘플', '2차샘플', '양산·운송'] as SamplePhase[]).indexOf(phase)

  const [dates, setDates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const fields of Object.values(PHASE_DATE_FIELDS)) {
      for (const f of fields) {
        const s = schedules.find((sc) => sc.stage_name === f.stageName)
        init[f.stageName] = s?.pm_adjusted_date ?? s?.auto_estimated_date ?? ''
      }
    }
    return init
  })

  // 히스토리 로드
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('sample_review_history')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    setHistory(data ?? [])
    setHistoryLoading(false)
  }, [project.id])

  // 히스토리 저장
  const saveHistory = async (fromStep: string | null, toStep: string, note?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('sample_review_history').insert({
      project_id: project.id,
      from_step: fromStep,
      to_step: toStep,
      note: note || null,
      created_by: user?.id ?? null,
    })
  }

  const applyStep = async (btn: StepBtn, rejectNote?: string) => {
    setLoading(true)
    const prevStep = project.sample_step
    const isReject = btn.isReject

    if (btn.closeProject) {
      await supabase.from('projects').update({
        status: 'CLOSED',
        sample_step: btn.key,
      }).eq('id', project.id)
      await saveHistory(prevStep, btn.key)
    } else {
      const nextStep = btn.transitionTo ?? btn.key
      await supabase.from('projects').update({ sample_step: nextStep }).eq('id', project.id)
      await saveHistory(prevStep, isReject ? 'REJECTED' : nextStep, isReject ? rejectNote : undefined)
    }

    router.refresh()
    setLoading(false)
  }

  const handleStepClick = (btn: StepBtn) => {
    if (!isPM || loading) return
    if (btn.isReject) {
      setPendingBtn(btn)
      setShowRejectModal(true)
      return
    }
    applyStep(btn)
  }

  const handleRejectConfirm = async (note: string) => {
    setShowRejectModal(false)
    if (!pendingBtn) return
    await applyStep(pendingBtn, note)
    setPendingBtn(null)
  }

  const handleSaveDates = async () => {
    setLoading(true)
    for (const [stageName, date] of Object.entries(dates)) {
      if (!date) continue
      const existing = schedules.find((s) => s.stage_name === stageName)
      if (existing) {
        await supabase.from('project_schedules').update({ pm_adjusted_date: date }).eq('id', existing.id)
      } else {
        await supabase.from('project_schedules').insert({
          project_id: project.id,
          stage_name: stageName,
          auto_estimated_date: date,
          pm_adjusted_date: date,
        })
      }
    }
    router.refresh()
    setLoading(false)
  }

  const handlePrev = async () => {
    if (!isPM || loading) return
    setLoading(true)
    const prevStep = phase === '2차샘플' ? 'SAMPLE_ARRIVED' : 'SAMPLE_2ND_REVIEW'
    await supabase.from('projects').update({ sample_step: prevStep }).eq('id', project.id)
    await saveHistory(project.sample_step, prevStep)
    router.refresh()
    setLoading(false)
  }

  const handleShowHistory = async () => {
    await loadHistory()
    setShowHistoryModal(true)
  }

  const phases: SamplePhase[] = ['1차샘플', '2차샘플', '양산·운송']
  const currentFields = PHASE_DATE_FIELDS[phase]
  const buttons = STEP_BUTTONS[phase]

  const activeKey = (() => {
    const step = project.sample_step
    if (step === 'SAMPLE_1ST_REJECTED') return 'SAMPLE_2ND_PRODUCTION'
    if (step === 'SAMPLE_2ND_REJECTED') return 'SAMPLE_2ND_REJECTED'
    return step
  })()

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">샘플 제작 및 양산</h2>
          <button
            onClick={handleShowHistory}
            disabled={historyLoading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-orange-50 border border-gray-200 hover:border-orange-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            검수 히스토리
          </button>
        </div>

        {project.sample_step && project.status === 'SAMPLING' && (
          <div className="space-y-5">

            {/* 단계 탭 */}
            <div className="flex gap-2">
              {phases.map((p, i) => {
                const isDone = i < phaseOrder
                const isActive = i === phaseOrder
                return (
                  <div
                    key={p}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                      isDone
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : isActive
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}
                  >
                    {isDone && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {p}
                  </div>
                )
              })}
            </div>

            {/* 현재 단계명 + 이전 단계로 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">
                {phase === '1차샘플' && '1차 샘플 진행'}
                {phase === '2차샘플' && '2차 샘플 진행'}
                {phase === '양산·운송' && '양산 및 운송'}
              </div>
              {isPM && phaseOrder > 0 && (
                <button
                  onClick={handlePrev}
                  disabled={loading}
                  className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2 transition-colors"
                >
                  ← 이전 단계로 되돌리기
                </button>
              )}
            </div>

            {/* 상태 버튼 */}
            <div className="flex flex-wrap gap-2">
              {buttons.map((btn) => {
                const isActive = activeKey === btn.key
                return (
                  <button
                    key={btn.key + btn.label}
                    onClick={() => handleStepClick(btn)}
                    disabled={loading}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50 ${
                      isActive
                        ? btn.color + ' shadow-sm scale-105'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {btn.label}
                    {isActive && ' ●'}
                  </button>
                )
              })}
            </div>

            {isPM && phase !== '양산·운송' && (
              <p className="text-xs text-gray-400">
                검수완료 클릭 시 양산 단계로, 검수반려 클릭 시 {phase === '1차샘플' ? '2차' : '2차'}샘플 제작 단계로 자동 전환됩니다
              </p>
            )}

            {/* 예상일 입력 */}
            <div className="space-y-2.5 pt-1">
              {currentFields.map((f) => {
                const saved = schedules.find((s) => s.stage_name === f.stageName)
                const savedDate = saved?.pm_adjusted_date ?? saved?.auto_estimated_date
                return (
                  <div key={f.stageName} className="flex items-center gap-3">
                    <label className="text-sm text-gray-500 shrink-0 w-40">{f.label}</label>
                    {isPM ? (
                      <>
                        <input
                          type="date"
                          value={dates[f.stageName] ?? ''}
                          onChange={(e) => setDates((prev) => ({ ...prev, [f.stageName]: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {savedDate && (
                          <span className="text-xs text-gray-400">저장됨: {formatDate(savedDate)}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm font-medium text-gray-700">
                        {savedDate ? formatDate(savedDate) : '-'}
                      </span>
                    )}
                  </div>
                )
              })}
              {isPM && (
                <button
                  onClick={handleSaveDates}
                  disabled={loading}
                  className="mt-1 text-sm text-blue-600 font-medium hover:text-blue-700 disabled:opacity-30"
                >
                  예상일 저장
                </button>
              )}
            </div>
          </div>
        )}

        {project.status === 'CLOSED' && (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-semibold text-gray-800">프로젝트 완료</p>
            <p className="text-sm text-gray-500 mt-1">입고 및 모든 과정이 종료되었습니다</p>
          </div>
        )}
      </div>

      {/* 반려 사유 모달 */}
      {showRejectModal && (
        <RejectModal
          label={pendingBtn?.label ?? '검수 반려'}
          onConfirm={handleRejectConfirm}
          onCancel={() => { setShowRejectModal(false); setPendingBtn(null) }}
        />
      )}

      {/* 히스토리 모달 */}
      {showHistoryModal && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </>
  )
}

// ── 디자인팀에서 보는 샘플 현황 (검수중·반려만 액션 가능) ──
export function SamplingPreviewForDesign({
  project,
  schedules,
}: {
  project: any
  schedules: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [pendingBtn, setPendingBtn] = useState<StepBtn | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const phase = getPhase(project.sample_step)
  const phaseOrder = (['1차샘플', '2차샘플', '양산·운송'] as SamplePhase[]).indexOf(phase)
  const phases: SamplePhase[] = ['1차샘플', '2차샘플', '양산·운송']
  const buttons = STEP_BUTTONS[phase]

  const activeKey = (() => {
    const step = project.sample_step
    if (step === 'SAMPLE_1ST_REJECTED') return 'SAMPLE_2ND_PRODUCTION'
    if (step === 'SAMPLE_2ND_REJECTED') return 'SAMPLE_2ND_REJECTED'
    return step
  })()

  // 디자인팀이 클릭 가능한 버튼: 검수중, 검수반려만
  const DESIGN_ACTIONABLE_KEYS = [
    'SAMPLE_ARRIVED',        // 1차 검수중
    'SAMPLE_2ND_REVIEW',     // 2차 검수중
    'SAMPLE_2ND_PRODUCTION', // 1차 검수반려 → 2차로
    'SAMPLE_2ND_REJECTED',   // 2차 검수반려(재제작)
  ]

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('sample_review_history')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    setHistory(data ?? [])
    setHistoryLoading(false)
  }, [project.id])

  const saveHistory = async (fromStep: string | null, toStep: string, note?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('sample_review_history').insert({
      project_id: project.id,
      from_step: fromStep,
      to_step: toStep,
      note: note || null,
      created_by: user?.id ?? null,
    })
  }

  const applyStep = async (btn: StepBtn, rejectNote?: string) => {
    setLoading(true)
    const prevStep = project.sample_step
    const isReject = btn.isReject
    const nextStep = btn.transitionTo ?? btn.key
    await supabase.from('projects').update({ sample_step: nextStep }).eq('id', project.id)
    await saveHistory(prevStep, isReject ? 'REJECTED' : nextStep, isReject ? rejectNote : undefined)
    router.refresh()
    setLoading(false)
  }

  const handleStepClick = (btn: StepBtn) => {
    if (loading) return
    if (btn.isReject) {
      setPendingBtn(btn)
      setShowRejectModal(true)
      return
    }
    applyStep(btn)
  }

  const handleRejectConfirm = async (note: string) => {
    setShowRejectModal(false)
    if (!pendingBtn) return
    await applyStep(pendingBtn, note)
    setPendingBtn(null)
  }

  // 샘플 도착 예정일 (읽기 전용)
  const currentFields = PHASE_DATE_FIELDS[phase]

  if (!['SAMPLING', 'CLOSED'].includes(project.status)) return null

  return (
    <>
      <div className="bg-white rounded-2xl border border-orange-200 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <h2 className="text-base font-bold text-gray-900">상품기획팀 — 샘플/양산 현황</h2>
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              디자인팀 검수 가능
            </span>
          </div>
          <button
            onClick={async () => { await loadHistory(); setShowHistoryModal(true) }}
            disabled={historyLoading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-orange-50 border border-gray-200 hover:border-orange-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            검수 히스토리
          </button>
        </div>

        {project.status === 'CLOSED' ? (
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-green-700">✅ 입고 완료 — 프로젝트 종료</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 단계 탭 (읽기 전용) */}
            <div className="flex gap-2">
              {phases.map((p, i) => {
                const isDone = i < phaseOrder
                const isActive = i === phaseOrder
                return (
                  <div
                    key={p}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                      isDone
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : isActive
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}
                  >
                    {isDone && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {p}
                  </div>
                )
              })}
            </div>

            {/* 상태 버튼 (검수중·반려만 클릭 가능) */}
            <div>
              <p className="text-xs text-gray-400 mb-2">
                <span className="text-orange-500 font-medium">검수중</span>·<span className="text-red-500 font-medium">검수반려</span>는 디자인팀에서 직접 변경 가능합니다
              </p>
              <div className="flex flex-wrap gap-2">
                {buttons.map((btn) => {
                  const isActive = activeKey === btn.key
                  const canAct = DESIGN_ACTIONABLE_KEYS.includes(btn.key) || (btn.isReject ?? false)
                  return canAct ? (
                    <button
                      key={btn.key + btn.label}
                      onClick={() => handleStepClick(btn)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50 ${
                        isActive
                          ? btn.color + ' shadow-sm scale-105'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {btn.label}
                      {isActive && ' ●'}
                    </button>
                  ) : (
                    <div
                      key={btn.key + btn.label}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 opacity-50 cursor-default ${
                        isActive ? btn.color : 'bg-gray-50 text-gray-300 border-gray-100'
                      }`}
                      title="상품기획팀에서 변경 가능"
                    >
                      {btn.label}
                      {isActive && ' ●'}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 예상일 (읽기 전용) */}
            {currentFields.some(f => {
              const s = schedules.find(sc => sc.stage_name === f.stageName)
              return s?.pm_adjusted_date || s?.auto_estimated_date
            }) && (
              <div className="space-y-1.5 pt-1 border-t border-gray-100">
                {currentFields.map((f) => {
                  const s = schedules.find(sc => sc.stage_name === f.stageName)
                  const date = s?.pm_adjusted_date ?? s?.auto_estimated_date
                  if (!date) return null
                  return (
                    <div key={f.stageName} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400 w-40 shrink-0">{f.label}</span>
                      <span className="font-medium text-gray-700">{formatDate(date)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showRejectModal && (
        <RejectModal
          label={pendingBtn?.label ?? '검수 반려'}
          onConfirm={handleRejectConfirm}
          onCancel={() => { setShowRejectModal(false); setPendingBtn(null) }}
        />
      )}
      {showHistoryModal && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </>
  )
}
