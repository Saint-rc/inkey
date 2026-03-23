'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SamplePhase = '1차샘플' | '2차샘플' | '양산·운송'

const getPhase = (step: string | null): SamplePhase => {
  if (!step) return '1차샘플'
  if (['SAMPLE_REQUESTED', 'SAMPLE_ARRIVED', 'SAMPLE_1ST_REJECTED'].includes(step)) return '1차샘플'
  if (['SAMPLE_2ND_PRODUCTION', 'SAMPLE_2ND_REVIEW', 'SAMPLE_2ND_REJECTED'].includes(step)) return '2차샘플'
  return '양산·운송'
}

// 각 단계의 버튼 정의 (key = sample_step 값, transition 있으면 해당 step으로 이동)
type StepBtn = {
  key: string
  label: string
  color: string
  transitionTo?: string  // 클릭 시 이 step으로 전환 (phase 이동)
  closeProject?: boolean
}

const STEP_BUTTONS: Record<SamplePhase, StepBtn[]> = {
  '1차샘플': [
    { key: 'SAMPLE_REQUESTED',   label: '샘플제작중', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { key: 'SAMPLE_ARRIVED',     label: '검수중',     color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { key: 'MASS_PRODUCTION_START', label: '검수완료', color: 'bg-green-100 text-green-700 border-green-300', transitionTo: 'MASS_PRODUCTION_START' },
    { key: 'SAMPLE_2ND_PRODUCTION', label: '검수반려', color: 'bg-red-100 text-red-700 border-red-300', transitionTo: 'SAMPLE_2ND_PRODUCTION' },
  ],
  '2차샘플': [
    { key: 'SAMPLE_2ND_PRODUCTION', label: '샘플제작중', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { key: 'SAMPLE_2ND_REVIEW',     label: '검수중',     color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { key: 'MASS_PRODUCTION_START', label: '검수완료', color: 'bg-green-100 text-green-700 border-green-300', transitionTo: 'MASS_PRODUCTION_START' },
    { key: 'SAMPLE_2ND_REJECTED',   label: '검수반려(재제작)', color: 'bg-red-100 text-red-700 border-red-300', transitionTo: 'SAMPLE_2ND_PRODUCTION' },
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

function formatDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

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

  const isPM = profile?.role === 'PM'
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

  const handleStepClick = async (btn: StepBtn) => {
    if (!isPM || loading) return
    setLoading(true)

    if (btn.closeProject) {
      await supabase.from('projects').update({
        status: 'CLOSED',
        sample_step: btn.key,
      }).eq('id', project.id)
    } else {
      await supabase.from('projects').update({
        sample_step: btn.transitionTo ?? btn.key,
      }).eq('id', project.id)
    }

    router.refresh()
    setLoading(false)
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
    router.refresh()
    setLoading(false)
  }

  const phases: SamplePhase[] = ['1차샘플', '2차샘플', '양산·운송']
  const currentFields = PHASE_DATE_FIELDS[phase]
  const buttons = STEP_BUTTONS[phase]

  // 현재 활성 버튼 결정
  const activeKey = (() => {
    const step = project.sample_step
    // 검수반려 상태 표시
    if (step === 'SAMPLE_1ST_REJECTED') return 'SAMPLE_2ND_PRODUCTION' // 1차반려
    if (step === 'SAMPLE_2ND_REJECTED') return 'SAMPLE_2ND_REJECTED'
    return step
  })()

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5">샘플 제작 및 양산</h2>

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
          {isPM ? (
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
          ) : (
            <div className="flex flex-wrap gap-2">
              {buttons.map((btn) => (
                <div
                  key={btn.key + btn.label}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 ${
                    activeKey === btn.key ? btn.color : 'bg-white text-gray-300 border-gray-100'
                  }`}
                >
                  {btn.label}
                </div>
              ))}
            </div>
          )}

          {/* 안내 메시지 (검수완료/반려는 자동 전환) */}
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
