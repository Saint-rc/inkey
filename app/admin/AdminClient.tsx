'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'PLANNER', label: 'PM', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'PM', label: '상품기획', color: 'bg-blue-100 text-blue-700' },
  { value: 'DESIGN_LEADER', label: '디자인리더', color: 'bg-purple-100 text-purple-700' },
  { value: 'DESIGNER', label: '디자이너', color: 'bg-pink-100 text-pink-700' },
]

export default function AdminClient({ users }: { users: any[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleRoleChange = async (userId: string, newRole: string) => {
    setLoading(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    router.refresh()
    setLoading(null)
  }

  const handleAdminToggle = async (userId: string, current: boolean) => {
    setLoading(userId)
    await supabase.from('profiles').update({ is_admin: !current }).eq('id', userId)
    router.refresh()
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm text-gray-500">총 {users.length}명</p>
      </div>
      <div className="divide-y divide-gray-100">
        {users.map((user) => {
          const roleInfo = ROLES.find((r) => r.value === user.role)
          return (
            <div key={user.id} className="px-6 py-4 flex items-center gap-4">
              {/* 유저 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{user.name}</span>
                  {user.is_admin && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      관리자
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 truncate">{user.email}</p>
              </div>

              {/* 역할 선택 */}
              <div className="flex items-center gap-3">
                <select
                  value={user.role}
                  disabled={loading === user.id}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className={`text-sm px-3 py-1.5 rounded-lg border border-gray-200 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${roleInfo?.color ?? ''}`}
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>

                {/* 관리자 토글 */}
                <button
                  onClick={() => handleAdminToggle(user.id, user.is_admin)}
                  disabled={loading === user.id}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
                    user.is_admin
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {user.is_admin ? '관리자 해제' : '관리자 지정'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
