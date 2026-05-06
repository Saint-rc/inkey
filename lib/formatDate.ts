const DAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 연도 포함 전체 날짜 + 요일: 2026. 8. 1.(토) */
export function fmtDateFull(d: string | null | undefined): string | null {
  if (!d) return null
  const date = new Date(d)
  if (isNaN(date.getTime())) return null
  const day = DAYS[date.getDay()]
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }) + `(${day})`
}

/** 월/일 + 요일: 8. 1.(토) */
export function fmtDateShort(d: string | null | undefined): string | null {
  if (!d) return null
  const date = new Date(d)
  if (isNaN(date.getTime())) return null
  const day = DAYS[date.getDay()]
  return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) + `(${day})`
}
