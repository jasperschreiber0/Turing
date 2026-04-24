// Learning loop verification script.
// Usage:
//   npm run verify:learning            — show current state
//   npm run verify:learning -- --run <sessionId>   — run extract+compress on a specific session
//   npm run verify:learning -- --complete <roomCode> — call complete-game then run learning

import dotenv from 'dotenv'
import path   from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient }      from '@supabase/supabase-js'
import { extractLessons }    from './extract'
import { compressToStrategy } from './compress'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

function hr(label?: string) {
  const line = '─'.repeat(60)
  console.log(label ? `\n${line}\n  ${label}\n${line}` : `\n${line}`)
}

async function showState(label: string) {
  hr(label)

  // All seasons
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!seasons?.length) {
    console.log('  No seasons found. Check Supabase.')
    return
  }

  for (const season of seasons) {
    console.log(`\n  SEASON: ${season.name} (${season.id})`)

    // ai_strategy
    const { data: strat } = await supabase
      .from('ai_strategy')
      .select('version, raw_summary, avoid_words, last_session_applied, updated_at')
      .eq('season_id', season.id)
      .maybeSingle()

    if (!strat) {
      console.log('  ai_strategy: none yet')
    } else {
      console.log(`  ai_strategy v${strat.version} — updated ${strat.updated_at?.slice(0, 19)}`)
      console.log(`  last_session_applied: ${strat.last_session_applied ?? 'none'}`)
      console.log(`  avoid_words: ${strat.avoid_words?.join(', ') || 'none'}`)
      console.log(`\n  raw_summary:\n`)
      const lines = (strat.raw_summary ?? '').split('\n')
      lines.forEach((l: string) => console.log(`    ${l}`))
    }

    // Recent sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, ai_codename, topic, ai_was_caught, rounds_survived, ai_strategy_version, created_at')
      .eq('season_id', season.id)
      .order('created_at', { ascending: false })
      .limit(5)

    console.log(`\n  Recent sessions (${sessions?.length ?? 0}):`)
    for (const s of sessions ?? []) {
      const caught = s.ai_was_caught ? '⚠ CAUGHT' : '✓ survived'
      console.log(`    ${s.id.slice(0, 8)}… ${s.ai_codename} | "${s.topic}" | ${caught} | strat v${s.ai_strategy_version} | ${s.created_at?.slice(0, 19)}`)
    }

    // extraction_queue
    const { data: queue } = await supabase
      .from('extraction_queue')
      .select('session_id, priority, attempts, queued_at')
      .order('queued_at', { ascending: false })
      .limit(10)

    console.log(`\n  extraction_queue (${queue?.length ?? 0} pending):`)
    for (const q of queue ?? []) {
      console.log(`    ${q.session_id.slice(0, 8)}… priority=${q.priority} attempts=${q.attempts} queued=${q.queued_at?.slice(0, 19)}`)
    }

    // lesson_log top 10
    const { data: lessons } = await supabase
      .from('lesson_log')
      .select('lesson_type, content, weight, occurrence_count')
      .eq('season_id', season.id)
      .order('occurrence_count', { ascending: false })
      .order('weight',           { ascending: false })
      .limit(10)

    console.log(`\n  Top lessons in lesson_log (${lessons?.length ?? 0}):`)
    for (const l of lessons ?? []) {
      console.log(`    [${l.lesson_type}] ×${l.occurrence_count} w=${l.weight} — ${l.content}`)
    }
  }
}

async function runOnSession(sessionId: string) {
  console.log(`\n  Running extract + compress for session: ${sessionId}`)

  const { data: session } = await supabase
    .from('sessions').select('season_id').eq('id', sessionId).single()
  if (!session) { console.error('  Session not found'); process.exit(1) }

  console.log('  → extractLessons...')
  const count = await extractLessons(sessionId)
  console.log(`  → ${count} lessons extracted`)

  if (count > 0) {
    console.log('  → compressToStrategy...')
    const version = await compressToStrategy(session.season_id, sessionId)
    console.log(`  → ai_strategy now at v${version}`)
  } else {
    console.log('  → no lessons, skipping compression')
  }
}

async function completeAndRun(roomCode: string) {
  console.log(`\n  Completing room ${roomCode} via /api/complete-game...`)

  const res = await fetch(`http://localhost:3000/api/complete-game`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ roomCode }),
  })
  const json = await res.json() as any

  if (!res.ok) {
    console.error(`  /api/complete-game failed: ${JSON.stringify(json)}`)
    process.exit(1)
  }

  if (json.existing) {
    console.log(`  Room already had a session: ${json.sessionId}`)
  } else {
    console.log(`  Session created: ${json.sessionId}`)
    console.log(`  AI caught: ${json.aiCaught} | correct voters: ${json.correctVoters}`)
  }

  console.log('  Running extract + compress inline...')
  await runOnSession(json.sessionId)
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const args  = process.argv.slice(2)
  const runIdx = args.indexOf('--run')
  const cmpIdx = args.indexOf('--complete')

  if (runIdx !== -1) {
    const sessionId = args[runIdx + 1]
    if (!sessionId) { console.error('--run requires a session ID'); process.exit(1) }
    await showState('BEFORE')
    await runOnSession(sessionId)
    await showState('AFTER')

  } else if (cmpIdx !== -1) {
    const roomCode = args[cmpIdx + 1]?.toUpperCase()
    if (!roomCode) { console.error('--complete requires a room code'); process.exit(1) }
    await showState('BEFORE')
    await completeAndRun(roomCode)
    await showState('AFTER')

  } else {
    await showState('CURRENT STATE')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
