/**
 * REMC 스케줄러 연동 API Route
 *
 * POST /api/remc-notify
 * - REMC_INTEGRATION_ENABLED=false 이면 즉시 200 반환 (아무것도 안 함)
 * - 활성화 시: 담당자 이메일로 Firebase UID 조회 → 개인업무 추가 + 알림 전송
 */

import { NextRequest, NextResponse } from 'next/server'

// ── 플래그 확인 ────────────────────────────────────────────────
const ENABLED = process.env.REMC_INTEGRATION_ENABLED === 'true'

// ── Firebase Admin 초기화 (활성화 시에만) ─────────────────────
let db: any = null

async function getFirestore() {
  if (!ENABLED) return null
  if (db) return db

  // 활성화 시: npm install firebase-admin
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require('firebase-admin') as any
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
    }
    db = admin.firestore()
    return db
  } catch (e) {
    console.error('[REMC 연동] Firebase Admin 초기화 실패:', e)
    return null
  }
}

// ── 날짜 유틸 ──────────────────────────────────────────────────
function getTodayStr(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)  // YYYY-MM-DD
}

// ── 핸들러 ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 비활성화 상태면 조용히 성공 반환
  if (!ENABLED) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'integration disabled' })
  }

  const firestore = await getFirestore()
  if (!firestore) {
    return NextResponse.json({ ok: false, error: 'firestore init failed' }, { status: 500 })
  }

  try {
    const { assigneeEmail, title, body, projectId, date } = await req.json()

    if (!assigneeEmail || !title) {
      return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 })
    }

    // 1) 이메일로 Firebase UID 조회
    const usersSnap = await firestore
      .collection('users')
      .where('email', '==', assigneeEmail)
      .limit(1)
      .get()

    if (usersSnap.empty) {
      console.warn(`[REMC 연동] Firebase 사용자 없음: ${assigneeEmail}`)
      return NextResponse.json({ ok: false, error: 'user not found in REMC scheduler' })
    }

    const uid = usersSnap.docs[0].id
    const dateStr = getTodayStr(date)

    // 2) 개인업무 추가 (personal/{uid}/days/{date})
    const personalRef = firestore.doc(`personal/${uid}/days/${dateStr}`)
    const personalSnap = await personalRef.get()
    const existingTasks: any[] = personalSnap.exists ? (personalSnap.data()?.tasks ?? []) : []
    const counter: number = personalSnap.exists ? (personalSnap.data()?.counter ?? 0) : 0

    const newTask = {
      id:         counter + 1,
      text:       title,
      note:       body,
      done:       false,
      priority:   'high',
      assignedBy: 'inkey-system',
      source:     'inkey',          // 인키에서 자동 생성된 업무 표시용
      projectId,
      createdAt:  new Date().toISOString(),
    }

    await personalRef.set({
      tasks:     [...existingTasks, newTask],
      counter:   counter + 1,
      updatedAt: new Date(),
    }, { merge: true })

    // 3) 알림 추가 (notifications/{uid}/unread)
    await firestore.collection(`notifications/${uid}/unread`).add({
      type:      'task_assigned',
      title,
      body,
      source:    'inkey',
      projectId,
      read:      false,
      createdAt: new Date(),
    })

    return NextResponse.json({ ok: true, uid, dateStr })

  } catch (e: any) {
    console.error('[REMC 연동] 처리 오류:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
