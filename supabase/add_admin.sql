-- is_admin 컬럼 추가
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- 관리자 설정
UPDATE profiles SET is_admin = TRUE WHERE email = 'pdirector@royche.co.kr';
