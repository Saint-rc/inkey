'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── 타입 ──────────────────────────────────────────────────
type DesignPhase = '1차디자인' | '2차디자인' | '작지서'
type SubStatus = '디자인중' | '검수중' | '검수반려' | '완료' | '작지서작성중' | '작지서완료'

type HistoryEntry = {
  id: number
  from_step: string | null
  to_step: string
  note: string | null
  created_at: string
  created_by_name?: string
}

// ── 헬퍼 ──────────────────────────────────────────────────
const getPhase = (step: string | null, rejected: boolean): DesignPhase => {
  if (!step) return '1차디자인'
  if (['WORK_ORDER_READY', 'WORK_ORDER_SENT'].includes(step)) return '작지서'
  if (['DESIGN_2ND_WORK', 'DESIGN_2ND_REVIEW'].includes(step) || rejected) return '2차디자인'
  return '1차디자인'
}

const getSubStatus = (step: string | null): SubStatus => {
  switch (step) {
    case 'DESIGN_1ST_WORK':
    case 'DESIGN_2ND_WORK': return '디자인중'
    case 'DESIGN_1ST_REVIEW':
    case 'DESIGN_2ND_REVIEW': return '검수중'
    case 'WORK_ORDER_READY': return '작지서작성중'
    case 'WORK_ORDER_SENT': return '작지서완료'
    default: return '디자인중'
  }
}

const STEP_LABEL: Record<string, string> = {
  DESIGN_1ST_WORK: '1차 디자인중',
  DESIGN_1ST_REVIEW: '1차 검수중',
  DESIGN_2ND_WORK: '2차 디자인중',
  DESIGN_2ND_REVIEW: '2차 검수중',
  WORK_ORDER_READY: '작지서 작성중',
  WORK_ORDER_SENT: '작지서 완료',
  REJECTED: '검수반려',
}

