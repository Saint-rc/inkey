'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DESIGN_STEPS = [
  { key: 'DESIGN_1ST_WORK', label: '1차 기획디자인 작업' },
  { key: 'DESIGN_1ST_REVIEW', label: '1차 디자인 검수' },
  { key: 'DESIGN_2ND_WORK', label: '2차 디자인 작업' },
  { key: 'DESIGN_2ND_REVIEW', label: '2차 디자인 검수' },
  { key: 'WORK_ORDER_READY', label: '작지서 제작 완료' },
  { key: 'WORK_ORDER_SENT', label: '작지서 PM팀 전달' },
]

const STEP_ORDER = DESIGN_STEPS.map((s) => s.key)

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
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<'DESIGN_DRAFT' | 'WORK_ORDER'>('DESIGN_DRAFT')

  const isDesignLeader = profile?.role === 'DESIGN_LEADER'
  const isDesigner = profile?.role === 'DESIGNER' && project.designer_id === profile?.id

  const currentStepIdx = project.design_step ? STEP_ORDER.indexOf(project.design_step) : -1

  const handleAssignDesigner = async () => {
    if (!selectedDesigner) return
    setLoading(true)
    await supabase.from('projects').update({
      designer_id: selectedDesigner,
      design_step: 'DESIGN_1ST_WORK',
    }).eq('id', project.id)
    router.refresh()
    setLoading(false)
  }

  const handleNextStep = async () => {
    setLoading(true)
    const nextStep = STEP_ORDER[currentStepIdx + 1]

    if (nextStep === undefined) {
      // 디자인 완료 → 샘플링 단계로
      await supabase.from('projects').update({
        status: 'SAMPLING',
        sample_step: 'SAMPLE_REQUESTED',
      }).eq('id', project.id)
    } else {
      await supabase.from('projects').update({
        design_step: nextStep,
      }).eq('id', project.id)
    }
    router.refresh()
    setLoading(false)
  }

  const handleFileUpload = async () => {
    if (!uploadFile) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = uploadFile.name.split('.').pop()
    const path = `${project.id}/${Date.now()}.${ext}`

    const { data: uploaded } = await supabase.storage
      .from('project-files')
      .upload(path, uploadFile)

    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(path)

      await supabase.from('project_files').insert({
        project_id: project.id,
        file_type: uploadType,
        file_url: publicUrl,
        file_name: uploadFile.name,
        uploader_id: user.id,
      })
    }

    setUploadFile(null)
    router.refresh()
    setLoading(false)
  }

  const designFiles = files.filter((f) => ['DESIGN_DRAFT', 'WORK_ORDER'].includes(f.file_type))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">디자인 진행</h2>
        {project.designer && (
          <span className="text-sm text-gray-500">
            담당: {(project.designer as any)?.name}
          </span>
        )}
      </div>

      {/* 디자인리더: 디자이너 배정 */}
      {isDesignLeader && !project.designer_id && (
        <div className="mb-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-sm font-medium text-yellow-800 mb-3">디자이너를 배정해주세요</p>
          <div className="flex gap-3">
            <select
              value={selectedDesigner}
              onChange={(e) => setSelectedDesigner(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">디자이너 선택</option>
              {designers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
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
        <div className="mb-5">
          <div className="flex gap-2 flex-wrap">
            {DESIGN_STEPS.map((step, i) => (
              <div
                key={step.key}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                  i < currentStepIdx
                    ? 'bg-green-100 text-green-700'
                    : i === currentStepIdx
                    ? 'bg-blue-100 text-blue-700 font-semibold'
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

      {/* 파일 업로드 (디자이너만) */}
      {isDesigner && project.design_step && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm font-medium text-gray-700 mb-3">파일 업로드</p>
          <div className="flex gap-3 items-center">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="DESIGN_DRAFT">디자인 시안</option>
              <option value="WORK_ORDER">작지서</option>
            </select>
            <label className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer bg-white hover:bg-gray-50">
              {uploadFile ? uploadFile.name : '파일 선택...'}
              <input type="file" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </label>
            <button
              onClick={handleFileUpload}
              disabled={!uploadFile || loading}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-40 transition-colors"
            >
              업로드
            </button>
          </div>
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {designFiles.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">첨부 파일</p>
          <div className="space-y-1.5">
            {designFiles.map((file) => (
              <a
                key={file.id}
                href={file.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {file.file_name}
                <span className="text-xs text-gray-400">
                  ({file.file_type === 'DESIGN_DRAFT' ? '디자인 시안' : '작지서'})
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 단계 진행 버튼 */}
      {(isDesigner || isDesignLeader) && project.design_step && (
        <button
          onClick={handleNextStep}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? '처리 중...' : currentStepIdx === STEP_ORDER.length - 1
            ? '작지서 PM팀 전달 → 샘플 제작 시작'
            : `다음 단계: ${DESIGN_STEPS[currentStepIdx + 1]?.label}`}
        </button>
      )}
    </div>
  )
}
