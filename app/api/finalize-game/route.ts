// POST /api/finalize-game  body: { roomId }
// Called when all votes are in. Creates session, generates grudge message,
// inserts grudge_log, and transitions room → reveal.
// Idempotent: if session already exists, returns existing reveal data.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { generateGrudgeMessage }     from '@/services/ai-agent/grudge'

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

  // ── Load room ────────────────────────────────────────────────
  const { data: room } = await supabase
    .from('rooms')
    .select('id, season_id, ai_codename, topic, current_round, status')
    .eq('id', roomId)
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  // ── Idempotency: return existing reveal data if already finalized ─────
  if (['reveal', 'complete'].includes(room.status)) {
    const { data: existing } = await supabase
      .from('sessions').select('id, ai_was_caught').eq('room_id', roomId).maybeSingle()
    const { data: grudge } = existing
      ? await supabase.from('grudge_log').select('message').eq('session_id', existing.id).maybeSingle()
      : { data: null }
    const { data: allVotes } = await supabase
      .from('votes').select('voted_codename, is_correct').eq('room_id', roomId)
    return NextResponse.json({
      ok:            true,
      alreadyDone:   true,
      sessionId:     existing?.id ?? null,
      aiCaught:      existing?.ai_was_caught ?? false,
      grudgeMessage: grudge?.message ?? null,
      correctCount:  allVotes?.filter(v => v.is_correct).length ?? 0,
      totalVotes:    allVotes?.length ?? 0,
    })
  }

  // ── Load players and votes ───────────────────────────────────
  const { data: players } = await supabase
    .from('room_players').select('codename, is_ai, player_id').eq('room_id', roomId)

  const { data: votes } = await supabase
    .from('votes').select('voted_codename, is_correct').eq('room_id', roomId)

  const humanPlayers  = (players ?? []).filter(p => !p.is_ai)
  const humanCount    = humanPlayers.length
  const allCodenames  = humanPlayers.map(p => p.codename)
  const aiCaught      = (votes ?? []).some(v => v.voted_codename === room.ai_codename)
  const correctCount  = (votes ?? []).filter(v => v.voted_codename === room.ai_codename).length

  // ── Mark is_correct on votes ─────────────────────────────────
  await supabase
    .from('votes')
    .update({ is_correct: true })
    .eq('room_id', roomId)
    .eq('voted_codename', room.ai_codename)

  await supabase
    .from('votes')
    .update({ is_correct: false })
    .eq('room_id', roomId)
    .neq('voted_codename', room.ai_codename)

  // ── Get current strategy version ─────────────────────────────
  const { data: strategy } = await supabase
    .from('ai_strategy').select('version').eq('season_id', room.season_id).maybeSingle()

  // ── Create session ───────────────────────────────────────────
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({
      room_id:             roomId,
      season_id:           room.season_id,
      ai_codename:         room.ai_codename,
      topic:               room.topic,
      ai_was_caught:       aiCaught,
      rounds_survived:     room.current_round ?? 1,
      total_players:       humanCount,
      correct_voters:      correctCount,
      ai_strategy_version: strategy?.version ?? 1,
    })
    .select('id')
    .single()

  if (sessionErr) {
    console.error('[finalize-game] session insert error:', sessionErr.message)
    return NextResponse.json({ error: sessionErr.message }, { status: 500 })
  }

  // ── Generate grudge message ───────────────────────────────────
  // Voter attribution requires voter_codename column (not yet in schema).
  // catcherCodename is null until auth + schema migration adds voter identity.
  let grudgeMessage = ''
  try {
    grudgeMessage = await generateGrudgeMessage(
      { ai_codename: room.ai_codename, ai_was_caught: aiCaught, rounds_survived: room.current_round ?? 1 },
      null,         // TODO: catcher codename once voter attribution is available
      allCodenames,
    )
  } catch (err) {
    console.error('[finalize-game] grudge generation error:', err)
    grudgeMessage = `well. that was something.`
  }

  // ── Insert grudge_log ────────────────────────────────────────
  await supabase.from('grudge_log').insert({
    session_id:    session.id,
    season_id:     room.season_id,
    ai_codename:   room.ai_codename,
    target_codename: null,
    message:         grudgeMessage,
    ai_was_caught:   aiCaught,
  })

  // ── Queue lesson extraction ───────────────────────────────────
  await supabase.from('extraction_queue').insert({
    session_id: session.id,
    season_id:  room.season_id,
    priority:   'high',
  })

  // ── Transition room → reveal ──────────────────────────────────
  await supabase
    .from('rooms')
    .update({ status: 'reveal', completed_at: new Date().toISOString() })
    .eq('id', roomId)

  return NextResponse.json({
    ok:           true,
    sessionId:    session.id,
    aiCaught,
    correctCount,
    totalVotes:   (votes ?? []).length,
    grudgeMessage,
  })
}