const DESIGN_BUTTONS: { key: SubStatus; label: string; color: string }[] = [
  { key: '디자인중',  label: '디자인중',  color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '검수중',    label: '검수중',    color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { key: '검수반려',  label: '검수반려',  color: 'bg-red-100 text-red-700 border-red-300' },
  { key: '완료',      label: '완료',      color: 'bg-green-100 text-green-700 border-green-300' },
]

const WORK_ORDER_BUTTONS: { key: SubStatus; label: string; color: string }[] = [
  { key: '작지서작성중', label: '작지서 작성중', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '작지서완료',   label: '완료',          color: 'bg-green-100 text-green-700 border-green-300' },
]

const fmt = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ── 반려 사유 모달 ─────────────────────────────────────────
function RejectModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (note: string) => Promise<void>
  onCancel: () => void
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm(note)
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-red-50">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-base">⚠️</span>
            <h3 className="text-sm font-bold text-red-700">검수 반려</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xs"
          >
            ✕
          </button>
        </div>

        {/* 바디 */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500">반려 사유를 입력해주세요. (선택사항)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="예: 컬러 톤 수정 필요, 로고 위치 변경 요청..."
            className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-red-50/30"
            autoFocus
          />
        </div>

        {/* 푸터 */}
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={handleConfirm}
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
  // 반려 차수 계산
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
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-gray-800">검수 히스토리</h3>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {history.length}건
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xs"
          >
            ✕
          </button>
        </div>

        {/* 바디 */}
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
                    {/* 타임라인 선 */}
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                        isReject ? 'bg-red-400' : 'bg-blue-400'
                      }`} />
                      {i < displayList.length - 1 && (
                        <div className="w-px flex-1 bg-gray-100 mt-1" />
                      )}
                    </div>

                    {/* 내용 */}
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
                          isReject
                            ? 'bg-red-100 text-red-600'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {STEP_LABEL[entry.to_step] ?? entry.to_step}
                        </span>
                        {isReject && rejectNum && (
                          <span className="text-xs bg-red-50 text-red-500 ring-1 ring-red-200 rounded-full px-2 py-0.5 font-medium">
                            {rejectNum}차 반려
                          </span>
                        )}
                      </div>

                      {/* 반려 사유 */}
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
export default function DesignSection({
  project,
  files,
  profile,
  designers,
}: {
  project: any
  files: any[]
  profile: any
  designers: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [selectedDesigner, setSelectedDesigner] = useState(project.designer_id ?? '')
  const [expectedDate, setExpectedDate] = useState(project.design_expected_date ?? '')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const phase = getPhase(project.design_step, project.design_rejected)
  const subStatus = getSubStatus(project.design_step)
  const buttons = phase === '작지서' ? WORK_ORDER_BUTTONS : DESIGN_BUTTONS

  // 히스토리 로드
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('design_review_history')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    setHistory(data ?? [])
    setHistoryLoading(false)
  }, [project.id])

  // 히스토리 저장
  const saveHistory = async (fromStep: string | null, toStep: string, note?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('design_review_history').insert({
      project_id: project.id,
      from_step: fromStep,
      to_step: toStep,
      note: note || null,
      created_by: user?.id ?? null,
    })
  }

  const handleAssignDesigner = async () => {
    if (!selectedDesigner) return
    setLoading(true)
    await supabase.from('projects').update({
      designer_id: selectedDesigner,
      design_step: 'DESIGN_1ST_WORK',
      design_rejected: false,
    }).eq('id', project.id)
    await saveHistory(null, 'DESIGN_1ST_WORK')
    router.refresh()
    setLoading(false)
  }

  // 검수반려 버튼 클릭 → 모달 열기
  const handleStatusClick = async (status: SubStatus) => {
    if (loading) return
    if (status === '검수반려') {
      setShowRejectModal(true)
      return
    }
    await applyStatus(status)
  }

  const applyStatus = async (status: SubStatus, rejectNote?: string) => {
    setLoading(true)
    const prevStep = project.design_step

    if (phase === '1차디자인' || phase === '2차디자인') {
      const isFirst = phase === '1차디자인'
      if (status === '디자인중') {
        await supabase.from('projects').update({
          design_step: isFirst ? 'DESIGN_1ST_WORK' : 'DESIGN_2ND_WORK',
        }).eq('id', project.id)
        await saveHistory(prevStep, isFirst ? 'DESIGN_1ST_WORK' : 'DESIGN_2ND_WORK')
      } else if (status === '검수중') {
        await supabase.from('projects').update({
          design_step: isFirst ? 'DESIGN_1ST_REVIEW' : 'DESIGN_2ND_REVIEW',
          design_expected_date: expectedDate || null,
        }).eq('id', project.id)
        await saveHistory(prevStep, isFirst ? 'DESIGN_1ST_REVIEW' : 'DESIGN_2ND_REVIEW')
      } else if (status === '검수반려') {
        await supabase.from('projects').update({
          design_step: 'DESIGN_2ND_WORK',
          design_rejected: true,
          design_expected_date: null,
        }).eq('id', project.id)
        await saveHistory(prevStep, 'REJECTED', rejectNote)
      } else if (status === '완료') {
        await supabase.from('projects').update({
          design_step: 'WORK_ORDER_READY',
          design_rejected: false,
          design_expected_date: expectedDate || null,
        }).eq('id', project.id)
        await saveHistory(prevStep, 'WORK_ORDER_READY')
      }
    } else if (phase === '작지서') {
      if (status === '작지서작성중') {
        await supabase.from('projects').update({ design_step: 'WORK_ORDER_READY' }).eq('id', project.id)
        await saveHistory(prevStep, 'WORK_ORDER_READY')
      } else if (status === '작지서완료') {
        await supabase.from('projects').update({
          design_step: 'WORK_ORDER_SENT',
          design_expected_date: expectedDate || null,
          status: 'SAMPLING',
          sample_step: 'SAMPLE_REQUESTED',
        }).eq('id', project.id)
        await saveHistory(prevStep, 'WORK_ORDER_SENT')
      }
    }

    router.refresh()
    setLoading(false)
  }

  const handleRejectConfirm = async (note: string) => {
    setShowRejectModal(false)
    await applyStatus('검수반려', note)
  }

  const handleShowHistory = async () => {
    await loadHistory()
    setShowHistoryModal(true)
  }

  const saveDate = async () => {
    if (!expectedDate) return
    await supabase.from('projects').update({ design_expected_date: expectedDate }).eq('id', project.id)
    router.refresh()
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">디자인 진행</h2>
          <div className="flex items-center gap-3">
            {/* 히스토리 버튼 */}
            <button
              onClick={handleShowHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              검수 히스토리
            </button>
            {project.designer && (
              <span className="text-sm text-gray-500">담당: {(project.designer as any)?.name}</span>
            )}
          </div>
        </div>

        {/* 디자이너 배정 */}
        {!project.designer_id && (
          <div className="mb-5 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <p className="text-sm font-medium text-yellow-800 mb-3">디자이너를 배정해주세요</p>
            <div className="flex gap-3">
              <select
                value={selectedDesigner}
                onChange={(e) => setSelectedDesigner(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">디자이너 선택</option>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssignDesigner}
                disabled={!selectedDesigner || loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                배정
              </button>
            </div>
          </div>
        )}

        {/* 진행 단계 */}
        {project.design_step && (
          <div className="space-y-5">

            {/* 단계 탭 */}
            <div className="flex gap-2">
              {(['1차디자인', '2차디자인', '작지서'] as DesignPhase[]).map((p) => {
                const isDone =
                  (p === '1차디자인' && ['2차디자인', '작지서'].includes(phase)) ||
                  (p === '2차디자인' && phase === '작지서')
                const isActive = p === phase
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
                    {p === '2차디자인' && project.design_rejected && isActive && (
                      <span className="ml-1 opacity-75">(반려)</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 단계 이름 + 되돌리기 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">
                {phase === '1차디자인' && '1차 디자인 작업'}
                {phase === '2차디자인' && '2차 디자인 작업'}
                {phase === '작지서' && '작지서 제작'}
              </div>
              <div className="flex gap-3">
                {phase === '2차디자인' && (
                  <button
                    onClick={async () => {
                      setLoading(true)
                      await supabase.from('projects').update({
                        design_step: 'DESIGN_1ST_WORK',
                        design_rejected: false,
                        design_expected_date: null,
                      }).eq('id', project.id)
                      await saveHistory(project.design_step, 'DESIGN_1ST_WORK')
                      router.refresh()
                      setLoading(false)
                    }}
                    disabled={loading}
                    className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2"
                  >
                    ← 1차로 되돌리기
                  </button>
                )}
                {phase === '작지서' && (
                  <button
                    onClick={async () => {
                      setLoading(true)
                      const step = project.design_rejected ? 'DESIGN_2ND_WORK' : 'DESIGN_1ST_WORK'
                      await supabase.from('projects').update({
                        design_step: step,
                        design_expected_date: null,
                      }).eq('id', project.id)
                      await saveHistory(project.design_step, step)
                      router.refresh()
                      setLoading(false)
                    }}
                    disabled={loading}
                    className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2"
                  >
                    ← 디자인으로 되돌리기
                  </button>
                )}
              </div>
            </div>

            {/* 상태 버튼 */}
            <div className="flex flex-wrap gap-2">
              {buttons.map((btn) => {
                const isActive = subStatus === btn.key
                return (
                  <button
                    key={btn.key}
                    onClick={() => handleStatusClick(btn.key)}
                    disabled={loading}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50 ${
                      isActive
                        ? btn.color + ' border-opacity-100 shadow-sm scale-105'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {btn.label}
                    {isActive && ' ●'}
                  </button>
                )
              })}
            </div>

            {/* 예상 완료일 */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 shrink-0">예상 완료일</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={saveDate}
                disabled={!expectedDate}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 disabled:opacity-30"
              >
                저장
              </button>
            </div>

            {project.design_expected_date && (
              <p className="text-xs text-gray-400">
                예상 완료일: {new Date(project.design_expected_date).toLocaleDateString('ko-KR')}
              </p>
            )}

            {phase === '작지서' && project.design_step === 'WORK_ORDER_SENT' && (
              <div className="mt-2 p-3 bg-green-50 rounded-xl border border-green-200 text-sm text-green-700 font-medium">
                ✅ 작지서가 PM팀으로 전달되었습니다
              </div>
            )}
          </div>
        )}
      </div>

      {/* 반려 사유 모달 */}
      {showRejectModal && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onCancel={() => setShowRejectModal(false)}
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
