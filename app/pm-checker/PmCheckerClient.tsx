'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'

/* ── Types ── */
interface Issue {
  severity: 'error' | 'warning'
  type: string
  location: string
  master: string
  found: string
  description: string
  _file: string
}
interface PendingFile {
  id: string
  name: string
  status: 'loading' | 'ready' | 'image-pdf' | 'error'
  chars?: number
}
interface CheckFile { id: string; name: string; text: string }
interface HistoryRecord {
  id: number; date: string; files: string[]
  errors: number; warnings: number; issues: Issue[]
}

/* ── Constants ── */
const HISTORY_KEY = 'remc_pm_history'
const KEYWORDS = [
  '제품명','모델명','재질','정격전압','정격전압/전원',
  '제품크기','제품크기/무게','구성품','제조자','제조자/상호명',
  '제조국','제조연월','고객센터','주소','사용연령',
  '제품 인증번호','배터리 인증번호','전지 제조자',
  '배터리용량','배터리 용량','블루투스 버전','블루투스',
  '플러그 타입','지원 디스크','지원 포맷',
  'USB 최대 지원 용량','신호 대 잡음비','주파수 응답','PL 보험 가입 유무',
]
const SKIP = new Set(['(인)','완료일자','검수일자','담당자','팀장','날짜'])
const BROKEN = /[\u25c6\u25a6\u25b2\u25aa\u25a0\u2666\ufffd\u2022\u25cf\u25a1\u25e6\u2b21\u29c2]/g

/* ── Excel 파싱 ── */
function parseMasterExcel(wb: XLSX.WorkBook): Record<string, string> {
  const result: Record<string, string> = {}
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<(string | null)[]>(
      wb.Sheets[sheetName], { header: 1, defval: null, raw: false }
    )
    for (const row of rows) {
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (!cell || typeof cell !== 'string') continue
        const t = cell.trim()
        for (const kw of KEYWORDS) {
          if (result[kw]) continue
          if (t === kw || t.endsWith(kw) || t.startsWith(kw)) {
            for (let nc = c + 1; nc < Math.min(c + 5, row.length); nc++) {
              const v = row[nc]
              if (!v) continue
              const vs = String(v).trim()
              if (vs && !SKIP.has(vs) && !vs.startsWith('=')) {
                result[kw] = vs
                break
              }
            }
          }
        }
      }
    }
  }
  return result
}

/* ── PDF 텍스트 처리 ── */
function cleanText(t: string) { return t.replace(BROKEN, '[?]') }
function trimText(t: string, max = 12000) {
  if (t.length <= max) return t
  const front = t.slice(0, Math.floor(max * 0.35))
  const back  = t.slice(-(max - Math.floor(max * 0.35)))
  return front + '\n\n[... 중략 ...]\n\n' + back
}

/* ── Gemini 프롬프트 ── */
function buildPrompt(masterData: Record<string, string>, fileName: string, text: string) {
  const masterStr = Object.entries(masterData)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  return `당신은 제품 패키지/매뉴얼 PM 검수 전문가입니다.

## 마스터 데이터 (검수 기준)
${masterStr}

## 중요: PDF 텍스트 추출 한계
PDF에서 텍스트를 추출할 때 커스텀 폰트 인코딩으로 인해 일부 숫자나 문자가 [?]로 대체될 수 있습니다.
→ [?]가 포함된 값은 "추출 불가" 상태이므로 오류로 판단하지 마세요.
→ 명확하게 한국어나 영문 텍스트로 확인되는 부분만 검수하세요.

## 검수 파일명: ${fileName}
${text}

## 검수 지침
마스터 데이터에 있는 항목만 비교하고, 마스터에 없는 항목은 무시하세요.

다음 4가지 유형의 오류를 찾아주세요:
1. 값불일치 — 마스터 값과 명확히 다른 내용 ([?] 포함 제외)
2. 번역오류 — 한국어가 영문으로 잘못 번역 (예: "USB단자" → "USB Port")
3. 오탈자 — 맞춤법 오류 (예: "페이링" → "페어링", "전·원" → "전원")
4. 형식차이 — 띄어쓰기/특수문자/구분자 차이

심각도: error(값 틀림·누락·오탈자) / warning(형식·띄어쓰기 차이)

반드시 아래 JSON 형식으로만 반환하세요:
{
  "summary": { "errors": 0, "warnings": 0 },
  "issues": [
    {
      "severity": "error",
      "type": "값불일치",
      "location": "위치",
      "master": "마스터 기준값",
      "found": "검수 파일 내용",
      "description": "설명"
    }
  ]
}`
}

