// POST /api/start-voting  body: { roomId }
// Called when the round timer hits zero. Transitions room active → voting.
// Idempotent: multiple clients may race to call this; only the first write wins.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { roomId } = await req.json().catch(() => ({}))
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const supabase = db()

  // Only transition from 'active' — already-voting rooms return 200 silently
  const { data: room } = await supabase
    .from('rooms').select('status').eq('id', roomId).single()

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.status !== 'active') return NextResponse.json({ ok: true, alreadyTransitioned: true })

  const { error } = await supabase
    .from('rooms')
    .update({ status: 'voting' })
    .eq('id', roomId)
    .eq('status', 'active') // extra guard against race: only updates if still active

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
