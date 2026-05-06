'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtDateFull } from '@/lib/formatDate'

type DeadlineStep = 'DEADLINE_WAIT' | 'DEADLINE_REQUESTED' | 'DEADLINE_CONFIRMED'

type DeadlineKey = 'deadline_final_sample' | 'deadline_mold' | 'deadline_order' | 'deadline_mass_production'

const DEADLINE_FIELDS: {
  key: DeadlineKey
  label: string
  color: string
  bg: string
}[] = [
  { key: 'deadline_final_sample',    label: '최종 샘플 시작 데드라인', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  { key: 'deadline_mold',            label: '금형 시작 데드라인',      color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { key: 'deadline_order',           label: '발주 데드라인',           color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { key: 'deadline_mass_production', label: '양산 데드라인',           color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
]

type HistoryEntry = {
  id: number
  from_step: string | null
  to_step: string
  note: string | null
  created_by_name: string | null
  created_at: string
}

const STEP_LABEL: Record<string, string> = {
  DEADLINE_WAIT:      '데드라인일정대기중',
  DEADLINE_REQUESTED: '데드라인요청',
  DEADLINE_CONFIRMED: '데드라인확정',
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function HistoryModal({ history, onClose }: { history: HistoryEntry[]; onClose: () => void }) {
  const sorted = [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-gray-800">데드라인 히스토리</h3>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{history.length}건</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xs">✕</button>
        </div>
        <div className="px-5 py-4 max-h-96 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">기록이 없습니다</p>
          ) : (
            <div className="space-y-4">
              {sorted.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-orange-400" />
                    {i < sorted.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                  </div>
                  <div className="pb-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {entry.from_step && (
                        <>
                          <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{STEP_LABEL[entry.from_step] ?? entry.from_step}</span>
                          <span className="text-gray-300 text-xs">→</span>
                        </>
                      )}
                      <span className="text-xs rounded-full px-2 py-0.5 font-semibold bg-orange-50 text-orange-700">{STEP_LABEL[entry.to_step] ?? entry.to_step}</span>
                    </div>
                    {entry.note && (
                      <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">{entry.note}</div>
                    )}
                    <p className="mt-1 text-xs text-gray-400">{entry.created_by_name ?? '알 수 없음'} · {fmtTime(entry.created_at)}</p>
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

export default function DeadlineSection({
  project,
  role,
}: {
  project: any
  role: 'planning' | 'production'
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const currentStep: DeadlineStep = project.deadline_step ?? 'DEADLINE_WAIT'

  // 상품기획팀 입력용
  const [inputDates, setInputDates] = useState<Record<DeadlineKey, string>>({
    deadline_final_sample:    project.deadline_final_sample    ?? '',
    deadline_mold:            project.deadline_mold            ?? '',
    deadline_order:           project.deadline_order           ?? '',
    deadline_mass_production: project.deadline_mass_production ?? '',
  })

  // 신규기획팀 수정용
  const [editing, setEditing] = useState(false)
  const [editDates, setEditDates] = useState<Record<DeadlineKey, string>>({
    deadline_final_sample:    project.deadline_final_sample    ?? '',
    deadline_mold:            project.deadline_mold            ?? '',
    deadline_order:           project.deadline_order           ?? '',
    deadline_mass_production: project.deadline_mass_production ?? '',
  })

  // 히스토리
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const saveHistory = async (fromStep: string | null, toStep: string, note?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user?.id ?? '').single()
    await supabase.from('deadline_history').insert({
      project_id: project.id, from_step: fromStep, to_step: toStep,
      note: note || null, created_by_name: profile?.name ?? null,
    })
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase.from('deadline_history').select('*').eq('project_id', project.id).order('created_at', { ascending: false })
    setHistory(data ?? [])
    setHistoryLoading(false)
  }, [project.id])

  const handleShowHistory = async () => {
    await loadHistory()
    setShowHistory(true)
  }

  // 신규기획팀: 데드라인 요청
  const handleRequest = async () => {
    if (loading) return
    setLoading(true)
    await supabase.from('projects').update({ deadline_step: 'DEADLINE_REQUESTED' }).eq('id', project.id)
    await saveHistory('DEADLINE_WAIT', 'DEADLINE_REQUESTED')
    router.refresh()
    setLoading(false)
  }

  // 상품기획팀: 날짜 입력 후 확정
  const handleConfirm = async () => {
    if (loading) return
    setLoading(true)
    const note = DEADLINE_FIELDS
      .filter(f => inputDates[f.key])
      .map(f => `${f.label}: ${inputDates[f.key]}`)
      .join(' / ')
    await supabase.from('projects').update({
      deadline_step: 'DEADLINE_CONFIRMED',
      ...inputDates,
    }).eq('id', project.id)
    await saveHistory('DEADLINE_REQUESTED', 'DEADLINE_CONFIRMED', note || undefined)
    router.refresh()
    setLoading(false)
  }

  // 신규기획팀: 확정 후 수정
  const handleSaveEdit = async () => {
    if (loading) return
    setLoading(true)
    const note = DEADLINE_FIELDS
      .filter(f => editDates[f.key])
      .map(f => `${f.label}: ${editDates[f.key]}`)
      .join(' / ')
    await supabase.from('projects').update(editDates).eq('id', project.id)
    await saveHistory('DEADLINE_CONFIRMED', 'DEADLINE_CONFIRMED', `수정: ${note}`)
    router.refresh()
    setEditing(false)
    setLoading(false)
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-base">⏰</span>
            <h2 className="text-base font-bold text-gray-900">주요 데드라인</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              role === 'planning' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
            }`}>
              {role === 'planning' ? '신규기획팀' : '상품기획팀'}
            </span>
            {/* 현재 단계 뱃지 */}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              currentStep === 'DEADLINE_WAIT'      ? 'bg-gray-100 text-gray-500' :
              currentStep === 'DEADLINE_REQUESTED' ? 'bg-amber-50 text-amber-600' :
                                                     'bg-green-50 text-green-600'
            }`}>
              {STEP_LABEL[currentStep]}
            </span>
          </div>
          <button
            onClick={handleShowHistory}
            disabled={historyLoading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 transition-colors px-2.5 py-1 rounded-lg hover:bg-orange-50 border border-gray-200 hover:border-orange-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {historyLoading ? '...' : '히스토리'}
          </button>
        </div>

        {/* ── DEADLINE_WAIT ── */}
        {currentStep === 'DEADLINE_WAIT' && (
          <>
            {role === 'planning' ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <p className="text-sm text-gray-400">상품기획팀에 데드라인 일정 입력을 요청합니다</p>
                <button
                  onClick={handleRequest}
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
                >
                  데드라인 요청
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6">
                <p className="text-sm text-gray-400">신규기획팀에서 데드라인 요청을 보내면 일정을 입력할 수 있습니다</p>
              </div>
            )}
          </>
        )}

        {/* ── DEADLINE_REQUESTED ── */}
        {currentStep === 'DEADLINE_REQUESTED' && (
          <>
            {role === 'production' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">데드라인 날짜를 입력해주세요.</p>
                <div className="grid grid-cols-2 gap-3">
                  {DEADLINE_FIELDS.map(({ key, label, color, bg }) => (
                    <div key={key} className={`rounded-xl border px-3 py-2.5 ${bg}`}>
                      <p className={`text-[10px] font-semibold mb-1.5 ${color}`}>{label}</p>
                      <input
                        type="date"
                        value={inputDates[key]}
                        onChange={e => setInputDates(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full text-sm text-gray-800 bg-transparent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
                >
                  {loading ? '저장 중...' : '데드라인 확정'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6">
                <div className="flex items-center gap-2 text-amber-600">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <p className="text-sm font-medium">상품기획팀에서 데드라인을 입력 중입니다</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DEADLINE_CONFIRMED ── */}
        {currentStep === 'DEADLINE_CONFIRMED' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium">확정된 데드라인</p>
              {role === 'planning' && !editing && (
                <button
                  onClick={() => {
                    setEditDates({
                      deadline_final_sample:    project.deadline_final_sample    ?? '',
                      deadline_mold:            project.deadline_mold            ?? '',
                      deadline_order:           project.deadline_order           ?? '',
                      deadline_mass_production: project.deadline_mass_production ?? '',
                    })
                    setEditing(true)
                  }}
                  className="text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
                >
                  수정
                </button>
              )}
              {role === 'planning' && editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={loading}
                    className="text-xs text-blue-600 font-semibold hover:text-blue-700 disabled:opacity-40"
                  >
                    {loading ? '저장중...' : '저장'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEADLINE_FIELDS.map(({ key, label, color, bg }) => (
                <div key={key} className={`rounded-xl border px-3 py-2.5 ${editing ? 'border-gray-200 bg-white' : bg}`}>
                  <p className={`text-[10px] font-semibold mb-1 ${editing ? 'text-gray-500' : color}`}>{label}</p>
                  {editing ? (
                    <input
                      type="date"
                      value={editDates[key]}
                      onChange={e => setEditDates(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full text-sm text-gray-800 focus:outline-none"
                    />
                  ) : (
                    <p className={`text-sm font-semibold ${project[key] ? color : 'text-gray-300'}`}>
                      {project[key] ? fmtDateFull(project[key]) : '미설정'}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {role === 'production' && (
              <p className="text-xs text-gray-400 mt-1">날짜 수정은 신규기획팀에서만 가능합니다</p>
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
