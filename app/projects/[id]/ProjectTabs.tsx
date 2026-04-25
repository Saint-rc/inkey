'use client'

import { useState } from 'react'
import ProjectInfoSection from './ProjectInfoSection'
import PMReviewSection from './PMReviewSection'
import DesignSection from './DesignSection'
import SamplingSection, { SamplingPreviewForDesign } from './SamplingSection'

// ── 팀별 탭 정의 ──────────────────────────────────────────
type TabKey = 'planning' | 'design' | 'production'

const STATUS_LABEL: Record<string, string> = {
  INITIATED: '발의됨',
  PM_REVIEW: '검토중',
  DESIGN: '진행중',
  SAMPLING: '진행중',
  CLOSED: '완료',
}

const getDesignStatus = (step: string | null) => {
  if (!step) return null
  const map: Record<string, string> = {
    DESIGN_1ST_WORK: '1차 디자인중',
    DESIGN_1ST_REVIEW: '1차 검수중',
    DESIGN_2ND_WORK: '2차 디자인중',
    DESIGN_2ND_REVIEW: '2차 검수중',
    WORK_ORDER_READY: '작지서 작성중',
    WORK_ORDER_SENT: '작지서 완료',
  }
  return map[step] ?? null
}

const getSampleStatus = (step: string | null) => {
  if (!step) return null
  const map: Record<string, string> = {
    SAMPLE_REQUESTED: '1차 샘플 의뢰',
    SAMPLE_ARRIVED: '1차 검수중',
    SAMPLE_2ND_PRODUCTION: '2차 샘플 제작',
    SAMPLE_2ND_REVIEW: '2차 검수중',
    MASS_PRODUCTION_START: '양산중',
    SHIPPING_STARTED: '운송중',
    WAREHOUSED: '입고완료',
  }
  return map[step] ?? null
}

