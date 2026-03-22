'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STAGE_LABELS: Record<string, string> = {
  DESIGN_1ST: '1차 디자인',
  DESIGN_2ND: '2차 디자인',
  SAMPLE_1ST: '1차 샘플',
  SAMPLE_2ND: '2차 샘플',
  MASS_PRODUCTION: '양산',
  SHIPPING: '운송',
  WAREHOUSING: '입고',
}

const STAGES = Object.keys(STAGE_LABELS)

export default function PMReviewSection({
  project,
  schedules,
  profile,
  pms,
}: {
  project: any
  schedules: any[]
  profile: any
  pms: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState(project.estimated_cost ?? '')
  const [pmNotes, setPmNotes] = useState(project.pm_notes ?? '')
  const [stageDates, setStageDates] = useState<Record<string, string>>(
    Object.fromEntries(
      schedules.map((s) => [s.stage_name, s.pm_adjusted_date ?? s.auto_estimated_date ?? ''])
    )
  )

  const isPM = profile?.role === 'PM'
  const isInitiated = project.status === 'INITIATED' || project.status === 'PM_REVIEW'

  const handleDateChange = (stage: string, value: string) => {
    setStageDates((prev) => ({ ...prev, [stage]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    const supabaseClient = createClient()

    // PM 배정 + 상태 변경
    await supabaseClient.from('projects').update({
      status: 'DESIGN',
      pm_id: profile.id,
      estimated_cost: estimatedCost,
      pm_notes: pmNotes,
    }).eq('id', project.id)

    // 일정 저장
    for (const [stage, date] of Object.entries(stageDates)) {
      if (!date) continue
      const existing = schedules.find((s) => s.stage_name === stage)
      if (existing) {
        await supabaseClient.from('project_schedules').update({
          pm_adjusted_date: date,
        }).eq('id', existing.id)
      } else {
        await supabaseClient.from('project_schedules').insert({
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

  // PM이 아니거나 이미 다음 단계면 읽기 전용으로 보여줌
  const isEditable = isPM && isInitiated

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">PM 검토 및 일정</h2>
        {project.pm && (
          <span className="text-sm text-gray-500">PM: {(project.pm as any)?.name}</span>
        )}
      </div>

      {!isEditable && !schedules.length && (
        <p className="text-sm text-gray-400 py-4 text-center">PM이 일정을 입력하면 표시됩니다</p>
      )}

      {(isEditable || schedules.length > 0) && (
        <div className="space-y-4">
          {/* 예상 견적 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">예상 견적</label>
            {isEditable ? (
              <input
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="예: ₩2,500,000 (수량 3,000개 기준)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-800">{project.estimated_cost ?? '-'}</p>
            )}
          </div>

          {/* 세부 일정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">세부 일정</label>
            <div className="space-y-2.5">
              {STAGES.map((stage) => {
                const schedule = schedules.find((s) => s.stage_name === stage)
                const isDelayed = schedule?.is_delayed
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-28 shrink-0">{STAGE_LABELS[stage]}</span>
                    {isEditable ? (
                      <input
                        type="date"
                        value={stageDates[stage] ?? ''}
                        onChange={(e) => handleDateChange(stage, e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className={`text-sm font-medium ${isDelayed ? 'text-red-500' : 'text-gray-800'}`}>
                        {schedule?.pm_adjusted_date
                          ? new Date(schedule.pm_adjusted_date).toLocaleDateString('ko-KR')
                          : schedule?.auto_estimated_date
                          ? new Date(schedule.auto_estimated_date).toLocaleDateString('ko-KR')
                          : '-'}
                        {isDelayed && <span className="ml-1 text-xs">⚠️ 지연</span>}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* PM 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">PM 메모</label>
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
