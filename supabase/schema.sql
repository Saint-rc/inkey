-- =============================================
-- 올인원 프로젝트 관리 시스템 DB 스키마
-- Supabase SQL Editor에 붙여넣기 후 실행
-- =============================================

-- ENUM 타입 정의
CREATE TYPE user_role AS ENUM ('PLANNER', 'PM', 'DESIGN_LEADER', 'DESIGNER');
CREATE TYPE project_status AS ENUM ('INITIATED', 'PM_REVIEW', 'DESIGN', 'SAMPLING', 'CLOSED');
CREATE TYPE stage_name AS ENUM (
  'DESIGN_1ST', 'DESIGN_2ND',
  'SAMPLE_1ST', 'SAMPLE_2ND',
  'MASS_PRODUCTION', 'SHIPPING', 'WAREHOUSING'
);
CREATE TYPE file_type AS ENUM ('REFERENCE', 'DESIGN_DRAFT', 'WORK_ORDER', 'SAMPLE_PHOTO');
CREATE TYPE design_step AS ENUM (
  'DESIGN_1ST_WORK',
  'DESIGN_1ST_REVIEW',
  'DESIGN_2ND_WORK',
  'DESIGN_2ND_REVIEW',
  'WORK_ORDER_READY',
  'WORK_ORDER_SENT'
);
CREATE TYPE sample_step AS ENUM (
  'SAMPLE_REQUESTED',
  'SAMPLE_ARRIVED',
  'SAMPLE_1ST_REVIEW',
  'SAMPLE_2ND_PRODUCTION',
  'SAMPLE_2ND_REVIEW',
  'MASS_PRODUCTION_START'
);

-- =============================================
-- 사용자 프로필 (Supabase Auth 연동)
-- =============================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  role        user_role NOT NULL DEFAULT 'PLANNER',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 신규 사용자 가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 브랜드 / IP
-- =============================================
CREATE TABLE brands (
  id    SERIAL PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL
);

-- =============================================
-- 품목 유형
-- =============================================
CREATE TABLE item_types (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  brand_id  INT REFERENCES brands(id) ON DELETE CASCADE
);

-- =============================================
-- 프로젝트 메인
-- =============================================
CREATE TABLE projects (
  id                    SERIAL PRIMARY KEY,
  title                 TEXT NOT NULL,
  status                project_status NOT NULL DEFAULT 'INITIATED',

  -- 상품 정보
  item_name             TEXT,
  material              TEXT,
  package_spec          TEXT,
  quantity              INT,
  memo                  TEXT,

  -- 일정
  start_date            DATE NOT NULL,
  target_delivery_date  DATE NOT NULL,

  -- 카테고리 (선택)
  brand_id              INT REFERENCES brands(id),
  item_type_id          INT REFERENCES item_types(id),

  -- 담당자
  planner_id  UUID NOT NULL REFERENCES profiles(id),
  pm_id       UUID REFERENCES profiles(id),
  design_leader_id UUID REFERENCES profiles(id),
  designer_id UUID REFERENCES profiles(id),

  -- PM 검토 정보
  estimated_cost        TEXT,
  pm_notes              TEXT,

  -- 디자인 진행 단계
  design_step           design_step,

  -- 샘플/양산 진행 단계
  sample_step           sample_step,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 프로젝트 세부 일정
-- =============================================
CREATE TABLE project_schedules (
  id                  SERIAL PRIMARY KEY,
  project_id          INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_name          stage_name NOT NULL,
  auto_estimated_date DATE NOT NULL,
  pm_adjusted_date    DATE,
  actual_done_date    DATE,
  is_delayed          BOOLEAN DEFAULT FALSE,
  notes               TEXT
);

-- =============================================
-- 첨부 파일
-- =============================================
CREATE TABLE project_files (
  id          SERIAL PRIMARY KEY,
  project_id  INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_type   file_type NOT NULL,
  file_url    TEXT NOT NULL,
  file_name   TEXT,
  uploader_id UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS (Row Level Security) 설정
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_types ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 수정, 모두 조회 가능
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- projects: 로그인한 사용자 모두 조회, 생성 가능
CREATE POLICY "projects_select" ON projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (auth.role() = 'authenticated');

-- schedules: 로그인 사용자 접근
CREATE POLICY "schedules_all" ON project_schedules USING (auth.role() = 'authenticated');

-- files: 로그인 사용자 접근
CREATE POLICY "files_select" ON project_files FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "files_insert" ON project_files FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- brands/item_types: 모두 조회 가능
CREATE POLICY "brands_select" ON brands FOR SELECT USING (true);
CREATE POLICY "brands_insert" ON brands FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "item_types_select" ON item_types FOR SELECT USING (true);
CREATE POLICY "item_types_insert" ON item_types FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- 샘플 데이터 (브랜드)
-- =============================================
INSERT INTO brands (name) VALUES ('미니틴'), ('쁘넥도'), ('BT21'), ('기타');
