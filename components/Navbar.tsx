'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar({
  userName,
  userRole: _userRole,
  isAdmin,
}: {
  userName?: string
  userRole?: string
  isAdmin?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link href="/dashboard" className="text-lg font-bold text-gray-500 hover:text-blue-600 transition-colors">
        INKEY
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/tracker" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
          일정 현황
        </Link>
        {isAdmin && (
          <Link href="/admin" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
            관리자
          </Link>
        )}
        <span className="text-sm text-gray-600">{userName}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </nav>
  )
}