export default function ProjectTabs({
  project,
  schedules,
  files,
  designers,
  pms,
  profile,
}: {
  project: any
  schedules: any[]
  files: any[]
  designers: any[]
  pms: any[]
  profile: any
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('planning')

  const projectStatus = project.status
  const designStep = project.design_step
  const sampleStep = project.sample_step

  // 탭별 상태 뱃지
  const planningStatus = STATUS_LABEL[projectStatus] ?? projectStatus
  const designStatus = getDesignStatus(designStep)
  const sampleStatus = getSampleStatus(sampleStep)

  const isPlanningActive = ['INITIATED', 'PM_REVIEW'].includes(projectStatus)
  const isDesignActive = ['DESIGN'].includes(projectStatus)
  const isProductionActive = ['SAMPLING'].includes(projectStatus)
  const isClosed = projectStatus === 'CLOSED'

  const tabs: {
    key: TabKey
    team: string
    icon: string
    desc: string
    badge: string | null
    badgeColor: string
    dotColor: string
    available: boolean
  }[] = [
    {
      key: 'planning',
      team: '신규기획팀',
      icon: '💡',
      desc: '프로젝트 발의 · 일정 검토',
      badge: planningStatus,
      badgeColor: isPlanningActive
        ? 'bg-blue-100 text-blue-700'
        : isClosed
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-500',
      dotColor: isPlanningActive ? 'bg-blue-500' : isClosed ? 'bg-green-500' : 'bg-gray-300',
      available: true,
    },
    {
      key: 'design',
      team: '디자인팀',
      icon: '🎨',
      desc: '디자인 진행 · 작지서 제작',
      badge: designStatus ?? (
        ['DESIGN', 'SAMPLING', 'CLOSED'].includes(projectStatus) ? '완료' : '대기중'
      ),
      badgeColor: isDesignActive
        ? 'bg-purple-100 text-purple-700'
        : ['SAMPLING', 'CLOSED'].includes(projectStatus)
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-400',
      dotColor: isDesignActive
        ? 'bg-purple-500'
        : ['SAMPLING', 'CLOSED'].includes(projectStatus)
        ? 'bg-green-500'
        : 'bg-gray-200',
      available: ['DESIGN', 'SAMPLING', 'CLOSED'].includes(projectStatus),
    },
    {
      key: 'production',
      team: '상품기획팀',
      icon: '📦',
      desc: '샘플 검수 · 양산 · 입고',
      badge: sampleStatus ?? (
        ['SAMPLING', 'CLOSED'].includes(projectStatus) ? (isClosed ? '입고완료' : '진행중') : '대기중'
      ),
      badgeColor: isProductionActive
        ? 'bg-orange-100 text-orange-700'
        : isClosed
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-400',
      dotColor: isProductionActive
        ? 'bg-orange-500'
        : isClosed
        ? 'bg-green-500'
        : 'bg-gray-200',
      available: ['SAMPLING', 'CLOSED'].includes(projectStatus),
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* ── 탭 헤더 ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-150 ${
                isActive
                  ? 'border-gray-800 bg-white shadow-md'
                  : tab.available
                  ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  : 'border-gray-100 bg-gray-50 cursor-default'
              }`}
            >
              {/* 활성 탭 인디케이터 */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-800 rounded-full" />
              )}

              <div className="flex items-start justify-between mb-2">
                <span className="text-xl">{tab.icon}</span>
                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tab.badgeColor}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${tab.dotColor}`} />
                  {tab.badge}
                </div>
              </div>

              <div>
                <p className={`text-sm font-bold ${isActive ? 'text-gray-900' : tab.available ? 'text-gray-700' : 'text-gray-400'}`}>
                  {tab.team}
                </p>
                <p className={`text-xs mt-0.5 ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                  {tab.desc}
                </p>
              </div>

              {/* 미진행 오버레이 */}
              {!tab.available && (
                <div className="absolute inset-0 rounded-2xl flex items-end justify-end p-3">
                  <span className="text-xs text-gray-300 font-medium">이전 단계 완료 후 활성화</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── 다른 팀 현황 미리보기 (활성 탭 제외) ── */}
      <div className="flex gap-2 mb-5">
        {tabs.filter(t => t.key !== activeTab && t.available).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors text-xs text-gray-500 hover:text-gray-700"
          >
            <span>{t.icon}</span>
            <span className="font-medium">{t.team}</span>
            <span className={`px-1.5 py-0.5 rounded-full ${t.badgeColor}`}>{t.badge}</span>
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="space-y-5">

        {/* 신규기획팀 */}
        {activeTab === 'planning' && (
          <>
            <ProjectInfoSection
              project={project}
              files={files}
              profile={profile}
            />
            <PMReviewSection
              project={project}
              schedules={schedules}
              profile={profile}
              pms={pms}
            />
          </>
        )}

        {/* 디자인팀 */}
        {activeTab === 'design' && (
          <>
            {['DESIGN', 'SAMPLING', 'CLOSED'].includes(projectStatus) ? (
              <>
                <DesignSection
                  project={project}
                  files={files}
                  profile={profile}
                  designers={designers}
                />
                {/* 샘플/양산 단계 진입 시 상품기획팀 현황 + 검수 액션 표시 */}
                {['SAMPLING', 'CLOSED'].includes(projectStatus) && (
                  <SamplingPreviewForDesign
                    project={project}
                    schedules={schedules}
                  />
                )}
              </>
            ) : (
              <EmptyState
                icon="🎨"
                title="아직 디자인 단계가 아닙니다"
                desc="신규기획팀에서 상품기획 검토를 완료하면 디자인 작업이 시작됩니다"
              />
            )}
          </>
        )}

        {/* 상품기획팀 */}
        {activeTab === 'production' && (
          <>
            {['SAMPLING', 'CLOSED'].includes(projectStatus) ? (
              <SamplingSection
                project={project}
                schedules={schedules}
                profile={profile}
              />
            ) : (
              <EmptyState
                icon="📦"
                title="아직 샘플/양산 단계가 아닙니다"
                desc="디자인팀에서 작지서 완료 후 샘플 제작이 시작됩니다"
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">{desc}</p>
    </div>
  )
}
