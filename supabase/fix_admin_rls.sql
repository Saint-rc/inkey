-- =============================================
-- 관리자 profiles 수정 권한 RLS 정책 수정
-- Supabase Dashboard > SQL Editor에서 실행
-- =============================================

-- 1. 관리자 여부를 확인하는 함수 생성 (SECURITY DEFINER: RLS 재귀 방지)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_admin, false)
  FROM profiles
  WHERE id = auth.uid()
$$;

-- 2. 기존 profiles UPDATE 정책 제거
DROP POLICY IF EXISTS "profiles_update" ON profiles;

-- 3. 새 정책: 본인 수정 OR 관리자가 모든 유저 수정 가능
CREATE POLICY "profiles_update" ON profiles
FOR UPDATE
USING (
  auth.uid() = id
  OR
  public.is_admin_user()
);
