import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 역할 미설정 유저는 setup-role로
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        // 역할이 기본값(PLANNER)이면 setup-role 페이지로
        // 실제로는 처음 가입 여부를 판단하기 위해 별도 플래그 사용 가능
        const isNewUser = searchParams.get('new') === 'true'
        if (!profile || isNewUser) {
          return NextResponse.redirect(`${origin}/setup-role`)
        }
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
