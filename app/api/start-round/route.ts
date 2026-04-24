// POST /api/start-round  body: { roomId }
// Transitions room waiting → active and stamps round_ends_at = now + 3 min.
// Idempotent: re-calling while already active returns the existing round_ends_at.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ROUND_DURATION_MS = 3 * 60 * 1000 // 3 minutes

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { roomId } = await req.json().catch(() => ({}))
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const supabase     = db()
  const roundEndsAt  = new Date(Date.now() + ROUND_DURATION_MS).toISOString()

  // Only transition if still waiting — if already active, return current end time
  const { data: room } = await supabase
    .from('rooms').select('status, round_ends_at').eq('id', roomId).single()

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.status === 'active') {
    return NextResponse.json({ ok: true, roundEndsAt: room.round_ends_at })
  }
  if (!['waiting', 'active'].includes(room.status)) {
    return NextResponse.json({ error: `Cannot start round from status: ${room.status}` }, { status: 409 })
  }

  const { error } = await supabase
    .from('rooms')
    .update({ status: 'active', round_ends_at: roundEndsAt })
    .eq('id', roomId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, roundEndsAt })
}
