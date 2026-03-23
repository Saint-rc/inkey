'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ROLES = [
  {
    value: 'PLANNER',
    label: 'PM',
    desc: '새 프로젝트를 발의하고 요건을 정의합니다',
    icon: '💡',
  },
  {
    value: 'PM',
    label: '상품기획',
    desc: '일정 수립, 공장 핸들링, 샘플/양산 관리를 담당합니다',
    icon: '📋',
  },
  {
    value: 'DESIGN_LEADER',
    label: '디자인팀 리더',
    desc: '디자이너를 배정하고 디자인 검수를 합니다',
    icon: '🎨',
  },
  {
    value: 'DESIGNER',
    label: '디자이너',
    desc: '시안 작업 및 작지서 제작을 담당합니다',
    icon: '✏️',
  },
]

export default function SetupRolePage() {
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!selected) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ role: selected })
      .eq('id', user.id)

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">역할을 선택해주세요</h1>
        <p className="text-gray-500 text-sm mb-6">나중에 관리자가 변경할 수 있습니다</p>

        <div className="space-y-3">
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelected(role.value)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                selected === role.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{role.icon}</span>
              <div>
                <div className="font-semibold text-gray-900">{role.label}</div>
                <div className="text-sm text-gray-500">{role.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="mt-6 w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '저장 중...' : '시작하기'}
        </button>
      </div>
    </div>
  )
}
