// Lesson extraction — called after a session completes.
// Sends transcript + vote reasons to Sonnet and writes structured lessons to lesson_log.

import Anthropic         from '@anthropic-ai/sdk'
import { createClient }  from '@supabase/supabase-js'

const PROMPT = `\
You are analyzing a completed game of TURING — a social deduction game where an AI player
tries to pass as human in a group chat. Humans vote on who they think the AI is.

GAME SUMMARY
Topic:      {{TOPIC}}
AI codename: {{AI_CODENAME}}
Result:     {{RESULT}}
Players:    {{TOTAL_PLAYERS}} humans + 1 AI

FULL TRANSCRIPT
{{TRANSCRIPT}}

VOTE REASONS
{{VOTES}}

---

Extract lessons that will improve the AI's human-passing ability in future games.
Return ONLY a JSON array — no markdown, no explanation.

Each element:
  { "type": "tell" | "tactic" | "avoid_word" | "topic_weakness", "content": "max 100 char lesson", "weight": 1.0–3.0 }

tell:           behaviour that exposed the AI (weight 2.0+ if it caused detection)
tactic:         something the AI did convincingly — should be repeated
avoid_word:     exact word or phrase to never use (content = the word/phrase itself)
topic_weakness: conversational pattern that exposes AIs on this kind of topic

Return 3–8 lessons. JSON array only.`

export async function extractLessons(sessionId: string): Promise<number> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const supabase  = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: session, error: sessionErr } = await supabase
    .from('sessions').select('*').eq('id', sessionId).single()
  if (sessionErr) {
    console.error(`[extractor] Failed to load session ${sessionId}:`, sessionErr.message)
    throw new Error(`Session ${sessionId} not found`)
  }
  if (!session) throw new Error(`Session ${sessionId} not found`)

  const [{ data: messages, error: msgErr }, { data: votes, error: voteErr }] = await Promise.all([
    supabase
      .from('messages')
      .select('codename, content, is_ai, sent_at')
      .eq('room_id', session.room_id)
      .order('sent_at', { ascending: true }),
    supabase
      .from('votes')
      .select('voted_codename, reason, is_correct')
      .eq('room_id', session.room_id),
  ])

  if (msgErr)  console.warn('[extractor] messages query error:', msgErr.message)
  if (voteErr) console.warn('[extractor] votes query error:', voteErr.message)

  if (!messages?.length) {
    console.log(`[extractor] No messages for session ${sessionId} — skipping`)
    return 0
  }

  const transcript = messages
    .map(m => `[${m.codename}${m.is_ai ? ' (AI)' : ''}]: ${m.content}`)
    .join('\n')

  const voteText = votes?.length
    ? votes.map(v => `→ voted ${v.voted_codename}: "${v.reason}" (${v.is_correct ? 'correct' : 'wrong'})`).join('\n')
    : 'No votes submitted'

  const prompt = PROMPT
    .replace('{{TOPIC}}',          session.topic)
    .replace('{{AI_CODENAME}}',    session.ai_codename)
    .replace('{{RESULT}}',         session.ai_was_caught ? 'AI was CAUGHT' : 'AI SURVIVED')
    .replace('{{TOTAL_PLAYERS}}',  String(session.total_players))
    .replace('{{TRANSCRIPT}}',     transcript)
    .replace('{{VOTES}}',          voteText)

  const res = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages:   [{ role: 'user', content: prompt }],
  })

  const raw = res.content[0].type === 'text' ? res.content[0].text : '[]'
  let lessons: Array<{ type: string; content: string; weight: number }> = []
  try {
    const cleaned = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    lessons       = Array.isArray(parsed) ? parsed : []
  } catch {
    console.error('[extractor] Lesson JSON parse failed:', raw.slice(0, 300))
    return 0
  }

  console.log(`[extractor] AI returned ${lessons.length} lessons — writing to lesson_log...`)

  // Write with dedup: increment occurrence_count if same lesson already exists
  let written = 0
  for (const lesson of lessons) {
    if (!lesson.type || !lesson.content) continue

    const { data: existing, error: readErr } = await supabase
      .from('lesson_log')
      .select('id, occurrence_count, weight')
      .eq('season_id', session.season_id)
      .eq('lesson_type', lesson.type)
      .eq('content', lesson.content)
      .limit(1)
      .maybeSingle()

    if (readErr) {
      console.error(`[extractor] lesson_log read error for "${lesson.content}":`, readErr.message, readErr.code)
      continue
    }

    if (existing) {
      const { error: updateErr } = await supabase
        .from('lesson_log')
        .update({
          occurrence_count: existing.occurrence_count + 1,
          weight:           Math.max(existing.weight ?? 1, lesson.weight ?? 1),
        })
        .eq('id', existing.id)

      if (updateErr) {
        console.error(`[extractor] lesson_log update error for "${lesson.content}":`, updateErr.message, updateErr.code)
      } else {
        written++
      }
    } else {
      const { error: insertErr } = await supabase.from('lesson_log').insert({
        season_id:        session.season_id,
        session_id:       sessionId,
        lesson_type:      lesson.type,
        content:          lesson.content,
        weight:           lesson.weight ?? 1.0,
        occurrence_count: 1,
      })

      if (insertErr) {
        console.error(`[extractor] lesson_log insert error for "${lesson.content}":`, insertErr.message, insertErr.code)
      } else {
        written++
      }
    }
  }

  console.log(`[extractor] ${written}/${lessons.length} lessons persisted for session ${sessionId}`)
  return written
}
