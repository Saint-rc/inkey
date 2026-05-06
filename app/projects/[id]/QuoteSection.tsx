'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── 단계 정의 ──────────────────────────────────────────────
type QuoteStep = 'QUOTE_WAIT' | 'QUOTE_REQUESTED' | 'QUOTE_CONFIRMED' | 'QUOTE_FINAL'

const STEPS: {
  key: QuoteStep
  label: string
  desc: string
  color: string
  activeColor: string
}[] = [
  {
    key: 'QUOTE_WAIT',
    label: '견적요청대기중',
    desc: '작지서 전달 완료, 견적 요청 전',
    color: 'border-gray-200 bg-gray-50 text-gray-500',
    activeColor: 'border-gray-400 bg-gray-100 text-gray-700',
  },
  {
    key: 'QUOTE_REQUESTED',
    label: '견적요청',
    desc: '공장에 견적 요청됨',
    color: 'border-blue-200 bg-blue-50 text-blue-600',
    activeColor: 'border-blue-500 bg-blue-100 text-blue-700',
  },
  {
    key: 'QUOTE_CONFIRMED',
    label: '견적확인완료',
    desc: '상품기획팀 견적 확인',
    color: 'border-green-200 bg-green-50 text-green-600',
    activeColor: 'border-green-500 bg-green-100 text-green-700',
  },
  {
    key: 'QUOTE_FINAL',
    label: '최종견적완료',
    desc: '최종 견적 확정',
    color: 'border-purple-200 bg-purple-50 text-purple-600',
    activeColor: 'border-purple-500 bg-purple-100 text-purple-700',
  },
]

const STEP_LABEL: Record<string, string> = {
  QUOTE_WAIT:      '견적요청대기중',
  QUOTE_REQUESTED: '견적요청',
  QUOTE_CONFIRMED: '견적확인완료',
  QUOTE_FINAL:     '최종견적완료',
}

const STEP_ORDER: QuoteStep[] = ['QUOTE_WAIT', 'QUOTE_REQUESTED', 'QUOTE_CONFIRMED', 'QUOTE_FINAL']