/* ══════════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════════ */
export default function PmCheckerClient() {
  const [masterData, setMasterData]         = useState<Record<string, string>>({})
  const [masterFileName, setMasterFileName] = useState('')
  const [pendingFiles, setPendingFiles]     = useState<PendingFile[]>([])
  const [checkFiles, setCheckFiles]         = useState<CheckFile[]>([])
  const [model, setModel]                   = useState('gemini-2.5-flash')
  const [isRunning, setIsRunning]           = useState(false)
  const [runStatus, setRunStatus]           = useState('')
  const [allIssues, setAllIssues]           = useState<Issue[]>([])
  const [displayIssues, setDisplayIssues]   = useState<Issue[]>([])
  const [filterType, setFilterType]         = useState('전체')
  const [showResults, setShowResults]       = useState(false)
  const [history, setHistory]               = useState<HistoryRecord[]>([])
  const [pdfjsReady, setPdfjsReady]         = useState(false)

  const masterInputRef = useRef<HTMLInputElement>(null)
  const checkInputRef  = useRef<HTMLInputElement>(null)
  const resultsRef     = useRef<HTMLDivElement>(null)

  /* PDF.js CDN 로드 */
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      setPdfjsReady(true)
    }
    document.head.appendChild(script)
  }, [])

  /* 기록 로드 */
  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')) } catch {}
  }, [])

  /* ── 마스터 Excel 처리 ── */
  const handleMaster = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', raw: false })
        if (!wb.SheetNames.length) throw new Error('시트가 없는 파일입니다.')
        const data = parseMasterExcel(wb)
        setMasterData(data)
        setMasterFileName(file.name)
      } catch (err) {
        alert('파일 등록 실패: ' + (err as Error).message +
          '\n\n지원 형식: xlsx, xls, xlsm, csv, ods')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  /* ── PDF 텍스트 추출 ── */
  const extractPdf = useCallback(async (file: File): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib = (window as any).pdfjsLib
    if (!pdfjsLib) throw new Error('PDF.js 로드 중')
    const buf  = await file.arrayBuffer()
    const pdf  = await pdfjsLib.getDocument({ data: buf }).promise
    let text   = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i)
      const content = await page.getTextContent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text += content.items.map((it: any) => it.str).join(' ') + '\n'
    }
    return text
  }, [])

  const extractExcel = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array', raw: false })
          let text = ''
          for (const sheetName of wb.SheetNames) {
            const rows = XLSX.utils.sheet_to_json<(string | null)[]>(
              wb.Sheets[sheetName], { header: 1, defval: null, raw: false }
            )
            text += `[시트: ${sheetName}]\n`
            for (const row of rows) {
              const cells = (row as (string | null)[]).filter(c => c != null && String(c).trim())
              if (cells.length) text += cells.join('\t') + '\n'
            }
            text += '\n'
          }
          resolve(text)
        } catch (err) { reject(err) }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }, [])

  const extractText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file, 'utf-8')
    })
  }, [])

  /* ── 검수 파일 추가 ── */
  const handleChecks = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (pendingFiles.find(f => f.name === file.name)) continue
      const id = `f_${Date.now()}_${Math.random().toString(36).slice(2)}`
      setPendingFiles(prev => [...prev, { id, name: file.name, status: 'loading' }])
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
        let raw = ''
        if (ext === 'pdf') {
          raw = await extractPdf(file)
          if (!raw || raw.trim().length < 80) {
            setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'image-pdf' } : f))
            continue
          }
        } else if (['xlsx','xls','xlsm','xlsb','csv','ods'].includes(ext)) {
          raw = await extractExcel(file)
        } else {
          raw = await extractText(file)
        }
        const text = cleanText(raw)
        if (!text || text.trim().length < 10) {
          setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error' } : f))
        } else {
          setPendingFiles(prev => prev.map(f =>
            f.id === id ? { ...f, status: 'ready', chars: text.trim().length } : f
          ))
          setCheckFiles(prev => [...prev, { id, name: file.name, text }])
        }
      } catch {
        setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error' } : f))
      }
    }
    if (checkInputRef.current) checkInputRef.current.value = ''
  }, [pendingFiles, extractPdf, extractExcel, extractText])

  const removeFile = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id))
    setCheckFiles(prev => prev.filter(f => f.id !== id))
  }

  /* ── Gemini API 호출 ── */
  const callGemini = async (fileName: string, text: string): Promise<{ issues: Issue[] }> => {
    const prompt = buildPrompt(masterData, fileName, trimText(text))
    const res    = await fetch('/api/pm-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    try { return JSON.parse(raw) }
    catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) return JSON.parse(m[0])
      throw new Error('응답 파싱 실패')
    }
  }

  /* ── 검수 실행 ── */
  const runCheck = async () => {
    if (!Object.keys(masterData).length) return alert('마스터 데이터를 먼저 등록해주세요.')
    if (!checkFiles.length) return alert('검수할 파일을 추가해주세요.')
    const hasPdf = checkFiles.some(f => f.name.toLowerCase().endsWith('.pdf'))
    if (hasPdf && !pdfjsReady) return alert('PDF.js 로딩 중입니다. 잠시 후 다시 시도해주세요.')

    setIsRunning(true)
    const issues: Issue[] = []
    try {
      for (const f of checkFiles) {
        setRunStatus(`${f.name} 검수 중…`)
        const result = await callGemini(f.name, f.text)
        for (const issue of result.issues || []) {
          issues.push({ ...issue, _file: f.name })
        }
      }
      setAllIssues(issues)
      setDisplayIssues(issues)
      setFilterType('전체')
      setShowResults(true)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      saveHistory(issues)
      // 검수 완료 후 입력 초기화
      resetInputs()
    } catch (err) {
      alert('검수 오류: ' + (err as Error).message)
    } finally {
      setIsRunning(false)
      setRunStatus('')
    }
  }

  /* ── 초기화 ── */
  const resetInputs = () => {
    setMasterData({})
    setMasterFileName('')
    setPendingFiles([])
    setCheckFiles([])
    if (masterInputRef.current) masterInputRef.current.value = ''
    if (checkInputRef.current) checkInputRef.current.value = ''
  }

  /* ── 필터 ── */
  const applyFilter = (type: string) => {
    setFilterType(type)
    setDisplayIssues(type === '전체' ? allIssues : allIssues.filter(i => i.type === type))
  }

  /* ── 기록 저장 ── */
  const saveHistory = (issues: Issue[]) => {
    const prev = loadHistory()
    const record: HistoryRecord = {
      id: Date.now(),
      date: new Date().toLocaleString('ko-KR'),
      files: checkFiles.map(f => f.name),
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      issues,
    }
    const next = [record, ...prev].slice(0, 50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    setHistory(next)
  }

  const loadHistory = (): HistoryRecord[] => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
  }

  const deleteHistory = (id: number) => {
    const next = history.filter(r => r.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    setHistory(next)
  }

  const clearAllHistory = () => {
    if (!confirm('모든 검수 기록을 삭제할까요?')) return
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
  }

  const loadRecord = (record: HistoryRecord) => {
    setAllIssues(record.issues)
    setDisplayIssues(record.issues)
    setFilterType('전체')
    setShowResults(true)
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  /* ── 파생 값 ── */
  const errors   = allIssues.filter(i => i.severity === 'error').length
  const warnings = allIssues.filter(i => i.severity === 'warning').length
  const types    = ['전체', ...Array.from(new Set(allIssues.map(i => i.type).filter(Boolean)))]
  const masterCount = Object.values(masterData).filter(Boolean).length

  /* ══ 렌더 ══ */
  return (
    <>
      <style>{CSS}</style>

      <div className="pc-container">

        {/* ── Step 1: 마스터 ── */}
        <div className="pc-card">
          <div className="pc-card-header">
            <div className={`pc-step ${masterCount > 0 ? 'done' : 'active'}`}>
              {masterCount > 0 ? '✓' : '1'}
            </div>
            <h2 className="pc-card-title">마스터 데이터 등록</h2>
            <span className="pc-hint">
              {masterCount > 0 ? `✅ ${masterFileName} — ${masterCount}개 필드` : 'Excel 파일'}
            </span>
          </div>
          <div className="pc-card-body">
            <div
              className={`pc-drop ${masterCount > 0 ? 'has-file' : ''}`}
              onClick={() => masterInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.classList.remove('drag-over')
                const f = e.dataTransfer.files[0]
                if (f) handleMaster(f)
              }}
            >
              <div className="pc-drop-icon">{masterCount > 0 ? '✅' : '📊'}</div>
              <div className="pc-drop-title">
                {masterCount > 0 ? masterFileName : '마스터 Excel 파일 드롭 또는 클릭'}
              </div>
              <div className="pc-drop-sub">
                {masterCount > 0 ? '클릭하여 변경' : 'xlsx, xls, xlsm, csv, ods · 파일명 제한 없음'}
              </div>
            </div>
            <input
              ref={masterInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleMaster(f) }}
            />

            {masterCount > 0 && (
              <div className="pc-preview">
                <h3 className="pc-preview-title">추출된 마스터 데이터 — {masterCount}개 필드</h3>
                <div className="pc-preview-grid">
                  {Object.entries(masterData).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="pc-preview-item">
                      <span className="pc-preview-key">{k}</span>
                      <span className="pc-preview-val">{v.length > 45 ? v.slice(0, 45) + '…' : v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Step 2: 검수 파일 ── */}
        <div className="pc-card">
          <div className="pc-card-header">
            <div className={`pc-step ${checkFiles.length > 0 ? 'done' : ''}`}>
              {checkFiles.length > 0 ? '✓' : '2'}
            </div>
            <h2 className="pc-card-title">검수 파일 등록</h2>
            <span className="pc-hint">PDF · Excel · 텍스트 파일 · 여러 파일 추가 가능</span>
          </div>
          <div className="pc-card-body">
            <div className="pc-files-grid">
              {pendingFiles.map(f => (
                <div key={f.id} className={`pc-file-card ${f.status === 'image-pdf' || f.status === 'error' ? 'bad' : ''}`}>
                  <button className="pc-file-remove" onClick={() => removeFile(f.id)}>×</button>
                  <div className="pc-file-icon">📄</div>
                  <div className="pc-file-name">{f.name}</div>
                  <div className={`pc-file-status ${f.status === 'loading' ? 'loading' : f.status !== 'ready' ? 'error' : ''}`}>
                    {f.status === 'loading' && '⏳ 텍스트 추출 중…'}
                    {f.status === 'ready'   && `✅ 추출 완료 (${f.chars?.toLocaleString()}자)`}
                    {f.status === 'image-pdf' && '⚠️ 이미지형 PDF — 추출 불가'}
                    {f.status === 'error'   && '❌ 파싱 오류'}
                  </div>
                </div>
              ))}
              <div className="pc-add-card" onClick={() => checkInputRef.current?.click()}>
                <div className="pc-add-plus">+</div>
                <div className="pc-add-label">파일 추가</div>
              </div>
            </div>
            <input
              ref={checkInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.txt,.md,.tsv"
              multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files) handleChecks(e.target.files) }}
            />
          </div>
        </div>

        {/* ── Run ── */}
        <div className="pc-run-wrap">
          <div className="pc-model-wrap">
            <label className="pc-model-label">모델</label>
            <select className="pc-model-select" value={model} onChange={e => setModel(e.target.value)}>
              <option value="gemini-2.5-flash">gemini-2.5-flash ✨</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
            </select>
          </div>
          <button className="pc-run-btn" disabled={isRunning} onClick={runCheck}>
            {isRunning ? (
              <><span className="pc-spinner" />{runStatus || '검수 중…'}</>
            ) : '🔍 검수 시작'}
          </button>
        </div>

        {/* ── 결과 ── */}
        {showResults && (
          <div className="pc-card" ref={resultsRef}>
            <div className="pc-card-header">
              <div className="pc-step done">✓</div>
              <h2 className="pc-card-title">검수 결과</h2>
              <span className="pc-hint">{checkFiles.length}개 파일 검수 완료</span>
              <button className="pc-new-btn" onClick={() => { setShowResults(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                + 새 검수
              </button>
            </div>
            <div className="pc-card-body">
              {/* 요약 */}
              <div className="pc-summary-row">
                <span className="pc-chip total">전체 {allIssues.length}건</span>
                <span className="pc-chip error">🔴 오류 {errors}건</span>
                <span className="pc-chip warning">🟡 경고 {warnings}건</span>
                <span className="pc-chip pass">📄 파일 {checkFiles.length}개</span>
              </div>
              {/* 필터 */}
              <div className="pc-filter-row">
                {types.map(t => (
                  <button
                    key={t}
                    className={`pc-filter-btn ${filterType === t ? 'active' : ''}`}
                    onClick={() => applyFilter(t)}
                  >{t}</button>
                ))}
              </div>
              {/* 테이블 */}
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>심각도</th><th>유형</th><th>위치 / 파일</th>
                      <th>마스터 기준</th><th>검수 파일 내용</th><th>설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayIssues.length === 0 ? (
                      <tr><td colSpan={6} className="pc-empty">✅ 이슈가 없습니다.</td></tr>
                    ) : displayIssues.map((issue, i) => (
                      <tr key={i}>
                        <td>
                          <span className={`pc-sev ${issue.severity}`}>
                            {issue.severity === 'error' ? '🔴 오류' : '🟡 경고'}
                          </span>
                        </td>
                        <td><span className="pc-type">{issue.type}</span></td>
                        <td>
                          <div>{issue.location}</div>
                          <div className="pc-file-ref">{issue._file}</div>
                        </td>
                        <td className="pc-val-master">{issue.master || '—'}</td>
                        <td className="pc-val-found">{issue.found || <span className="pc-none">누락</span>}</td>
                        <td className="pc-desc">{issue.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 검수 기록 ── */}
        {history.length > 0 && (
          <div className="pc-card">
            <div className="pc-card-header">
              <span style={{ fontSize: 16 }}>🗂</span>
              <h2 className="pc-card-title">검수 기록</h2>
              <span className="pc-hint">{history.length}건 저장됨</span>
              <button className="pc-clear-btn" onClick={clearAllHistory}>전체 삭제</button>
            </div>
            <div className="pc-card-body">
              {history.map(r => (
                <div key={r.id} className="pc-history-item" onClick={() => loadRecord(r)}>
                  <div className="pc-hi-icon">📋</div>
                  <div className="pc-hi-info">
                    <div className="pc-hi-title">{r.files.join(', ')}</div>
                    <div className="pc-hi-meta">{r.date}</div>
                  </div>
                  <div className="pc-hi-badges">
                    {r.errors   > 0 && <span className="pc-hi-err">🔴 오류 {r.errors}건</span>}
                    {r.warnings > 0 && <span className="pc-hi-warn">🟡 경고 {r.warnings}건</span>}
                    {!r.errors && !r.warnings && <span className="pc-hi-ok">✅ 이상없음</span>}
                  </div>
                  <button
                    className="pc-hi-del"
                    onClick={e => { e.stopPropagation(); deleteHistory(r.id) }}
                  >삭제</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}

/* ══ CSS ══ */
const CSS = `
.pc-container { max-width: 960px; margin: 0 auto; padding: 28px 20px; }

.pc-card { background:#fff; border-radius:12px; border:1px solid #e5e7eb; margin-bottom:16px; overflow:hidden; }
.pc-card-header { padding:14px 22px; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; gap:10px; }
.pc-card-title { font-size:14px; font-weight:600; color:#111; }
.pc-hint { font-size:12px; color:#9ca3af; margin-left:auto; }
.pc-card-body { padding:18px 22px; }

.pc-step { width:22px; height:22px; border-radius:50%; background:#e5e7eb; color:#6b7280; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pc-step.active { background:#3b82f6; color:#fff; }
.pc-step.done { background:#10b981; color:#fff; }

.pc-drop { border:2px dashed #d1d5db; border-radius:10px; padding:28px; text-align:center; cursor:pointer; transition:all .15s; user-select:none; }
.pc-drop:hover,.pc-drop.drag-over { border-color:#3b82f6; background:#eff6ff; }
.pc-drop.has-file { border-color:#10b981; background:#f0fdf4; }
.pc-drop-icon { font-size:30px; margin-bottom:6px; }
.pc-drop-title { font-size:14px; font-weight:500; color:#374151; }
.pc-drop-sub { font-size:12px; color:#9ca3af; margin-top:3px; }

.pc-preview { margin-top:14px; background:#f9fafb; border:1px solid #f3f4f6; border-radius:10px; padding:14px 16px; }
.pc-preview-title { font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
.pc-preview-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; }
.pc-preview-item { display:flex; gap:8px; align-items:flex-start; font-size:12px; }
.pc-preview-key { color:#9ca3af; min-width:110px; flex-shrink:0; }
.pc-preview-val { color:#111; font-weight:500; word-break:break-all; }

.pc-files-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; }
.pc-file-card { border:1px solid #e5e7eb; border-radius:10px; padding:14px; position:relative; min-height:90px; }
.pc-file-card.bad { border-color:#fca5a5; background:#fff5f5; }
.pc-file-icon { font-size:22px; margin-bottom:6px; }
.pc-file-name { font-size:12px; font-weight:500; color:#111; word-break:break-all; margin-bottom:4px; }
.pc-file-status { font-size:11px; color:#10b981; }
.pc-file-status.loading { color:#f59e0b; }
.pc-file-status.error { color:#ef4444; }
.pc-file-remove { position:absolute; top:8px; right:10px; background:none; border:none; cursor:pointer; color:#d1d5db; font-size:18px; line-height:1; padding:0; }
.pc-file-remove:hover { color:#ef4444; }
.pc-add-card { border:2px dashed #d1d5db; border-radius:10px; min-height:90px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; color:#9ca3af; transition:all .15s; gap:4px; }
.pc-add-card:hover { border-color:#3b82f6; color:#3b82f6; background:#eff6ff; }
.pc-add-plus { font-size:26px; font-weight:300; line-height:1; }
.pc-add-label { font-size:12px; }

.pc-run-wrap { display:flex; align-items:center; justify-content:center; gap:16px; margin:4px 0 20px; flex-wrap:wrap; }
.pc-model-wrap { display:flex; align-items:center; gap:8px; }
.pc-model-label { font-size:12px; color:#6b7280; }
.pc-model-select { font-size:12px; padding:6px 10px; border-radius:8px; border:1px solid #e5e7eb; background:#fff; color:#374151; cursor:pointer; outline:none; }
.pc-run-btn { background:#111; color:#fff; border:none; padding:12px 36px; border-radius:999px; font-size:14px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:background .2s; }
.pc-run-btn:hover { background:#1d4ed8; }
.pc-run-btn:disabled { background:#9ca3af; cursor:not-allowed; }
.pc-spinner { width:15px; height:15px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:pc-spin .7s linear infinite; flex-shrink:0; }
@keyframes pc-spin { to { transform:rotate(360deg); } }

.pc-summary-row { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
.pc-chip { padding:6px 14px; border-radius:8px; font-size:13px; font-weight:600; }
.pc-chip.total { background:#f3f4f6; color:#374151; }
.pc-chip.error { background:#fee2e2; color:#991b1b; }
.pc-chip.warning { background:#fef3c7; color:#92400e; }
.pc-chip.pass { background:#d1fae5; color:#065f46; }

.pc-filter-row { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap; }
.pc-filter-btn { padding:4px 12px; border-radius:999px; border:1px solid #e5e7eb; background:#fff; font-size:12px; cursor:pointer; color:#374151; transition:all .15s; }
.pc-filter-btn.active { background:#111; color:#fff; border-color:#111; }

.pc-table-wrap { overflow-x:auto; }
.pc-table { width:100%; border-collapse:collapse; font-size:13px; }
.pc-table th { background:#f9fafb; padding:9px 12px; text-align:left; font-weight:600; color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:.4px; border-bottom:1px solid #e5e7eb; white-space:nowrap; }
.pc-table td { padding:10px 12px; border-bottom:1px solid #f3f4f6; vertical-align:top; line-height:1.5; }
.pc-table tr:last-child td { border-bottom:none; }
.pc-table tr:hover td { background:#fafafa; }
.pc-empty { text-align:center; padding:40px!important; color:#9ca3af; }

.pc-sev { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; white-space:nowrap; }
.pc-sev.error { background:#fee2e2; color:#991b1b; }
.pc-sev.warning { background:#fef3c7; color:#92400e; }
.pc-type { display:inline-block; padding:1px 7px; border-radius:4px; font-size:11px; background:#f3f4f6; color:#374151; font-weight:500; }
.pc-file-ref { font-size:11px; color:#9ca3af; margin-top:2px; }
.pc-val-master { color:#374151; }
.pc-val-found { color:#dc2626; }
.pc-none { color:#9ca3af; font-style:italic; }
.pc-desc { color:#374151; font-size:12px; }

.pc-history-item { display:flex; align-items:center; gap:14px; padding:12px 14px; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:8px; cursor:pointer; transition:background .15s; }
.pc-history-item:hover { background:#f9fafb; }
.pc-history-item:last-child { margin-bottom:0; }
.pc-hi-icon { font-size:20px; flex-shrink:0; }
.pc-hi-info { flex:1; min-width:0; }
.pc-hi-title { font-size:13px; font-weight:600; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pc-hi-meta { font-size:11px; color:#9ca3af; margin-top:2px; }
.pc-hi-badges { display:flex; gap:6px; flex-shrink:0; align-items:center; }
.pc-hi-err { background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; }
.pc-hi-warn { background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; }
.pc-hi-ok { font-size:12px; color:#10b981; }
.pc-hi-del { background:none; border:1px solid #e5e7eb; border-radius:6px; padding:4px 10px; font-size:12px; color:#9ca3af; cursor:pointer; flex-shrink:0; }
.pc-hi-del:hover { border-color:#fca5a5; color:#dc2626; background:#fff5f5; }
.pc-clear-btn { margin-left:auto; padding:4px 12px; border-radius:6px; border:1px solid #fca5a5; background:#fff5f5; color:#dc2626; font-size:12px; cursor:pointer; }
.pc-new-btn { margin-left:auto; padding:5px 14px; border-radius:6px; border:1px solid #3b82f6; background:#eff6ff; color:#2563eb; font-size:12px; font-weight:600; cursor:pointer; }
.pc-new-btn:hover { background:#dbeafe; }
`
