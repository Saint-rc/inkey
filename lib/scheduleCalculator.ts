// =============================================
// 역산 일정 자동 계산 로직 (완료일 기준, 비율 압축 포함)
// =============================================

export type StageName =
  | 'DESIGN_1ST'
  | 'DESIGN_2ND'
  | 'SAMPLE_1ST'
  | 'SAMPLE_2ND'
  | 'MOLD'
  | 'MASS_PRODUCTION'
  | 'WAREHOUSING'

// 기본 소요 기간 (일) — 각 단계의 완료까지 걸리는 일수
export const LEAD_TIMES: Record<StageName, number> = {
  DESIGN_1ST:       5,
  DESIGN_2ND:       5,
  SAMPLE_1ST:       14,
  SAMPLE_2ND:       14,
  MOLD:             30,
  MASS_PRODUCTION:  40,
  WAREHOUSING:      7,   // 양산 완료 후 입고까지 소요 기간
}

// 역산 순서 (입고 → 1차 디자인)
const STAGE_ORDER: StageName[] = [
  'WAREHOUSING',
  'MASS_PRODUCTION',
  'MOLD',
  'SAMPLE_2ND',
  'SAMPLE_1ST',
  'DESIGN_2ND',
  'DESIGN_1ST',
]

// 비율 압축 대상 단계 (WAREHOUSING 제외)
const SCALABLE_STAGES: StageName[] = [
  'MASS_PRODUCTION',
  'MOLD',
  'SAMPLE_2ND',
  'SAMPLE_1ST',
  'DESIGN_2ND',
  'DESIGN_1ST',
]

export const STAGE_LABELS: Record<StageName, string> = {
  DESIGN_1ST:       '1차 디자인',
  DESIGN_2ND:       '2차 디자인',
  SAMPLE_1ST:       '1차 샘플',
  SAMPLE_2ND:       '2차 샘플',
  MOLD:             '금형 제작',
  MASS_PRODUCTION:  '양산',
  WAREHOUSING:      '입고',
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

export type ScheduleResult = {
  stage_name: StageName
  auto_estimated_date: string  // 각 단계 완료 예정일
  is_tight: boolean
  effective_days: number       // 실제 적용 소요 기간
}

export type CalculateResult = {
  schedules: ScheduleResult[]
  isValid: boolean
  isTight: boolean
  isScaled: boolean
  designStartDate: string
  totalDays: number
  totalLeadTime: number
  scaledLeadTimes: Record<StageName, number>
}

export function calculateSchedule(
  targetDeliveryDate: string,
  startDate: string
): CalculateResult {
  const target = new Date(targetDeliveryDate)
  const start  = new Date(startDate)

  const totalDays = Math.floor(
    (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )

  // 압축 대상 기간 합계 (WAREHOUSING 제외)
  const totalLeadTime = SCALABLE_STAGES.reduce((a, s) => a + LEAD_TIMES[s], 0)

  const isScaled = totalDays < totalLeadTime

  // 비율 압축
  let scaledLeadTimes: Record<StageName, number>

  if (isScaled && totalDays > 0) {
    const ratio = totalDays / totalLeadTime
    let allocated = 0
    scaledLeadTimes = { ...LEAD_TIMES }

    SCALABLE_STAGES.forEach((stage, i) => {
      if (i === SCALABLE_STAGES.length - 1) {
        scaledLeadTimes[stage] = Math.max(1, totalDays - allocated)
      } else {
        const scaled = Math.max(1, Math.round(LEAD_TIMES[stage] * ratio))
        scaledLeadTimes[stage] = scaled
        allocated += scaled
      }
    })
  } else {
    scaledLeadTimes = { ...LEAD_TIMES }
  }

  // 역산: 각 단계 완료일 계산
  const dates: Record<StageName, Date> = {} as Record<StageName, Date>

  // WAREHOUSING 완료 = 목표 입고일
  dates['WAREHOUSING'] = new Date(target)

  // 나머지 단계: 이전 단계 완료일 - 소요기간
  const remainingStages: StageName[] = [
    'MASS_PRODUCTION',
    'MOLD',
    'SAMPLE_2ND',
    'SAMPLE_1ST',
    'DESIGN_2ND',
    'DESIGN_1ST',
  ]
  for (const stage of remainingStages) {
    const prevStageIdx = STAGE_ORDER.indexOf(stage) - 1
    const prevStage = STAGE_ORDER[prevStageIdx]
    dates[stage] = subtractDays(dates[prevStage], scaledLeadTimes[prevStage])
  }

  const designStartDate = dates['DESIGN_1ST']
  const isValid = designStartDate >= start
  const isTight = isScaled || !isValid

  const schedules: ScheduleResult[] = STAGE_ORDER.map((stage) => ({
    stage_name:          stage,
    auto_estimated_date: toDateString(dates[stage]),
    is_tight:            isTight,
    effective_days:      scaledLeadTimes[stage],
  }))

  return {
    schedules,
    isValid,
    isTight,
    isScaled,
    designStartDate: toDateString(designStartDate),
    totalDays,
    totalLeadTime,
    scaledLeadTimes,
  }
}
