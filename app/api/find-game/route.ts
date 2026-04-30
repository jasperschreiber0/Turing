import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { codename } = await req.json().catch(() => ({}))
  if (!codename) return NextResponse.json({ error: 'codename required' }, { status: 400 })

  const supabase = db()

  // Find a waiting room with fewer than 4 human players
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, code')
    .eq('status', 'waiting')
    .eq('topic', 'freeplay')
    .order('created_at', { ascending: true })
    .limit(10)

  let targetRoom = null

  for (const room of (rooms ?? [])) {
    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('is_ai', false)
    if ((count ?? 0) < 4) {
      targetRoom = room
      break
    }
  }

  // No room found — create one
  if (!targetRoom) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: season } = await supabase
      .from('seasons').select('id').eq('is_active', true).maybeSingle()
    const { data: created, error } = await supabase
      .from('rooms')
      .insert({ code, topic: 'freeplay', ai_codename: 'MERIDIAN', status: 'waiting', season_id: season?.id ?? null, max_players: 4 })
      .select('id, code').single()
    if (error || !created) return NextResponse.json({ error: 'Could not create room' }, { status: 500 })
    targetRoom = created
  }

  // Join the room
  await supabase.from('room_players').upsert(
    { room_id: targetRoom.id, player_id: null, codename, role: 'detector', is_ai: false },
    { onConflict: 'room_id,codename' }
  )

  return NextResponse.json({ code: targetRoom.code })
}
