'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { calculateSchedule, STAGE_LABELS, type CalculateResult } from '@/lib/scheduleCalculator'

type Profile = { id: string; name: string | null; email: string }

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<CalculateResult | null>(null)
  const [pmList, setPmList] = useState<Profile[]>([])

  const [form, setForm] = useState({
    title: '',
    item_name: '',
    material: '',
    package_spec: '',
    quantity: '',
    memo: '',
    start_date: '',
    target_delivery_date: '',
    target_launch_date: '',
    pm_id: '',
  })
  const [files, setFiles] = useState<FileList | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'PM')
      .then(({ data }) => { if (data) setPmList(data) })
  }, [])

  // 날짜 변경 시 역산 미리보기 자동 계산
  useEffect(() => {
    if (form.start_date && form.target_delivery_date) {
      const result = calculateSchedule(form.target_delivery_date, form.start_date)
      setPreview(result)
    } else {
      setPreview(null)
    }
  }, [form.start_date, form.target_delivery_date])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preview) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 프로젝트 생성
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        title: form.title,
        item_name: form.item_name,
        material: form.material || null,
        package_spec: form.package_spec || null,
        quantity: form.quantity ? parseInt(form.quantity) : null,
        memo: form.memo || null,
        start_date: form.start_date,
        target_delivery_date: form.target_delivery_date,
        target_launch_date: form.target_launch_date || null,
        planner_id: user.id,
        pm_id: form.pm_id || null,
        status: 'INITIATED',
      })
      .select()
      .single()

    if (error || !project) {
      alert('프로젝트 생성 실패: ' + error?.message)
      setLoading(false)
      return
    }

    // 역산 일정 자동 저장
    const scheduleRows = preview.schedules.map((s) => ({
      project_id: project.id,
      stage_name: s.stage_name,
      auto_estimated_date: s.auto_estimated_date,
      is_delayed: s.is_tight,
    }))

    await supabase.from('project_schedules').insert(scheduleRows)

    // 레퍼런스 이미지 업로드
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `${project.id}/${Date.now()}.${ext}`
        const { data: uploaded } = await supabase.storage
          .from('project-files')
          .upload(path, file)

        if (uploaded) {
          const { data: { publicUrl } } = supabase.storage
            .from('project-files')
            .getPublicUrl(path)
          await supabase.from('project_files').insert({
            project_id: project.id,
            file_type: 'REFERENCE',
            file_url: publicUrl,
            file_name: file.name,
            uploader_id: user.id,
          })
        }
      }
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">새 프로젝트 발의</h1>
          <p className="text-gray-500 text-sm mt-1">기본 정보를 입력하면 PM팀에 전달됩니다</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">

            {/* 프로젝트명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                프로젝트명 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="예: 조앤프렌즈"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 품목명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                품목명 <span className="text-red-500">*</span>
              </label>
              <input
                name="item_name"
                value={form.item_name}
                onChange={handleChange}
                required
                placeholder="예: 레진키캡"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 재질 / 패키지 사양 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">재질</label>
                <input
                  name="material"
                  value={form.material}
                  onChange={handleChange}
                  placeholder="예: 레진"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">패키지 사양</label>
                <input
                  name="package_spec"
                  value={form.package_spec}
                  onChange={handleChange}
                  placeholder="예: OPP 봉투 + 백카드"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 예상 수량 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">예상 수량</label>
              <input
                name="quantity"
                type="number"
                value={form.quantity}
                onChange={handleChange}
                placeholder="예: 3000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 일정 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  프로젝트 시작일 <span className="text-red-500">*</span>
                </label>
                <input
                  name="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  목표 입고일 <span className="text-red-500">*</span>
                </label>
                <input
                  name="target_delivery_date"
                  type="date"
                  value={form.target_delivery_date}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  목표 출시일
                </label>
                <input
                  name="target_launch_date"
                  type="date"
                  value={form.target_launch_date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 레퍼런스 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">레퍼런스 이미지</label>
              <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg py-6 cursor-pointer hover:border-blue-400 transition-colors">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-500">
                  {files && files.length > 0 ? `${files.length}개 파일 선택됨` : '클릭하여 이미지 업로드'}
                </span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(e.target.files)} />
              </label>
            </div>

            {/* PM 담당자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">PM 담당자</label>
              <select
                name="pm_id"
                value={form.pm_id}
                onChange={(e) => setForm({ ...form, pm_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">PM 담당자 선택 (선택사항)</option>
                {pmList.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name ?? pm.email}
                  </option>
                ))}
              </select>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">제작 관련 메모</label>
              <textarea
                name="memo"
                value={form.memo}
                onChange={handleChange}
                rows={4}
                placeholder="참고사항, 특이사항, 요청사항 등을 자유롭게 입력하세요"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* 역산 일정 미리보기 */}
          {preview && (
            <div className={`rounded-2xl border p-5 ${
              !preview.isValid
                ? 'bg-red-50 border-red-300'
                : preview.isTight
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-semibold text-gray-800">
                  📅 자동 역산 일정 미리보기
                </span>
                {!preview.isValid && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                    ⚠️ 일정 빠듯 — PM 검토 필요
                  </span>
                )}
                {preview.isValid && preview.isTight && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                    ⚡ 일정이 매우 빠듯합니다
                  </span>
                )}
                {preview.isValid && !preview.isTight && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    ✅ 일정 이상 없음
                  </span>
                )}
              </div>

              {preview.isScaled && (
                <p className="text-xs text-yellow-700 mb-2">
                  ⚡ 기간이 부족해 각 단계를 비율로 압축했습니다 (기본 {preview.totalLeadTime}일 → {preview.totalDays}일). PM이 최종 조정해주세요.
                </p>
              )}
              <div className="space-y-1.5">
                {[...preview.schedules].reverse().map((s) => (
                  <div key={s.stage_name} className="flex items-center justify-between text-sm">
                    <span className={`${s.is_tight ? 'text-orange-600' : 'text-gray-600'}`}>
                      {STAGE_LABELS[s.stage_name]}
                      {preview.isScaled && (
                        <span className="ml-1.5 text-xs text-gray-400">
                          ({s.effective_days}일)
                        </span>
                      )}
                    </span>
                    <span className={`font-medium ${s.is_tight ? 'text-orange-600' : 'text-gray-800'}`}>
                      {new Date(s.auto_estimated_date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400">
                총 {preview.totalDays}일 프로젝트 · PM이 각 단계 날짜를 조정할 수 있습니다
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {loading ? '제출 중...' : 'PM팀에 전달하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
