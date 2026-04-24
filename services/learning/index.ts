// ── TURING Learning Service ───────────────────────────────────
// Watches extraction_queue for work items. Run: npm run learning
// Works alongside the AI agent as a separate Railway worker.

import dotenv from 'dotenv'
import path   from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient }   from '@supabase/supabase-js'
import { extractLessons } from './extract'
import { compressToStrategy } from './compress'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Track in-flight session IDs to prevent duplicate processing
const inFlight = new Set<string>()

async function processItem(item: {
  id:         string
  session_id: string
  season_id:  string
  priority:   string
  attempts:   number
}) {
  if (inFlight.has(item.session_id)) return
  inFlight.add(item.session_id)

  console.log(`[learning] Processing session ${item.session_id} (priority: ${item.priority}, attempt: ${item.attempts + 1})`)

  try {
    const count = await extractLessons(item.session_id)
    if (count > 0) {
      await compressToStrategy(item.season_id, item.session_id)
    } else {
      console.log(`[learning] No lessons extracted — skipping compression`)
    }
    // Remove from queue on success
    await supabase.from('extraction_queue').delete().eq('id', item.id)
    console.log(`[learning] Session ${item.session_id} done — removed from queue`)
  } catch (err) {
    console.error(`[learning] Error on session ${item.session_id}:`, err)
    // Increment attempts so it can be retried, up to 3
    await supabase
      .from('extraction_queue')
      .update({ attempts: item.attempts + 1 })
      .eq('id', item.id)
  } finally {
    inFlight.delete(item.session_id)
  }
}

async function drainQueue() {
  const { data: pending } = await supabase
    .from('extraction_queue')
    .select('*')
    .lt('attempts', 3)
    .order('priority', { ascending: false }) // 'high' sorts before 'normal'
    .order('queued_at', { ascending: true })

  for (const item of (pending ?? [])) {
    await processItem(item)
  }
}

function start() {
  console.log('[turing-learning] Starting...')
  console.log(`[turing-learning] Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)

  // Drain any leftover work from before this process started
  drainQueue().catch(console.error)

  // Watch sessions table — auto-queue when a new session is created
  supabase
    .channel('learning-sessions')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sessions' },
      async (payload) => {
        const session = payload.new as any
        console.log(`[learning] New session: ${session.id} (${session.ai_codename}, caught=${session.ai_was_caught})`)

        const { data: item } = await supabase
          .from('extraction_queue')
          .insert({ session_id: session.id, season_id: session.season_id, priority: 'normal' })
          .select('*')
          .single()

        if (item) await processItem(item)
      }
    )
    .subscribe(status => {
      console.log(`[turing-learning] Realtime: ${status}`)
    })

  // Poll every 15 s for high-priority items added by the orchestrator
  setInterval(() => {
    drainQueue().catch(console.error)
  }, 15_000)

  console.log('[turing-learning] Watching for completed sessions...')
}

start()
