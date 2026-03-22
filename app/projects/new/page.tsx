'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    title: '',
    item_name: '',
    material: '',
    package_spec: '',
    quantity: '',
    memo: '',
    start_date: '',
    target_delivery_date: '',
  })
  const [files, setFiles] = useState<FileList | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        planner_id: user.id,
        status: 'INITIATED',
      })
      .select()
      .single()

    if (error || !project) {
      alert('프로젝트 생성 실패: ' + error?.message)
      setLoading(false)
      return
    }

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

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">

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
              placeholder="예: BT21 아크릴 스탠드 2025 여름"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              placeholder="예: 아크릴 스탠드, 틴케이스"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                placeholder="예: 아크릴 3T"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">패키지 사양</label>
              <input
                name="package_spec"
                value={form.package_spec}
                onChange={handleChange}
                placeholder="예: OPP 봉투 + 백카드"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 레퍼런스 이미지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              레퍼런스 이미지
            </label>
            <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg py-6 cursor-pointer hover:border-blue-400 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-500">
                {files && files.length > 0
                  ? `${files.length}개 파일 선택됨`
                  : '클릭하여 이미지 업로드'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles(e.target.files)}
              />
            </label>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              제작 관련 메모
            </label>
            <textarea
              name="memo"
              value={form.memo}
              onChange={handleChange}
              rows={4}
              placeholder="참고사항, 특이사항, 요청사항 등을 자유롭게 입력하세요"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
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
