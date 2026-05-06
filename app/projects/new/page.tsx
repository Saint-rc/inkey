'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { calculateSchedule, STAGE_LABELS, type CalculateResult } from '@/lib/scheduleCalculator'
import { fmtDateShort } from '@/lib/formatDate'

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
    // 데드라인
    deadline_mass_production: '',
    deadline_order: '',
    deadline_mold: '',
    deadline_final_sample: '',
  })

  // SKU 옵션 (동적 추가)
  const [skuOptions, setSkuOptions] = useState<string[]>([''])
  const [files, setFiles] = useState<FileList | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, email')
      .in('role', ['PM_LEADER', 'PM', 'PLANNER'])
      .then(({ data }) => { if (data) setPmList(data) })
  }, [])

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

  // SKU 옵션 핸들러
  const handleSkuChange = (idx: number, value: string) => {
    setSkuOptions(prev => prev.map((v, i) => i === idx ? value : v))
  }
  const handleSkuAdd = () => setSkuOptions(prev => [...prev, ''])
  const handleSkuRemove = (idx: number) => {
    setSkuOptions(prev => prev.length === 1 ? [''] : prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preview) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const cleanedSkus = skuOptions.filter(s => s.trim())

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
        sku_options: cleanedSkus.length > 0 ? cleanedSkus : [],
        deadline_mass_production: form.deadline_mass_production || null,
        deadline_order: form.deadline_order || null,
        deadline_mold: form.deadline_mold || null,
        deadline_final_sample: form.deadline_final_sample || null,
      })
      .select()
      .single()

    if (error || !project) {
      alert('프로젝트 생성 실패: ' + error?.message)
      setLoading(false)
      return
    }

    const scheduleRows = preview.schedules.map((s) => ({
      project_id: project.id,
      stage_name: s.stage_name,
      auto_estimated_date: s.auto_estimated_date,
      is_delayed: s.is_tight,
    }))
    await supabase.from('project_schedules').insert(scheduleRows)

    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `${project.id}/${Date.now()}.${ext}`
        const { data: uploaded, error: uploadErr } = await supabase.storage
          .from('project-files')
          .upload(path, file)
        if (uploadErr) {
          console.error('[파일 업로드 오류]', uploadErr)
          continue
        }
        if (uploaded) {
          const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(path)
          const { error: insertErr } = await supabase.from('project_files').insert({
            project_id: project.id,
            file_type: 'REFERENCE',
            file_url: publicUrl,
            file_name: file.name,
            uploader_id: user.id,
          })
          if (insertErr) console.error('[project_files insert 오류]', insertErr)
        }
      }
    }

    router.push('/dashboard')
  }

  const DEADLINES = [
    { key: 'deadline_final_sample',    label: '최종샘플 제작 데드라인', color: 'text-blue-600' },
    { key: 'deadline_mold',            label: '금형 시작 데드라인',      color: 'text-purple-600' },
    { key: 'deadline_order',           label: '발주 데드라인',           color: 'text-orange-600' },
    { key: 'deadline_mass_production', label: '양산 시작 데드라인',      color: 'text-red-600' },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">새 프로젝트 발의</h1>
          <p className="text-gray-500 text-sm mt-1">기본 정보를 입력하면 상품기획팀에 전달됩니다</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── 기본 정보 ── */}
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

            {/* SKU 옵션 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">SKU 옵션</label>
                <button
                  type="button"
                  onClick={handleSkuAdd}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[11px]">+</span>
                  옵션 추가
                </button>
              </div>
              <div className="space-y-2">
                {skuOptions.map((sku, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 shrink-0 w-6 text-right">{idx + 1}</span>
                    <input
                      value={sku}
                      onChange={e => handleSkuChange(idx, e.target.value)}
                      placeholder={`예: A타입 (핑크), B타입 (블루)`}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleSkuRemove(idx)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-sm shrink-0"
                    >✕</button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">색상, 사이즈, 디자인 등 각 옵션을 줄마다 입력하세요</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">목표 출시일</label>
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

            {/* 상품기획팀 담당자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">상품기획팀 담당자</label>
              <select
                name="pm_id"
                value={form.pm_id}
                onChange={(e) => setForm({ ...form, pm_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">상품기획팀 담당자 선택 (선택사항)</option>
                {pmList.map((pm) => (
                  <option key={pm.id} value={pm.id}>{pm.name ?? pm.email}</option>
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

          {/* ── 주요 데드라인 ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">⏰</span>
              <h2 className="text-sm font-bold text-gray-800">주요 데드라인</h2>
              <span className="text-xs text-gray-400">(선택사항 · 등록하면 현황판에 표시됩니다)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {DEADLINES.map(({ key, label, color }) => (
                <div key={key}>
                  <label className={`block text-xs font-semibold mb-1.5 ${color}`}>{label}</label>
                  <input
                    name={key}
                    type="date"
                    value={form[key]}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
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
                <span className="text-base font-semibold text-gray-800">📅 자동 역산 일정 미리보기</span>
                {!preview.isValid && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠️ 일정 빠듯 — PM 검토 필요</span>
                )}
                {preview.isValid && preview.isTight && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">⚡ 일정이 매우 빠듯합니다</span>
                )}
                {preview.isValid && !preview.isTight && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ 일정 이상 없음</span>
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
                    <span className={s.is_tight ? 'text-orange-600' : 'text-gray-600'}>
                      {STAGE_LABELS[s.stage_name]}
                      {preview.isScaled && (
                        <span className="ml-1.5 text-xs text-gray-400">({s.effective_days}일)</span>
                      )}
                    </span>
                    <span className={`font-medium ${s.is_tight ? 'text-orange-600' : 'text-gray-800'}`}>
                      {fmtDateShort(s.auto_estimated_date)}
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
              {loading ? '제출 중...' : '상품기획팀에 전달하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
