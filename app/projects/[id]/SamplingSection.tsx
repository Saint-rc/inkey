'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SAMPLE_STEPS = [
  { key: 'SAMPLE_REQUESTED', label: '공장 샘플 제작 의뢰' },
  { key: 'SAMPLE_ARRIVED', label: '샘플 도착' },
  { key: 'SAMPLE_1ST_REVIEW', label: '1차 샘플 검수' },
  { key: 'SAMPLE_2ND_PRODUCTION', label: '2차 샘플 제작' },
  { key: 'SAMPLE_2ND_REVIEW', label: '2차 샘플 검수' },
  { key: 'MASS_PRODUCTION_START', label: '양산 진행' },
]

const STEP_ORDER = SAMPLE_STEPS.map((s) => s.key)

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
  const [productionDates, setProductionDates] = useState({
    production_end: '',
    shipping: '',
    customs: '',
    domestic_shipping: '',
    warehousing: '',
  })

  const isPM = profile?.role === 'PM'
  const currentStepIdx = project.sample_step ? STEP_ORDER.indexOf(project.sample_step) : -1

  const handleNextStep = async () => {
    setLoading(true)
    const nextStep = STEP_ORDER[currentStepIdx + 1]

    if (nextStep === undefined) {
      // 양산 완료 → 입고/종료
      await supabase.from('projects').update({
        status: 'CLOSED',
        sample_step: null,
      }).eq('id', project.id)
    } else {
      await supabase.from('projects').update({
        sample_step: nextStep,
      }).eq('id', project.id)
    }
    router.refresh()
    setLoading(false)
  }

  const handleClosingSchedule = async () => {
    setLoading(true)

    // 양산 관련 일정 저장
    const stageMap: Record<string, string> = {
      production_end: 'MASS_PRODUCTION',
      shipping: 'SHIPPING',
      warehousing: 'WAREHOUSING',
    }

    for (const [key, stage] of Object.entries(stageMap)) {
      const date = productionDates[key as keyof typeof productionDates]
      if (!date) continue
      const existing = schedules.find((s) => s.stage_name === stage)
      if (existing) {
        await supabase.from('project_schedules').update({
          pm_adjusted_date: date,
        }).eq('id', existing.id)
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

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">샘플 제작 및 양산</h2>

      {/* 진행 단계 */}
      {project.sample_step && (
        <div className="mb-5">
          <div className="flex gap-2 flex-wrap">
            {SAMPLE_STEPS.map((step, i) => (
              <div
                key={step.key}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                  i < currentStepIdx
                    ? 'bg-green-100 text-green-700'
                    : i === currentStepIdx
                    ? 'bg-orange-100 text-orange-700 font-semibold'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < currentStepIdx && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {step.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 양산 일정 입력 (MASS_PRODUCTION_START 단계에서 PM만) */}
      {isPM && project.sample_step === 'MASS_PRODUCTION_START' && (
        <div className="mb-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
          <p className="text-sm font-medium text-orange-800 mb-3">양산 및 운송 일정 입력</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'production_end', label: '생산 완료 예정일' },
              { key: 'shipping', label: '운송 출발일' },
              { key: 'customs', label: '통관 예정일' },
              { key: 'domestic_shipping', label: '국내 운송일' },
              { key: 'warehousing', label: '창고 도착 예정일' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-600 mb-1">{label}</label>
                <input
                  type="date"
                  value={productionDates[key as keyof typeof productionDates]}
                  onChange={(e) =>
                    setProductionDates((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleClosingSchedule}
            disabled={loading}
            className="mt-3 w-full bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            일정 저장
          </button>
        </div>
      )}

      {/* 단계 진행 버튼 (PM만) */}
      {isPM && project.sample_step && project.status === 'SAMPLING' && (
        <button
          onClick={handleNextStep}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? '처리 중...' : currentStepIdx === STEP_ORDER.length - 1
            ? '입고 완료 → 프로젝트 종료'
            : `다음 단계: ${SAMPLE_STEPS[currentStepIdx + 1]?.label}`}
        </button>
      )}

      {/* 종료 상태 */}
      {project.status === 'CLOSED' && (
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🎉</div>
          <p className="font-semibold text-gray-800">프로젝트 완료</p>
          <p className="text-sm text-gray-500 mt-1">입고 및 모든 과정이 종료되었습니다</p>
        </div>
      )}
    </div>
  )
}
