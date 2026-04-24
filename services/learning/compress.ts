// Strategy compressor — runs after extraction.
// Pulls top lessons from lesson_log, sends to Haiku, writes the prose strategy brief.

import Anthropic        from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const PROMPT = `\
You are writing a strategy brief for MERIDIAN — an AI playing TURING, a social deduction game
where it must pass as a human in a casual group chat. Players vote on who they think the AI is.

TOP LESSONS THIS SEASON (ranked by frequency × weight):
{{LESSONS}}

Write a strategy brief under 500 tokens. Second person. Direct. No intro.

Structure (in order):
1. Critical tells to eliminate — what gave the AI away most often
2. Tactics that worked — what convinced players it was human
3. Topic-specific patterns — how to handle the kinds of topics that exposed it
4. Avoid-words list — one per line, prefixed with ×

Start immediately with the first point. End with the avoid-words list.`

export async function compressToStrategy(seasonId: string, sessionId: string): Promise<number> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const supabase  = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Top 30 lessons, ranked by occurrence × weight
  const { data: lessons, error: lessonsErr } = await supabase
    .from('lesson_log')
    .select('lesson_type, content, weight, occurrence_count')
    .eq('season_id', seasonId)
    .order('occurrence_count', { ascending: false })
    .order('weight',           { ascending: false })
    .limit(30)

  if (lessonsErr) {
    console.error('[compressor] lesson_log read error:', lessonsErr.message, lessonsErr.code)
    return 0
  }

  if (!lessons?.length) {
    console.log('[compressor] No lessons — skipping compression')
    return 0
  }

  console.log(`[compressor] Compressing ${lessons.length} lessons into strategy...`)

  const lessonsText = lessons.map((l, i) =>
    `${i + 1}. [${l.lesson_type.toUpperCase()}] ${l.content} (×${l.occurrence_count}, w=${l.weight})`
  ).join('\n')

  const res = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages:   [{ role: 'user', content: PROMPT.replace('{{LESSONS}}', lessonsText) }],
  })

  const summary = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
  if (!summary) {
    console.error('[compressor] Haiku returned empty summary')
    return 0
  }

  // Collect all avoid_word lessons for the dedicated column
  const { data: avoidRows, error: avoidErr } = await supabase
    .from('lesson_log')
    .select('content')
    .eq('season_id', seasonId)
    .eq('lesson_type', 'avoid_word')
    .order('occurrence_count', { ascending: false })
    .limit(20)

  if (avoidErr) console.warn('[compressor] avoid_word read error:', avoidErr.message)

  const avoidWords = avoidRows?.map(r => r.content) ?? []

  // Bump version
  const { data: current, error: versionErr } = await supabase
    .from('ai_strategy')
    .select('version')
    .eq('season_id', seasonId)
    .maybeSingle()

  if (versionErr) console.warn('[compressor] ai_strategy version read error:', versionErr.message)

  const newVersion = (current?.version ?? 0) + 1

  const { error: upsertErr } = await supabase
    .from('ai_strategy')
    .upsert(
      {
        season_id:            seasonId,
        version:              newVersion,
        raw_summary:          summary,
        avoid_words:          avoidWords,
        last_session_applied: sessionId,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: 'season_id' }
    )

  if (upsertErr) {
    console.error('[compressor] ai_strategy upsert error:', upsertErr.message, upsertErr.code)
    return 0
  }

  console.log(`[compressor] ai_strategy → v${newVersion} (${avoidWords.length} avoid-words)`)
  return newVersion
}
