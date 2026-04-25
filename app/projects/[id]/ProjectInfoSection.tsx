'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUS_LABEL: Record<string, string> = {
  INITIATED: '발의됨',
  PM_REVIEW: '상품기획 검토중',
  DESIGN: '디자인 진행',
  SAMPLING: '샘플/양산',
  CLOSED: '완료',
}

export default function ProjectInfoSection({
  project,
  files,
  profile,
}: {
  project: any
  files: any[]
  profile: any
}) {
  const router = useRouter()
  const supabase = createClient()
  const [launchDate, setLaunchDate] = useState(project.target_launch_date ?? '')
  const [editingLaunch, setEditingLaunch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [thumbnail, setThumbnail] = useState<string | null>(project.thumbnail_url ?? null)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [thumbError, setThumbError] = useState<string | null>(null)

  const isPlanner = true

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingThumb(true)
    setThumbError(null)

    // 파일을 base64로 읽어서 임시 미리보기
    const reader = new FileReader()
    reader.readAsDataURL(file)

    const ext = file.name.split('.').pop()
    const path = `${project.id}/thumb_${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('project-thumbnails')
      .upload(path, file, { upsert: true })

    if (upErr) {
      console.error('썸네일 업로드 오류:', upErr)
      setThumbError(upErr.message)
      setUploadingThumb(false)
      e.target.value = ''
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('project-thumbnails')
      .getPublicUrl(path)

    const { error: dbErr } = await supabase
      .from('projects')
      .update({ thumbnail_url: publicUrl })
      .eq('id', project.id)

    if (dbErr) {
      console.error('썸네일 DB 저장 오류:', dbErr)
      setThumbError(dbErr.message)
    } else {
      setThumbnail(publicUrl)
      router.refresh()
    }
    setUploadingThumb(false)
    e.target.value = ''
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('projects').delete().eq('id', project.id)
    router.push('/dashboard')
  }

  const handleSaveLaunchDate = async () => {
    setSaving(true)
    await supabase.from('projects').update({
      target_launch_date: launchDate || null,
    }).eq('id', project.id)
    setSaving(false)
    setEditingLaunch(false)
    router.refresh()
  }

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('ko-KR') : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          {/* 썸네일 */}
          <div className="flex flex-col items-center gap-1">
          <label className="relative group cursor-pointer shrink-0">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleThumbnailUpload}
              disabled={uploadingThumb}
            />
            <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 group-hover:border-blue-400 transition-colors bg-gray-50 flex items-center justify-center">
              {thumbnail ? (
                <img src={thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-300 group-hover:text-blue-400 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] font-medium">썸네일</span>
                </div>
              )}
              {uploadingThumb && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {thumbnail && !uploadingThumb && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-xl transition-all flex items-center justify-center">
                  <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              )}
            </div>
          </label>
          {thumbError && (
            <p className="text-[10px] text-red-500 max-w-[80px] text-center leading-tight">{thumbError.includes('not found') || thumbError.includes('Bucket') ? '버킷 없음' : '업로드 실패'}</p>
          )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{project.item_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
            {STATUS_LABEL[project.status] ?? project.status}
          </span>
          {isPlanner && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">삭제할까요?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg font-medium disabled:opacity-40 transition-colors"
                >
                  {deleting ? '삭제중...' : '확인'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                삭제
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        {[
          ['재질', project.material],
          ['패키지 사양', project.package_spec],
          ['예상 수량', project.quantity ? `${project.quantity.toLocaleString()}개` : null],
          ['프로젝트 시작일', fmt(project.start_date)],
          ['목표 입고일', fmt(project.target_delivery_date)],
          ['PM', (project.planner as any)?.name],
        ].map(([label, value]) =>
          value ? (
            <div key={label as string} className="flex gap-2">
              <span className="text-gray-400 w-24 shrink-0">{label}</span>
              <span className="text-gray-800 font-medium">{value}</span>
            </div>
          ) : null
        )}

        {/* 목표 출시일 */}
        <div className="flex gap-2 items-center">
          <span className="text-gray-400 w-24 shrink-0">목표 출시일</span>
          {isPlanner ? (
            editingLaunch ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={launchDate}
                  onChange={(e) => setLaunchDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveLaunchDate}
                  disabled={saving}
                  className="text-sm text-blue-600 font-medium hover:text-blue-700 disabled:opacity-40"
                >
                  저장
                </button>
                <button
                  onClick={() => { setEditingLaunch(false); setLaunchDate(project.target_launch_date ?? '') }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-gray-800 font-medium">
                  {fmt(project.target_launch_date) ?? '-'}
                </span>
                <button
                  onClick={() => setEditingLaunch(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
                >
                  수정
                </button>
              </div>
            )
          ) : (
            <span className="text-gray-800 font-medium">
              {fmt(project.target_launch_date) ?? '-'}
            </span>
          )}
        </div>
      </div>

      {project.memo && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <span className="font-medium text-gray-700">메모: </span>{project.memo}
        </div>
      )}

      {/* 레퍼런스 이미지 */}
      {files.filter(f => f.file_type === 'REFERENCE').length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">레퍼런스 이미지</p>
          <div className="flex gap-2 flex-wrap">
            {files.filter(f => f.file_type === 'REFERENCE').map(file => (
              <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer">
                <img
                  src={file.file_url}
                  alt={file.file_name}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
