// Orchestrator currency check — called by the AI agent before its first response in a room.
// Ensures ai_strategy is up-to-date with the most recent completed session.
// If stale: runs extraction + compression inline (no dependency on the learning service).

import { createClient } from '@supabase/supabase-js'
import { extractLessons }    from './extract'
import { compressToStrategy } from './compress'

const CURRENCY_TIMEOUT_MS = 30_000

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function ensureStrategyIsCurrent(seasonId: string): Promise<void> {
  if (!seasonId) return
  const supabase = db()

  // Most recent completed session for this season
  const { data: lastSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('season_id', seasonId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastSession) return // No sessions yet — nothing to check

  // Current strategy pointer
  const { data: strategy } = await supabase
    .from('ai_strategy')
    .select('last_session_applied')
    .eq('season_id', seasonId)
    .maybeSingle()

  if (strategy?.last_session_applied === lastSession.id) return // Already current

  console.log(`[orchestrator] Strategy stale (last applied: ${strategy?.last_session_applied ?? 'none'}) — running inline...`)

  // Log a high-priority queue entry for tracking (best-effort)
  try {
    await supabase
      .from('extraction_queue')
      .insert({ session_id: lastSession.id, season_id: seasonId, priority: 'high' })
  } catch { /* ignore duplicate inserts */ }

  const deadline = Date.now() + CURRENCY_TIMEOUT_MS
  try {
    await extractLessons(lastSession.id)
    if (Date.now() < deadline) {
      await compressToStrategy(seasonId, lastSession.id)
    }
    console.log('[orchestrator] Strategy updated — ready')
  } catch (err) {
    console.error('[orchestrator] Inline extraction failed:', err)
    console.log('[orchestrator] Proceeding with stale strategy')
  }
}
