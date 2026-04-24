// Test endpoint — creates a session for a room and queues lesson extraction.
// POST /api/complete-game  body: { roomCode: "ABC123" }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const roomCode = (body.roomCode as string | undefined)?.toUpperCase()
  if (!roomCode) {
    return NextResponse.json({ error: 'roomCode required' }, { status: 400 })
  }

  const supabase = db()

  const { data: room } = await supabase
    .from('rooms')
    .select('id, season_id, ai_codename, topic, current_round, status')
    .eq('code', roomCode)
    .maybeSingle()

  if (!room) {
    return NextResponse.json({ error: `Room ${roomCode} not found` }, { status: 404 })
  }

  // Don't create a duplicate session
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('room_id', room.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ sessionId: existing.id, existing: true })
  }

  const { data: players } = await supabase
    .from('room_players')
    .select('codename, is_ai')
    .eq('room_id', room.id)

  const humanCount = players?.filter(p => !p.is_ai).length ?? 1

  const { data: votes } = await supabase
    .from('votes')
    .select('voted_codename, is_correct')
    .eq('room_id', room.id)

  const aiCaught     = votes?.some(v => v.is_correct) ?? false
  const correctCount = votes?.filter(v => v.is_correct).length ?? 0

  const { data: strategy } = await supabase
    .from('ai_strategy')
    .select('version')
    .eq('season_id', room.season_id)
    .maybeSingle()

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      room_id:              room.id,
      season_id:            room.season_id,
      ai_codename:          room.ai_codename,
      topic:                room.topic,
      ai_was_caught:        aiCaught,
      rounds_survived:      room.current_round ?? 1,
      total_players:        humanCount,
      correct_voters:       correctCount,
      ai_strategy_version:  strategy?.version ?? 1,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mark room complete
  await supabase
    .from('rooms')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', room.id)

  // Queue extraction (learning service picks this up; orchestrator runs it inline)
  await supabase.from('extraction_queue').insert({
    session_id: session.id,
    season_id:  room.season_id,
    priority:   'normal',
  })

  return NextResponse.json({ sessionId: session.id, aiCaught, correctVoters: correctCount })
}
