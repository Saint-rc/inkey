'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 디자인 단계 정의
type DesignPhase = '1차디자인' | '2차디자인' | '작지서'

const getPhase = (step: string | null, rejected: boolean): DesignPhase => {
  if (!step) return '1차디자인'
  // 작지서는 반려 여부와 무관하게 최우선
  if (['WORK_ORDER_READY', 'WORK_ORDER_SENT'].includes(step)) return '작지서'
  if (['DESIGN_2ND_WORK', 'DESIGN_2ND_REVIEW'].includes(step) || rejected) return '2차디자인'
  if (['DESIGN_1ST_WORK', 'DESIGN_1ST_REVIEW'].includes(step)) return '1차디자인'
  return '1차디자인'
}

type SubStatus = '디자인중' | '검수중' | '검수반려' | '완료' | '작지서작성중' | '작지서완료'

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

// 단계별 버튼 정의
const DESIGN_BUTTONS: { key: SubStatus; label: string; color: string }[] = [
  { key: '디자인중', label: '디자인중', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '검수중', label: '검수중', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { key: '검수반려', label: '검수반려', color: 'bg-red-100 text-red-700 border-red-300' },
  { key: '완료', label: '완료', color: 'bg-green-100 text-green-700 border-green-300' },
]

const WORK_ORDER_BUTTONS: { key: SubStatus; label: string; color: string }[] = [
  { key: '작지서작성중', label: '작지서 작성중', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '작지서완료', label: '완료', color: 'bg-green-100 text-green-700 border-green-300' },
]

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

  const isDesignLeader = profile?.role === 'DESIGN_LEADER'
  const isDesigner = (profile?.role === 'DESIGNER' || profile?.role === 'DESIGN_LEADER') && project.designer_id === profile?.id
  const canAct = isDesignLeader || isDesigner

  const phase = getPhase(project.design_step, project.design_rejected)
  const subStatus = getSubStatus(project.design_step)

  const handleAssignDesigner = async () => {
    if (!selectedDesigner) return
    setLoading(true)
    await supabase.from('projects').update({
      designer_id: selectedDesigner,
      design_step: 'DESIGN_1ST_WORK',
      design_rejected: false,
    }).eq('id', project.id)
    router.refresh()
    setLoading(false)
  }

  const handleStatusClick = async (status: SubStatus) => {
    if (!canAct || loading) return
    setLoading(true)

    if (phase === '1차디자인' || phase === '2차디자인') {
      const isFirst = phase === '1차디자인'

      if (status === '디자인중') {
        await supabase.from('projects').update({
          design_step: isFirst ? 'DESIGN_1ST_WORK' : 'DESIGN_2ND_WORK',
        }).eq('id', project.id)
      } else if (status === '검수중') {
        await supabase.from('projects').update({
          design_step: isFirst ? 'DESIGN_1ST_REVIEW' : 'DESIGN_2ND_REVIEW',
          design_expected_date: expectedDate || null,
        }).eq('id', project.id)
      } else if (status === '검수반려') {
        // 반려 → 2차 디자인으로
        await supabase.from('projects').update({
          design_step: 'DESIGN_2ND_WORK',
          design_rejected: true,
          design_expected_date: null,
        }).eq('id', project.id)
      } else if (status === '완료') {
        // 완료 → 작지서로 (반려 플래그 초기화)
        await supabase.from('projects').update({
          design_step: 'WORK_ORDER_READY',
          design_rejected: false,
          design_expected_date: expectedDate || null,
        }).eq('id', project.id)
      }
    } else if (phase === '작지서') {
      if (status === '작지서작성중') {
        await supabase.from('projects').update({
          design_step: 'WORK_ORDER_READY',
        }).eq('id', project.id)
      } else if (status === '작지서완료') {
        // 완료 → 샘플링(PM)으로 전달
        await supabase.from('projects').update({
          design_step: 'WORK_ORDER_SENT',
          design_expected_date: expectedDate || null,
          status: 'SAMPLING',
          sample_step: 'SAMPLE_REQUESTED',
        }).eq('id', project.id)
      }
    }

    router.refresh()
    setLoading(false)
  }

  const saveDate = async () => {
    if (!expectedDate) return
    await supabase.from('projects').update({
      design_expected_date: expectedDate,
    }).eq('id', project.id)
    router.refresh()
  }

  const buttons = phase === '작지서' ? WORK_ORDER_BUTTONS : DESIGN_BUTTONS
  const activeStatus = phase === '작지서' ? subStatus : subStatus

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">디자인 진행</h2>
        {project.designer && (
          <span className="text-sm text-gray-500">담당: {(project.designer as any)?.name}</span>
        )}
      </div>

      {/* 디자인리더: 디자이너 배정 */}
      {isDesignLeader && !project.designer_id && (
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
                <option key={d.id} value={d.id}>
                  {d.name} {d.role === 'DESIGN_LEADER' ? '(리더)' : ''}
                </option>
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

      {/* 진행 단계 표시 */}
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
                    <span className="ml-1 text-xs opacity-75">(반려)</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* 현재 단계 이름 + 1차 되돌리기 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">
              {phase === '1차디자인' && '1차 디자인 작업'}
              {phase === '2차디자인' && '2차 디자인 작업'}
              {phase === '작지서' && '작지서 제작'}
            </div>
            {phase === '2차디자인' && canAct && (
              <button
                onClick={async () => {
                  setLoading(true)
                  await supabase.from('projects').update({
                    design_step: 'DESIGN_1ST_WORK',
                    design_rejected: false,
                    design_expected_date: null,
                  }).eq('id', project.id)
                  router.refresh()
                  setLoading(false)
                }}
                disabled={loading}
                className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2 transition-colors"
              >
                ← 1차로 되돌리기
              </button>
            )}
            {phase === '작지서' && canAct && (
              <button
                onClick={async () => {
                  setLoading(true)
                  await supabase.from('projects').update({
                    design_step: project.design_rejected ? 'DESIGN_2ND_WORK' : 'DESIGN_1ST_WORK',
                    design_expected_date: null,
                  }).eq('id', project.id)
                  router.refresh()
                  setLoading(false)
                }}
                disabled={loading}
                className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2 transition-colors"
              >
                ← 디자인으로 되돌리기
              </button>
            )}
          </div>

          {/* 상태 버튼 */}
          {canAct ? (
            <div className="flex flex-wrap gap-2">
              {buttons.map((btn) => {
                const isActive = activeStatus === btn.key
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
          ) : (
            /* 읽기 전용 상태 표시 */
            <div className="flex flex-wrap gap-2">
              {buttons.map((btn) => (
                <div
                  key={btn.key}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 ${
                    activeStatus === btn.key
                      ? btn.color
                      : 'bg-white text-gray-300 border-gray-100'
                  }`}
                >
                  {btn.label}
                </div>
              ))}
            </div>
          )}

          {/* 예상 완료일 */}
          {canAct && phase !== '작지서' && (
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
          )}

          {canAct && phase === '작지서' && (
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
          )}

          {/* 저장된 예상 완료일 표시 */}
          {project.design_expected_date && (
            <p className="text-xs text-gray-400">
              예상 완료일: {new Date(project.design_expected_date).toLocaleDateString('ko-KR')}
            </p>
          )}

          {/* 작지서 완료 → PM 전달 안내 */}
          {phase === '작지서' && project.design_step === 'WORK_ORDER_SENT' && (
            <div className="mt-2 p-3 bg-green-50 rounded-xl border border-green-200 text-sm text-green-700 font-medium">
              ✅ 작지서가 PM팀으로 전달되었습니다
            </div>
          )}
        </div>
      )}
    </div>
  )
}
