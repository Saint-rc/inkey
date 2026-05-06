/**
 * REMC 스케줄러 연동 유틸리티
 *
 * 활성화 방법:
 *   1. Firebase 서비스 계정 키 발급 (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성)
 *   2. .env.local 에 아래 값 설정:
 *      REMC_INTEGRATION_ENABLED=true
 *      FIREBASE_PROJECT_ID=remc-scheduler
 *      FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@remc-scheduler.iam.gserviceaccount.com
 *      FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   3. 인키 ↔ 렘씨스케줄러 인원 이메일 매칭 확인
 *
 * 현재 상태: DISABLED (REMC_INTEGRATION_ENABLED=false)
 */

export type RemcNotifyPayload = {
  /** 담당자 이메일 (Supabase profiles.email 또는 auth.users.email) */
  assigneeEmail: string
  /** 업무 제목 */
  title: string
  /** 업무 상세 내용 */
  body: string
  /** 프로젝트 ID (인키 링크용) */
  projectId: number
  /** 날짜 (YYYY-MM-DD, 기본값: 오늘) */
  date?: string
}

/**
 * 단계 전환 시 담당자 스케줄러에 업무 + 알림을 보냅니다.
 * REMC_INTEGRATION_ENABLED=false 이면 아무것도 하지 않습니다 (fire-and-forget).
 */
export async function notifyREMC(payload: RemcNotifyPayload): Promise<void> {
  // 서버 컴포넌트에서는 직접 호출, 클라이언트에서는 API Route 경유
  try {
    await fetch('/api/remc-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // 연동 실패가 메인 플로우에 영향을 주지 않도록 에러 무시
    console.warn('[REMC 연동] 알림 전송 실패 (메인 기능에는 영향 없음)')
  }
}

// ── 단계별 메시지 템플릿 ──────────────────────────────────────
export const REMC_MESSAGES = {
  /** 검수완료 → 상품기획팀 담당자에게 */
  SAMPLE_APPROVED: (itemName: string) =>
    `[${itemName}] 샘플 검수가 완료되었습니다. 양산 일정을 확인하고 양산 시작 처리해주세요.`,

  /** 검수반려 → 상품기획팀 담당자에게 */
  SAMPLE_REJECTED: (itemName: string, note?: string) =>
    `[${itemName}] 샘플이 검수 반려되었습니다. ${note ? `사유: ${note}` : ''}재제작 일정을 확인해주세요.`,

  /** 양산중 전환 → 디자인팀 리더에게 */
  MASS_PRODUCTION_STARTED: (itemName: string) =>
    `[${itemName}] 양산이 시작되었습니다. 진행 상황을 확인해주세요.`,

  /** 운송 시작 → 상품기획팀 담당자에게 */
  SHIPPING_STARTED: (itemName: string) =>
    `[${itemName}] 운송이 시작되었습니다. 입고 일정을 확인해주세요.`,

  /** 입고완료 → 전체 담당자에게 */
  WAREHOUSED: (itemName: string) =>
    `[${itemName}] 입고가 완료되었습니다. 프로젝트가 종료됩니다.`,

  /** 디자인 1차 완료 → PM에게 */
  DESIGN_1ST_DONE: (itemName: string) =>
    `[${itemName}] 1차 디자인이 완료되었습니다. 검수해주세요.`,
} as const
