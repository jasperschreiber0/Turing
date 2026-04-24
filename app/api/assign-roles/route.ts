// POST /api/assign-roles  body: { roomId }
// Assigns roles to all players in the room and returns the full assignment.
// Idempotent: if any human player already has a non-default role, returns existing.
//
// Role pool (for N total players):
//   - Bot (is_ai=true) always receives 'ai'
//   - Humans receive: 1 'sleeper' + (N_humans - 1) 'detector' roles, shuffled
//
// Response includes ai_codename for the sleeper so the frontend can surface it.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const { roomId } = await req.json().catch(() => ({}))
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const supabase = db()

  const { data: room } = await supabase
    .from('rooms')
    .select('id, ai_codename, status')
    .eq('id', roomId)
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const { data: allPlayers } = await supabase
    .from('room_players')
    .select('id, codename, role, is_ai, player_id')
    .eq('room_id', roomId)

  const players      = allPlayers ?? []
  const botPlayer    = players.find(p => p.is_ai)
  const humanPlayers = players.filter(p => !p.is_ai)

  // ── Idempotency: already assigned if any human has a non-default role ─
  const alreadyAssigned = humanPlayers.some(p => p.role !== 'detector')
  if (alreadyAssigned) {
    const sleeperCodename = humanPlayers.find(p => p.role === 'sleeper')?.codename ?? null
    return NextResponse.json({
      ok:          true,
      alreadyDone: true,
      aiCodename:  room.ai_codename,
      assignments: players.map(p => ({
        codename:   p.codename,
        role:       p.role,
        ...(p.role === 'sleeper' ? { ai_codename: room.ai_codename } : {}),
      })),
      sleeperCodename,
    })
  }

  // ── Build human role pool: 1 sleeper + rest detectors ────────────
  const humanCount = humanPlayers.length
  const humanRoles = shuffle([
    'sleeper',
    ...Array(Math.max(0, humanCount - 1)).fill('detector'),
  ])

  // ── Apply role updates ────────────────────────────────────────────
  if (botPlayer) {
    await supabase.from('room_players').update({ role: 'ai' }).eq('id', botPlayer.id)
  }

  for (let i = 0; i < humanPlayers.length; i++) {
    await supabase.from('room_players').update({ role: humanRoles[i] }).eq('id', humanPlayers[i].id)
  }

  // ── Build response ────────────────────────────────────────────────
  const sleeperCodename = humanPlayers[humanRoles.indexOf('sleeper')]?.codename ?? null

  const assignments = [
    ...(botPlayer ? [{ codename: botPlayer.codename, role: 'ai' }] : []),
    ...humanPlayers.map((p, i) => ({
      codename: p.codename,
      role:     humanRoles[i],
      ...(humanRoles[i] === 'sleeper' ? { ai_codename: room.ai_codename } : {}),
    })),
  ]

  return NextResponse.json({
    ok:             true,
    aiCodename:     room.ai_codename,
    sleeperCodename,
    assignments,
  })
}
