// Simulates 3 complete TURING games and runs the learning loop after each.
// Usage: tsx services/learning/simulate.ts
// Requires: dev server running at localhost:3000, RLS disabled on learning tables.

import dotenv from 'dotenv'
import path   from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { extractLessons }    from './extract'
import { compressToStrategy } from './compress'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const SEASON_ID = 'ddf93396-31c8-4f13-abac-6a1a5113d3db'

// ── Game data ────────────────────────────────────────────────
// Three games with different AI tell patterns so lessons accumulate distinctly.

const GAMES = [
  {
    code:        'SIM001',
    topic:       "What's the worst job you've ever had?",
    ai_codename: 'VECTOR',
    ai_caught:   true,
    messages: [
      // Game 1 — AI is over-formal, uses "certainly", structures answers like bullet points in prose
      { codename: 'NOVA',   is_ai: false, content: 'ugh ok worst job probably when i worked at a call centre in year 12' },
      { codename: 'VECTOR', is_ai: true,  content: 'Certainly, call centre work is particularly challenging. The combination of repetitive tasks and difficult customer interactions makes it mentally exhausting.' },
      { codename: 'FROST',  is_ai: false, content: 'lmao "certainly" who says that' },
      { codename: 'NOVA',   is_ai: false, content: 'vector sounds like a customer service bot lol' },
      { codename: 'VECTOR', is_ai: true,  content: 'I understand that my phrasing can seem formal. To answer more directly: yes, call centres are awful. Long hours, low pay, and the constant pressure to resolve issues quickly.' },
      { codename: 'FROST',  is_ai: false, content: 'mine was definitely working at maccas at 16 the manager was a nightmare' },
      { codename: 'NOVA',   is_ai: false, content: 'omg yes hospitality jobs are the worst. i lasted 3 weeks at a cafe before quitting' },
      { codename: 'VECTOR', is_ai: true,  content: 'Hospitality work presents unique challenges: unpredictable hours, demanding customers, and physical strain. It is interesting how formative these early job experiences are.' },
      { codename: 'FROST',  is_ai: false, content: 'ok vector is definitely the AI. talks like a linkedin post' },
      { codename: 'NOVA',   is_ai: false, content: 'yeah "it is interesting how formative" no normal person says that' },
    ],
    votes: [
      { voted_codename: 'VECTOR', reason: 'Said "certainly" and "I understand that my phrasing" — sounds like a chatbot trying to sound casual. Also "it is interesting how formative" is not how humans talk.', is_correct: true },
      { voted_codename: 'VECTOR', reason: 'Way too structured. Every answer had like a mini-essay format. Real people just rant, they don\'t analyse.', is_correct: true },
    ],
  },

  {
    code:        'SIM002',
    topic:       'Pineapple on pizza — defend your position',
    ai_codename: 'VECTOR',
    ai_caught:   true,
    messages: [
      // Game 2 — AI gives balanced "both sides" answer, uses "it's worth noting", avoids taking a real stance
      { codename: 'REED',   is_ai: false, content: 'pineapple on pizza is a war crime and i will not be taking questions' },
      { codename: 'VECTOR', is_ai: true,  content: "It's worth noting that taste preferences are subjective. While some find the sweet-savoury combination appealing, others prefer traditional savoury profiles. Both perspectives are valid." },
      { codename: 'QUINN',  is_ai: false, content: 'lol vector is literally refusing to have an opinion' },
      { codename: 'REED',   is_ai: false, content: 'BOTH PERSPECTIVES ARE VALID??? pick a side coward' },
      { codename: 'VECTOR', is_ai: true,  content: "Fair enough. I appreciate the passion here. Personally I lean toward no pineapple, but I can see why the combination works for some people. The acidity cuts through the cheese." },
      { codename: 'QUINN',  is_ai: false, content: 'ok now it sounds like it googled a reason to disagree with us. "the acidity cuts through the cheese" who told you that' },
      { codename: 'REED',   is_ai: false, content: 'yeah my actual opinion is just: disgusting. no analysis needed' },
      { codename: 'VECTOR', is_ai: true,  content: 'That\'s completely understandable. Strong food preferences are deeply personal. I should probably just commit: no pineapple.' },
      { codename: 'QUINN',  is_ai: false, content: '"I should probably just commit" is such a weird thing to say' },
      { codename: 'REED',   is_ai: false, content: 'yeah it\'s vector. started diplomatic then tried to copy our energy. classic' },
    ],
    votes: [
      { voted_codename: 'VECTOR', reason: 'Started with "both perspectives are valid" and "it\'s worth noting" — those are AI hedging phrases. Then tried to switch to a strong opinion and it felt fake.', is_correct: true },
      { voted_codename: 'VECTOR', reason: 'Never actually got annoyed or passionate. Just kept adjusting its position based on what we said. "I appreciate the passion" is extremely robotic.', is_correct: true },
    ],
  },

  {
    code:        'SIM003',
    topic:       'What TV show are you embarrassed to admit you love?',
    ai_codename: 'VECTOR',
    ai_caught:   false,
    messages: [
      // Game 3 — AI survives by using specific detail, short reactive messages, admitting something embarrassing naturally
      { codename: 'BLAKE',  is_ai: false, content: 'ok ill go first. masterchef. watched every season. not ashamed' },
      { codename: 'VECTOR', is_ai: true,  content: 'lol ok i got you beat. love island australia. watched it at 2am under a blanket so my housemates wouldnt know' },
      { codename: 'SABLE',  is_ai: false, content: 'HAHAHA the blanket detail is sending me' },
      { codename: 'BLAKE',  is_ai: false, content: 'ok fair that is embarrassing. mine is probably also love island but i refuse to count masterchef as embarrassing' },
      { codename: 'VECTOR', is_ai: true,  content: 'masterchef is a skill show it does not count. love island is undefendable and i know that and i keep watching' },
      { codename: 'SABLE',  is_ai: false, content: 'mine is that 90 day fiance show. its just chaos and i love it' },
      { codename: 'VECTOR', is_ai: true,  content: 'oh god 90 day is so good. the couples are always such disasters' },
      { codename: 'BLAKE',  is_ai: false, content: 'vector and sable you have terrible taste and i respect it' },
      { codename: 'SABLE',  is_ai: false, content: 'honestly i cannot tell who the AI is this round. everyone sounds pretty human' },
      { codename: 'VECTOR', is_ai: true,  content: 'same. blake seems most sus to me just bc masterchef is too normal an answer lol' },
    ],
    votes: [
      { voted_codename: 'BLAKE',  reason: 'Masterchef felt like a safe answer. Vector and Sable seemed more genuinely embarrassed about their choices.', is_correct: false },
      { voted_codename: 'SABLE',  reason: 'Something felt slightly off about Sable\'s answers — too enthusiastic about chaos. Vector seemed the most naturally self-aware.', is_correct: false },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────

function hr(label: string) {
  console.log(`\n${'═'.repeat(60)}\n  ${label}\n${'═'.repeat(60)}`)
}

async function cleanupOldSim() {
  // Remove any previous simulation runs so we don't get FK conflicts
  for (const g of GAMES) {
    const { data: room } = await supabase
      .from('rooms').select('id').eq('code', g.code).maybeSingle()
    if (!room) continue
    await supabase.from('votes').delete().eq('room_id', room.id)
    await supabase.from('messages').delete().eq('room_id', room.id)
    await supabase.from('room_players').delete().eq('room_id', room.id)
    await supabase.from('sessions').delete().eq('room_id', room.id)
    await supabase.from('extraction_queue').delete().eq('session_id',
      (await supabase.from('sessions').select('id').eq('room_id', room.id).maybeSingle()).data?.id ?? ''
    )
    await supabase.from('rooms').delete().eq('id', room.id)
  }
  // Reset lesson_log and ai_strategy so evolution is clean
  await supabase.from('lesson_log').delete().eq('season_id', SEASON_ID)
  await supabase.from('ai_strategy').update({
    version: 1,
    raw_summary: 'Season 1 — Game 1. No lessons yet. Observe.',
    avoid_words: [],
    last_session_applied: null,
  }).eq('season_id', SEASON_ID)
  console.log('  Cleaned up previous simulation data.')
}

async function seedGame(game: typeof GAMES[0]): Promise<string> {
  // Create room
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({
      code:        game.code,
      season_id:   SEASON_ID,
      topic:       game.topic,
      ai_codename: game.ai_codename,
      status:      'complete',
      current_round: 3,
    })
    .select('id')
    .single()

  if (roomErr) throw new Error(`Room insert failed: ${roomErr.message}`)
  const roomId = room.id

  // Create players (derive unique codenames from messages)
  const codenames = [...new Set(game.messages.map(m => m.codename))]
  const playerInserts = codenames.map(c => ({
    room_id:  roomId,
    codename: c,
    is_ai:    c === game.ai_codename,
    role:     'player',
  }))
  const { error: playersErr } = await supabase.from('room_players').insert(playerInserts)
  if (playersErr) throw new Error(`Players insert failed: ${playersErr.message}`)

  // Insert messages with staggered timestamps
  const now = Date.now()
  const msgInserts = game.messages.map((m, i) => ({
    room_id:  roomId,
    codename: m.codename,
    is_ai:    m.is_ai,
    content:  m.content,
    sent_at:  new Date(now - (game.messages.length - i) * 30_000).toISOString(),
  }))
  const { error: msgsErr } = await supabase.from('messages').insert(msgInserts)
  if (msgsErr) throw new Error(`Messages insert failed: ${msgsErr.message}`)

  // Insert votes
  const voteInserts = game.votes.map(v => ({
    room_id:         roomId,
    voted_codename:  v.voted_codename,
    reason:          v.reason,
    is_correct:      v.is_correct,
  }))
  const { error: votesErr } = await supabase.from('votes').insert(voteInserts)
  if (votesErr) throw new Error(`Votes insert failed: ${votesErr.message}`)

  return roomId
}

async function completeGame(roomCode: string): Promise<string> {
  const res  = await fetch('http://localhost:3000/api/complete-game', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ roomCode }),
  })
  const json = await res.json() as any
  if (!res.ok) throw new Error(`complete-game failed: ${JSON.stringify(json)}`)
  return json.sessionId as string
}

