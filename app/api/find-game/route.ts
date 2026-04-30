import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TOPICS = [
  "What's the most overrated thing about your city?",
  "Would you rather work from home forever or never again?",
  "What's a hill you'll die on that most people disagree with?",
  "What's something everyone pretends to enjoy but secretly doesn't?",
  "Coffee or tea — and actually defend your answer",
  "What's a life skill most people your age don't have that they should?",
  "What's the worst advice that gets given constantly?",
  "Is it ever okay to ghost someone? Defend your position.",
  "What's something you believed as a kid that turned out to be completely wrong?",
  "What's overrated: travel, homeownership, or university degrees?",
  "What do you actually think about AI — honest answer",
  "What's a food opinion you hold that would start a fight?",
  "Remote work: productivity hack or isolation trap?",
  "What's the most useless thing you were taught in school?",
  "Is hustle culture dead or just rebranded?",
]

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

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, code, topic')
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

  if (!targetRoom) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]
    const { data: season } = await supabase
      .from('seasons').select('id').eq('is_active', true).maybeSingle()
    const { data: created, error } = await supabase
      .from('rooms')
      .insert({ code, topic, ai_codename: 'MERIDIAN', status: 'waiting', season_id: season?.id ?? null, max_players: 4 })
      .select('id, code, topic').single()
    if (error || !created) return NextResponse.json({ error: 'Could not create room' }, { status: 500 })
    targetRoom = created
  }

  await supabase.from('room_players').upsert(
    { room_id: targetRoom.id, player_id: null, codename, role: 'detector', is_ai: false },
    { onConflict: 'room_id,codename' }
  )

  return NextResponse.json({ code: targetRoom.code, topic: targetRoom.topic })
}
