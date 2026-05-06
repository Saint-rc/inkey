'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAGE_LABELS, LEAD_TIMES, type StageName } from '@/lib/scheduleCalculator'
import { fmtDateFull } from '@/lib/formatDate'

const STAGE_ORDER: StageName[] = [
  'DESIGN_1ST',
  'DESIGN_2ND',
  'SAMPLE_1ST',
  'SAMPLE_2ND',
  'MOLD',
  'MASS_PRODUCTION',
  'WAREHOUSING',
]

// 수량 옵션 (1000 단위, 최대 50,000)
const QUANTITY_OPTIONS = Array.from({ length: 50 }, (_, i) => (i + 1) * 1000)

type QuoteRow = {
  quantity: number
  unit_price: string
}

function parseQuotes(raw: string | null): QuoteRow[] {
  if (!raw) return [{ quantity: 1000, unit_price: '' }]
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [{ quantity: 1000, unit_price: '' }]
}

export default function PMReviewSection({
  project,
  schedules,
  profile,
  pms,
  files,
}: {
  project: any
  schedules: any[]
  profile: any
  pms: any[]
  files?: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [quotes, setQuotes] = useState<QuoteRow[]>(parseQuotes(project.estimated_cost))
  const [pmNotes, setPmNotes] = useState(project.pm_notes ?? '')
  const [hiddenStages, setHiddenStages] = useState<string[]>([])

  const [stageDates, setStageDates] = useState<Record<string, string>>(
    Object.fromEntries(
      STAGE_ORDER.map((stage) => {
        const s = schedules.find((sc) => sc.stage_name === stage)
        return [stage, s?.pm_adjusted_date ?? s?.auto_estimated_date ?? '']
      })
    )
  )

  const isPMLeader = profile?.role === 'PM_LEADER'
  const isPM = profile?.role === 'PM' || isPMLeader
  const isEditable = (project.status === 'INITIATED' || project.status === 'PM_REVIEW') && !!project.pm_id
  const [assigningPM, setAssigningPM] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  const handleAssignPM = async () => {
    if (!assigningPM || assignLoading) return
    setAssignLoading(true)
    await supabase.from('projects').update({ pm_id: assigningPM }).eq('id', project.id)
    router.refresh()
    setAssignLoading(false)
  }

  const handleDateChange = (stage: string, value: string) => {
    setStageDates((prev) => ({ ...prev, [stage]: value }))
  }

  const handleQuoteChange = (index: number, field: keyof QuoteRow, value: string | number) => {
    setQuotes((prev) => prev.map((q, i) => i === index ? { ...q, [field]: value } : q))
  }

  const addQuoteRow = () => {
    setQuotes((prev) => [...prev, { quantity: 1000, unit_price: '' }])
  }

  const removeQuoteRow = (index: number) => {
    if (quotes.length === 1) return
    setQuotes((prev) => prev.filter((_, i) => i !== index))
  }

  const hideStage = (stage: string) => {
    setHiddenStages((prev) => [...prev, stage])
  }

  const handleSubmit = async () => {
    setLoading(true)

    await supabase.from('projects').update({
      status: 'DESIGN',
      pm_id: profile.id,
      estimated_cost: JSON.stringify(quotes),
      pm_notes: pmNotes,
    }).eq('id', project.id)

    for (const [stage, date] of Object.entries(stageDates)) {
      if (!date) continue
      if (hiddenStages.includes(stage)) continue
      const existing = schedules.find((s) => s.stage_name === stage)
      if (existing) {
        await supabase.from('project_schedules').update({ pm_adjusted_date: date }).eq('id', existing.id)
      } else {
        await supabase.from('project_schedules').insert({
          project_id: project.id,
          stage_name: stage,
          auto_estimated_date: date,
          pm_adjusted_date: date,
        })
      }
    }

    router.refresh()
    setLoading(false)
  }

  const getScheduleStatus = (stage: StageName) => {
    const s = schedules.find((sc) => sc.stage_name === stage)
    if (!s) return null
    return { auto: s.auto_estimated_date, adjusted: s.pm_adjusted_date, isDelayed: s.is_delayed }
  }

  // 저장된 견적 읽기용 파싱
  const savedQuotes = parseQuotes(project.estimated_cost)

  // 레퍼런스 이미지 (project_files에서 REFERENCE 타입)
  const refImages = (files ?? []).filter((f: any) => f.file_type === 'REFERENCE')

  // 뷰 모드에서 표시할 단계: 실제 스케줄 데이터가 있는 것만
  const visibleStagesView = STAGE_ORDER.filter((stage) => getScheduleStatus(stage) !== null)
  // 편집 모드에서 표시할 단계: 숨김 처리 안 된 것
  const visibleStagesEdit = STAGE_ORDER.filter((stage) => !hiddenStages.includes(stage))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">상품기획 검토 및 일정</h2>
        {project.pm && (
          <span className="text-sm text-gray-500">담당: {(project.pm as any)?.name}</span>
        )}
      </div>

      {/* 상품기획 담당자 배정 (PM_LEADER만) */}
      {!project.pm_id && isPMLeader && pms.length > 0 && (
        <div className="mb-5 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-sm font-medium text-yellow-800 mb-3">상품기획 담당자를 배정해주세요</p>
          <div className="flex gap-3">
            <select
              value={assigningPM}
              onChange={(e) => setAssigningPM(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">담당자 선택</option>
              {pms.map((pm: any) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
            <button
              onClick={handleAssignPM}
              disabled={!assigningPM || assignLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {assignLoading ? '배정중...' : '배정'}
            </button>
          </div>
        </div>
      )}

      {!project.pm_id && !isPMLeader && (
        <p className="text-sm text-gray-400 py-4 text-center">상품기획 리더가 담당자를 배정하면 표시됩니다</p>
      )}

      {!isEditable && project.pm_id && !schedules.length && (
        <p className="text-sm text-gray-400 py-4 text-center">담당자가 일정을 검토하면 표시됩니다</p>
      )}

      {/* 일정 타이트 경고 */}
      {schedules.some((s) => s.is_delayed) && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-red-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">일정이 매우 빠듯하게 설정되었습니다</p>
            <p className="text-xs text-red-500 mt-0.5">PM이 설정한 목표 입고일 기준으로 일부 단계 일정이 시작일보다 앞섭니다. 상품기획 조정일을 수정해주세요.</p>
          </div>
        </div>
      )}

      {/* 레퍼런스 이미지 */}
      {refImages.length > 0 && (
        <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-2">레퍼런스 이미지</p>
          <div className="flex gap-2 flex-wrap">
            {refImages.map((file: any) => (
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

      {(isEditable || schedules.length > 0) && (
        <div className="space-y-6">

          {/* ── 견적 입력 ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">예상 견적</label>

            {isEditable ? (
              <div className="space-y-2.5">
                {quotes.map((q, i) => {
                  const total = q.unit_price ? Math.round(q.quantity * Number(q.unit_price)) : null
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                        <select
                          value={q.quantity}
                          onChange={(e) => handleQuoteChange(i, 'quantity', Number(e.target.value))}
                          className="px-3 py-2.5 text-sm bg-gray-50 border-r border-gray-300 focus:outline-none"
                        >
                          {QUANTITY_OPTIONS.map((qty) => (
                            <option key={qty} value={qty}>
                              {qty.toLocaleString()}개
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center px-3 gap-1">
                          <span className="text-xs text-gray-400">개당</span>
                          <input
                            type="number"
                            value={q.unit_price}
                            onChange={(e) => handleQuoteChange(i, 'unit_price', e.target.value)}
                            placeholder="0"
                            className="w-24 text-sm text-right focus:outline-none bg-transparent"
                          />
                          <span className="text-xs text-gray-400">원</span>
                        </div>
                      </div>

                      <div className="flex-1 text-sm font-semibold text-gray-700 text-right pr-2">
                        {total !== null ? (
                          <span className="text-blue-600">= {total.toLocaleString()}원</span>
                        ) : (
                          <span className="text-gray-300">= -</span>
                        )}
                      </div>

                      <button
                        onClick={() => removeQuoteRow(i)}
                        disabled={quotes.length === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-20 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}

                <button
                  onClick={addQuoteRow}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
                >
                  <span className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs leading-none">+</span>
                  수량 추가
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedQuotes.map((q, i) => {
                  const total = q.unit_price ? Math.round(q.quantity * Number(q.unit_price)) : null
                  return (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-600">
                        <span className="font-medium text-gray-900">{q.quantity.toLocaleString()}개</span>
                        {q.unit_price && (
                          <span className="text-gray-400 ml-2">개당 {Number(q.unit_price).toLocaleString()}원</span>
                        )}
                      </span>
                      {total !== null && (
                        <span className="font-semibold text-blue-600">{total.toLocaleString()}원</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 세부 일정 ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">세부 일정</label>
              {isEditable && (
                <span className="text-xs text-gray-400">자동 역산된 날짜 · ✕ 버튼으로 불필요한 단계 제거 가능</span>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">단계</th>
                    <th className="text-left px-4 py-2.5 font-medium">소요기간</th>
                    <th className="text-left px-4 py-2.5 font-medium">자동 계산일</th>
                    <th className="text-left px-4 py-2.5 font-medium">
                      {isEditable ? '상품기획 조정일' : '확정일'}
                    </th>
                    {isEditable && <th className="px-2 py-2.5 w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(isEditable ? visibleStagesEdit : visibleStagesView).map((stage) => {
                    const status = getScheduleStatus(stage)
                    const isDelayed = status?.isDelayed

                    // 소요기간 계산
                    const stageIdx = STAGE_ORDER.indexOf(stage)
                    const prevStage = stageIdx > 0 ? STAGE_ORDER[stageIdx - 1] : null
                    let soyo: React.ReactNode = LEAD_TIMES[stage] > 0 ? `${LEAD_TIMES[stage]}일` : '-'
                    if (prevStage && isEditable) {
                      const curSc = schedules.find(s => s.stage_name === stage)
                      const prevSc = schedules.find(s => s.stage_name === prevStage)
                      const curDate = curSc?.pm_adjusted_date ?? curSc?.auto_estimated_date
                      const prevDate = prevSc?.pm_adjusted_date ?? prevSc?.auto_estimated_date
                      if (curDate && prevDate) {
                        const diff = Math.abs(Math.round((new Date(prevDate).getTime() - new Date(curDate).getTime()) / (1000 * 60 * 60 * 24)))
                        const standard = LEAD_TIMES[stage]
                        soyo = (
                          <span>
                            {diff}일
                            {diff !== standard && (
                              <span className="ml-1 text-orange-400 text-xs">(기본 {standard}일)</span>
                            )}
                          </span>
                        )
                      }
                    }

                    return (
                      <tr key={stage} className={isDelayed ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2.5 font-medium text-gray-700">
                          {STAGE_LABELS[stage]}
                          {isDelayed && <span className="ml-1 text-xs text-red-500">⚠️</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{soyo}</td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {status?.auto ? fmtDateFull(status.auto) : '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          {isEditable ? (
                            <input
                              type="date"
                              value={stageDates[stage] ?? ''}
                              onChange={(e) => handleDateChange(stage, e.target.value)}
                              className={`border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDelayed ? 'border-red-300 bg-red-50' : 'border-gray-300'
                              }`}
                            />
                          ) : (
                            <span className={`font-medium ${isDelayed ? 'text-red-600' : 'text-gray-800'}`}>
                              {status?.adjusted
                                ? fmtDateFull(status.adjusted)
                                : status?.auto
                                ? fmtDateFull(status.auto)
                                : '-'}
                            </span>
                          )}
                        </td>
                        {isEditable && (
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => hideStage(stage)}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors text-xs"
                              title={`${STAGE_LABELS[stage]} 단계 제거`}
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 제거된 단계 복구 */}
            {isEditable && hiddenStages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hiddenStages.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setHiddenStages((prev) => prev.filter((s) => s !== stage))}
                    className="text-xs text-gray-400 hover:text-blue-500 border border-gray-200 hover:border-blue-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    + {STAGE_LABELS[stage as StageName]} 복구
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 상품기획담당자 메모 ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">상품기획담당자 메모</label>
            {isEditable ? (
              <textarea
                value={pmNotes}
                onChange={(e) => setPmNotes(e.target.value)}
                rows={3}
                placeholder="일정 관련 특이사항, 공장 정보 등"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-600">{project.pm_notes ?? '-'}</p>
            )}
          </div>

          {isEditable && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {loading ? '저장 중...' : '일정 확정 → 디자인팀으로 전달'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