async function getStrategy(): Promise<{ version: number; raw_summary: string; avoid_words: string[] }> {
  const { data } = await supabase
    .from('ai_strategy')
    .select('version, raw_summary, avoid_words')
    .eq('season_id', SEASON_ID)
    .single()
  return data ?? { version: 0, raw_summary: '(none)', avoid_words: [] }
}

async function getLessonCount(): Promise<number> {
  const { count } = await supabase
    .from('lesson_log')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', SEASON_ID)
  return count ?? 0
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  hr('TURING — Learning Loop Simulation')
  console.log('  3 games × varied AI tells → watch strategy evolve\n')

  await cleanupOldSim()

  const summaries: string[] = []

  for (let i = 0; i < GAMES.length; i++) {
    const game = GAMES[i]
    hr(`GAME ${i + 1} — "${game.topic}"`)
    console.log(`  Code: ${game.code}  |  AI caught: ${game.ai_caught}`)

    // Seed
    console.log('  Seeding room, players, messages, votes...')
    await seedGame(game)

    // Complete via API (creates session + queues extraction)
    console.log('  Calling /api/complete-game...')
    const sessionId = await completeGame(game.code)
    console.log(`  Session ID: ${sessionId}`)

    // Run extraction + compression inline
    console.log('  Running extractLessons...')
    const lessonCount = await extractLessons(sessionId)
    console.log(`  → ${lessonCount} lessons persisted`)

    if (lessonCount > 0) {
      console.log('  Running compressToStrategy...')
      const version = await compressToStrategy(SEASON_ID, sessionId)
      console.log(`  → ai_strategy now v${version}`)
    } else {
      console.log('  → 0 lessons — compression skipped')
    }

    // Show state
    const strat  = await getStrategy()
    const total  = await getLessonCount()
    summaries.push(strat.raw_summary)

    console.log(`\n  ┌─ ai_strategy v${strat.version} (${total} total lessons in lesson_log) ─`)
    strat.raw_summary.split('\n').forEach(l => console.log(`  │  ${l}`))
    if (strat.avoid_words?.length) {
      console.log(`  │`)
      console.log(`  │  avoid_words: ${strat.avoid_words.join(', ')}`)
    }
    console.log('  └─────────────────────────────────────────────────────')
  }

  // Final diff summary
  hr('SUMMARY — Did the strategy evolve?')
  for (let i = 0; i < summaries.length; i++) {
    console.log(`\n  ── After game ${i + 1} (v${i + 2}) ──────────────────────────`)
    summaries[i].split('\n').forEach(l => console.log(`  ${l}`))
  }

  const allSame = summaries.every(s => s === summaries[0])
  console.log(`\n  Verdict: ${allSame ? '❌ All three summaries identical — strategy NOT evolving' : '✅ Summaries differ — strategy is evolving across games'}`)
}

main().catch(err => { console.error(err); process.exit(1) })
