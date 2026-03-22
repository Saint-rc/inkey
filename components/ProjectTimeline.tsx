'use client'

type Stage = {
  key: string
  label: string
  status: 'done' | 'active' | 'pending'
  date?: string
}

const STAGES = [
  { key: 'INITIATED', label: '프로젝트\n발의' },
  { key: 'PM_REVIEW', label: 'PM\n일정검토' },
  { key: 'DESIGN', label: '디자인\n진행' },
  { key: 'SAMPLING', label: '샘플/양산\n진행' },
  { key: 'CLOSED', label: '입고\n완료' },
]

const STATUS_ORDER = ['INITIATED', 'PM_REVIEW', 'DESIGN', 'SAMPLING', 'CLOSED']

export default function ProjectTimeline({
  currentStatus,
  schedules = [],
}: {
  currentStatus: string
  schedules?: { stage_name: string; pm_adjusted_date?: string; auto_estimated_date: string }[]
}) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus)

  const stages: Stage[] = STAGES.map((s, i) => ({
    ...s,
    status: i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending',
  }))

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center flex-1">
            {/* 노드 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  stage.status === 'done'
                    ? 'bg-blue-600 text-white'
                    : stage.status === 'active'
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {stage.status === 'done' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <div
                className={`mt-1.5 text-center text-xs leading-tight whitespace-pre-line ${
                  stage.status === 'active' ? 'text-blue-600 font-semibold' : 'text-gray-400'
                }`}
              >
                {stage.label}
              </div>
            </div>

            {/* 연결선 */}
            {i < stages.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-5 ${
                  i < currentIdx ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
