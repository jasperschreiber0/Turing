// POST /api/finalize-game  body: { roomId }
// Called when all votes are in. Creates session, generates grudge messages,
// inserts grudge_log rows, and transitions room → reveal.
// Idempotent: if session already exists, returns existing reveal data.
//
// Win conditions (majority/plurality vote):
//   - Most votes land on AI codename → Detectors win (ai_was_caught = true)
//   - Most votes land on someone else → AI + Sleeper win (ai_was_caught = false)
//   - Ties are resolved in the AI's favour (AI survives)

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
    const { data: grudges } = existing
      ? await supabase.from('grudge_log').select('message, type').eq('session_id', existing.id)
      : { data: null }
    const { data: allVotes } = await supabase
      .from('votes').select('voted_codename, is_correct').eq('room_id', roomId)
    const catcherGrudge = grudges?.find(g => g.type === 'catcher' || !g.type)?.message ?? null
    const sleeperGrudge = grudges?.find(g => g.type === 'sleeper')?.message ?? null
    return NextResponse.json({
      ok:            true,
      alreadyDone:   true,
      sessionId:     existing?.id ?? null,
      aiCaught:      existing?.ai_was_caught ?? false,
      grudgeMessage: catcherGrudge,
      sleeperGrudge,
      correctCount:  allVotes?.filter(v => v.is_correct).length ?? 0,
      totalVotes:    allVotes?.length ?? 0,
    })
  }

  // ── Load players and votes ───────────────────────────────────
  const { data: players } = await supabase
    .from('room_players').select('codename, is_ai, player_id, role').eq('room_id', roomId)

  const { data: votes } = await supabase
    .from('votes').select('voted_codename, is_correct').eq('room_id', roomId)

  const humanPlayers    = (players ?? []).filter(p => !p.is_ai)
  const humanCount      = humanPlayers.length
  const allCodenames    = humanPlayers.map(p => p.codename)
  const sleeperCodename = humanPlayers.find(p => p.role === 'sleeper')?.codename ?? null

  // ── Majority/plurality vote resolution ───────────────────────
  // Count votes per codename; AI survives on a tie.
  const voteCounts = new Map<string, number>()
  for (const v of votes ?? []) {
    voteCounts.set(v.voted_codename, (voteCounts.get(v.voted_codename) ?? 0) + 1)
  }

  let topCodename = ''
  let topCount    = 0
  for (const [codename, count] of voteCounts) {
    if (count > topCount) {
      topCount    = count
      topCodename = codename
    }
  }

  const aiCaught    = topCount > 0 && topCodename === room.ai_codename
  const correctCount = (votes ?? []).filter(v => v.voted_codename === room.ai_codename).length

  // ── Mark is_correct on individual votes (regardless of outcome) ─
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

  // ── Generate grudge messages ──────────────────────────────────
  // 1. Catcher grudge (standard — addresses whoever voted correctly, or general)
  // 2. Sleeper grudge (sleeper's cover is blown at reveal — always generated)
  const sessionMeta = {
    ai_codename:     room.ai_codename,
    ai_was_caught:   aiCaught,
    rounds_survived: room.current_round ?? 1,
  }

  let catcherGrudge = ''
  let sleeperGrudge = ''

  try {
    catcherGrudge = await generateGrudgeMessage(sessionMeta, null, allCodenames)
  } catch (err) {
    console.error('[finalize-game] catcher grudge error:', err)
    catcherGrudge = 'well. that was something.'
  }

  if (sleeperCodename) {
    try {
      const nonSleeperCodenames = allCodenames.filter(c => c !== sleeperCodename)
      sleeperGrudge = await generateGrudgeMessage(
        sessionMeta,
        sleeperCodename,
        nonSleeperCodenames,
        `This message is directed specifically at the sleeper agent ${sleeperCodename}, whose allegiance to the AI has just been revealed to everyone. Context: their cover was blown at the end of the game.`,
      )
    } catch (err) {
      console.error('[finalize-game] sleeper grudge error:', err)
      sleeperGrudge = `${sleeperCodename}. you knew.`
    }
  }

  // ── Insert grudge_log rows ────────────────────────────────────
  const grudgeInserts = [
    {
      session_id:      session.id,
      season_id:       room.season_id,
      ai_codename:     room.ai_codename,
      target_codename: null,
      message:         catcherGrudge,
      ai_was_caught:   aiCaught,
      type:            'catcher',
    },
  ]

  if (sleeperCodename && sleeperGrudge) {
    grudgeInserts.push({
      session_id:      session.id,
      season_id:       room.season_id,
      ai_codename:     room.ai_codename,
      target_codename: sleeperCodename,
      message:         sleeperGrudge,
      ai_was_caught:   aiCaught,
      type:            'sleeper',
    })
  }

  await supabase.from('grudge_log').insert(grudgeInserts)

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
    ok:            true,
    sessionId:     session.id,
    aiCaught,
    correctCount,
    totalVotes:    (votes ?? []).length,
    grudgeMessage: catcherGrudge,
    sleeperGrudge: sleeperGrudge || null,
    sleeperCodename,
    // Win team for UI: detectors win if aiCaught, AI+sleeper win otherwise
    winners:       aiCaught ? ['detector'] : ['ai', 'sleeper'],
  })
}