// ── 유틸 ──────────────────────────────────────────────────
type HistoryEntry = {
  id: number
  from_step: string | null
  to_step: string
  note: string | null
  created_by_name: string | null
  created_at: string
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 히스토리 모달 ──────────────────────────────────────────
function HistoryModal({ history, onClose }: { history: HistoryEntry[]; onClose: () => void }) {
  const sorted = [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-gray-800">견적 히스토리</h3>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{history.length}건</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xs"
          >✕</button>
        </div>

        <div className="px-5 py-4 max-h-96 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">기록이 없습니다</p>
          ) : (
            <div className="space-y-4">
              {sorted.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-blue-400" />
                    {i < sorted.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
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
                      <span className="text-xs rounded-full px-2 py-0.5 font-semibold bg-blue-50 text-blue-700">
                        {STEP_LABEL[entry.to_step] ?? entry.to_step}
                      </span>
                    </div>
                    {entry.note && (
                      <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                        {entry.note}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {entry.created_by_name ?? '알 수 없음'} · {fmtTime(entry.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function QuoteSection({
  project,
  role,
}: {
  project: any
  role: 'planning' | 'production'
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const currentStep = (project.quote_step as QuoteStep) ?? 'QUOTE_WAIT'
  const currentIdx = STEP_ORDER.indexOf(currentStep)
  const quoteRound: number = project.quote_round ?? 1

  // 최종 견적 표시값: quote_final_text 우선, 없으면 quote_amount
  const finalDisplayText: string =
    project.quote_final_text ||
    (project.quote_amount ? `${Number(project.quote_amount).toLocaleString()}원` : '')

  const [quoteInput, setQuoteInput] = useState(
    project.quote_final_text || (project.quote_amount ? String(project.quote_amount) : '')
  )

  const roundLabel = (round: number) => round === 1 ? '' : `${round}차 `

  const isActionable = (stepKey: QuoteStep): boolean => {
    if (role === 'planning') return stepKey === 'QUOTE_REQUESTED' || stepKey === 'QUOTE_FINAL'
    return stepKey === 'QUOTE_CONFIRMED'
  }

  const isClickable = (stepKey: QuoteStep): boolean => {
    if (!isActionable(stepKey)) return false
    return STEP_ORDER.indexOf(stepKey) === currentIdx + 1
  }

  // ── 히스토리 ────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('quote_history')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    setHistory(data ?? [])
    setHistoryLoading(false)
  }, [project.id])

  const saveHistory = async (fromStep: string | null, toStep: string, note?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user?.id ?? '')
      .single()
    await supabase.from('quote_history').insert({
      project_id:      project.id,
      from_step:       fromStep,
      to_step:         toStep,
      note:            note || null,
      created_by_name: profile?.name ?? null,
    })
  }

  const handleShowHistory = async () => {
    await loadHistory()
    setShowHistory(true)
  }

  // ── 단계 전환 ────────────────────────────────────────────
  const handleStep = async (stepKey: QuoteStep) => {
    if (!isClickable(stepKey) || loading) return
    if (stepKey === 'QUOTE_FINAL') return
    setLoading(true)
    const prev = currentStep
    await supabase.from('projects').update({ quote_step: stepKey }).eq('id', project.id)
    await saveHistory(prev, stepKey)
    router.refresh()
    setLoading(false)
  }

  const handleRevert = async () => {
    if (loading) return
    setLoading(true)
    const prev = currentStep
    await supabase.from('projects').update({ quote_step: 'QUOTE_WAIT' }).eq('id', project.id)
    await saveHistory(prev, 'QUOTE_WAIT', '견적요청 → 대기중으로 되돌림')
    router.refresh()
    setLoading(false)
  }

  // ── 최종 견적 확정 (텍스트/숫자 모두 허용) ──────────────
  const handleFinalQuote = async () => {
    if (!quoteInput.trim() || loading) return
    setLoading(true)
    const prev = currentStep
    const trimmed = quoteInput.trim()
    const numVal = parseFloat(trimmed.replace(/,/g, ''))
    const updatePayload: Record<string, unknown> = {
      quote_step: 'QUOTE_FINAL',
      quote_final_text: trimmed,
    }
    if (!isNaN(numVal)) updatePayload.quote_amount = numVal
    await supabase.from('projects').update(updatePayload).eq('id', project.id)
    await saveHistory(prev, 'QUOTE_FINAL', `${roundLabel(quoteRound)}최종 견적: ${trimmed}`)
    router.refresh()
    setLoading(false)
  }

  // ── 추가 견적 요청 (+버튼) ──────────────────────────────
  const handleAddRound = async () => {
    if (loading) return
    setLoading(true)
    const nextRound = quoteRound + 1
    await supabase.from('projects').update({
      quote_step:       'QUOTE_WAIT',
      quote_round:      nextRound,
      quote_final_text: null,
      quote_amount:     null,
    }).eq('id', project.id)
    await saveHistory('QUOTE_FINAL', 'QUOTE_WAIT', `${nextRound}차 추가 견적 요청`)
    router.refresh()
    setLoading(false)
  }

  if (!['SAMPLING', 'CLOSED'].includes(project.status)) return null

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">💰</span>
            <h2 className="text-base font-bold text-gray-900">견적 확인</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              role === 'planning' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
            }`}>
              {role === 'planning' ? '신규기획팀' : '상품기획팀'}
            </span>
            {quoteRound > 1 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                {quoteRound}차 견적
              </span>
            )}
            {currentStep === 'QUOTE_FINAL' && finalDisplayText && (
              <span className="text-sm font-bold text-purple-700">
                최종: {finalDisplayText}
              </span>
            )}
          </div>

          <button
            onClick={handleShowHistory}
            disabled={historyLoading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {historyLoading ? '...' : '히스토리'}
          </button>
        </div>

        {/* 단계 버튼 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STEPS.map((step, idx) => {
            if (step.key === 'QUOTE_FINAL') return null
            const isCurrent = currentStep === step.key
            const isDone = idx < currentIdx
            const canClick = isClickable(step.key)
            const isDisabled = !canClick && !isCurrent && !isDone

            return (
              <button
                key={step.key}
                onClick={() => handleStep(step.key)}
                disabled={!canClick || loading}
                className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  isDone
                    ? 'border-green-300 bg-green-50 text-green-600'
                    : isCurrent
                    ? step.activeColor + ' shadow-sm scale-105'
                    : canClick
                    ? step.color + ' hover:opacity-80 cursor-pointer'
                    : 'border-gray-100 bg-gray-50 text-gray-300 cursor-default opacity-60'
                }`}
                title={isDisabled
                  ? (isActionable(step.key) ? '이전 단계를 먼저 완료해주세요' : '상대팀에서 처리하는 단계입니다')
                  : step.desc}
              >
                {isDone && <span className="mr-1">✓</span>}
                {step.label}
                {isCurrent && ' ●'}
              </button>
            )
          })}
        </div>

        {/* 되돌리기 (신규기획팀, 견적요청 상태) */}
        {role === 'planning' && currentStep === 'QUOTE_REQUESTED' && (
          <div className="flex justify-end mb-2">
            <button
              onClick={handleRevert}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 border border-gray-200 hover:border-orange-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              견적요청대기중으로 되돌리기
            </button>
          </div>
        )}

        {/* 권한 안내 */}
        <p className="text-xs text-gray-400 mb-4">
          {role === 'planning'
            ? <><span className="text-blue-500 font-medium">견적요청</span> 및 <span className="text-purple-500 font-medium">최종견적완료</span>는 신규기획팀 · <span className="text-green-500 font-medium">견적확인완료</span>는 상품기획팀</>
            : <>상품기획팀: <span className="text-green-500 font-medium">견적확인완료</span>만 처리 가능</>
          }
        </p>

        {/* 견적확인완료 버튼 (상품기획팀) */}
        {role === 'production' && currentStep === 'QUOTE_REQUESTED' && (
          <button
            onClick={() => handleStep('QUOTE_CONFIRMED')}
            disabled={loading}
            className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
          >
            견적확인완료 처리
          </button>
        )}

        {/* 최종 견적 입력 (신규기획팀, 숫자·한글 모두 허용) */}
        {role === 'planning' && currentStep === 'QUOTE_CONFIRMED' && (
          <div className="mt-2 p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-purple-800">
                {roundLabel(quoteRound)}최종 견적 입력
              </span>
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">상품기획팀 확인 완료</span>
            </div>
            <p className="text-xs text-gray-500">금액(예: 1500000) 또는 텍스트(예: 완료)를 입력하세요.</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quoteInput}
                onChange={e => setQuoteInput(e.target.value)}
                placeholder="금액 또는 완료"
                className="flex-1 border border-purple-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button
                onClick={handleFinalQuote}
                disabled={!quoteInput.trim() || loading}
                className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors shrink-0"
              >
                확정
              </button>
            </div>
          </div>
        )}

        {/* 완료 상태 + 추가 견적 버튼 */}
        {currentStep === 'QUOTE_FINAL' && (
          <div className="mt-2 p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-purple-500 text-lg">✓</span>
              <div>
                <p className="text-sm font-semibold text-purple-800">
                  {roundLabel(quoteRound)}최종 견적 확정 완료
                </p>
                {finalDisplayText && (
                  <p className="text-xs text-purple-600 mt-0.5">
                    확정 내용: <strong>{finalDisplayText}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* 추가 견적 요청 버튼 (신규기획팀만) */}
            {role === 'planning' && (
              <button
                onClick={handleAddRound}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-blue-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 shrink-0"
                title={`${quoteRound + 1}차 추가 견적 요청`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                {quoteRound + 1}차 추가 견적
              </button>
            )}
          </div>
        )}
      </div>

      {showHistory && (
        <HistoryModal history={history} onClose={() => setShowHistory(false)} />
      )}
    </>
  )
}
