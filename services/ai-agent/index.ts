// ── TURING AI Agent — Railway worker ─────────────────────────
// Run locally:  npm run agent
// Deploy:       Railway (set env vars in dashboard)

import dotenv from 'dotenv'
import path   from 'path'

// Load .env.local before anything reads process.env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import Anthropic              from '@anthropic-ai/sdk'
import { createClient }       from '@supabase/supabase-js'
import fs                     from 'fs'
import { randomUUID }         from 'crypto'
import { ensureStrategyIsCurrent } from '../learning/orchestrator'

// ── Clients ───────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Use service role key — bypasses RLS, required for server-side writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ── Prompt templates — re-read on every request so edits take effect without restart
const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts')
function agentPrompt()  { return fs.readFileSync(path.join(PROMPTS_DIR, 'ai-agent.md'),      'utf8') }
function grudgePrompt() { return fs.readFileSync(path.join(PROMPTS_DIR, 'grudge.md'),        'utf8') }
function backstories()  { return JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'backstories.json'), 'utf8')) as Backstory[] }

// ── Backstory pool — loaded from /prompts/backstories.json ────────────────
type AgeBracket = '22-28' | '29-40' | '41-55' | '56-70'

type Backstory = {
  id:          string
  bracket:     AgeBracket
  state:       string
  city:        string
  suburb:      string
  job:         string
  local_spot:  string
  footy_team:  string
  detail:      string
}

const SPEECH_REGISTERS: Record<AgeBracket, string> = {
  '22-28': 'Heavy slang is natural for your age: lol, cbf, vibes, lowkey, ngl, fr. Abbreviations everywhere. No full stops at end of casual messages. Drop grammar deliberately sometimes.',
  '29-40': 'Casual but not heavy slang. You might say honestly, tbh, fair enough, yeah nah. Occasional lol but not every message. Mostly lowercase, some real punctuation creeping in.',
  '41-55': 'Almost no textspeak. You write in mostly full sentences with real punctuation. "Haha" yes, "lmao" no. "I think" and "yeah" rather than "lowkey" or "ngl". More considered than younger players — you type things out properly.',
  '56-70': 'Write in complete sentences with proper punctuation. Never use lol, ngl, or lowkey. "Haha" occasionally. Say "I think" or "to be honest" — not "fr" or "tbh". Texting is not your native medium — you write like you\'re speaking, carefully. Autocorrect artifacts are fine. No slang at all.',
}

// ── Types ─────────────────────────────────────────────────────
type Meta = {
  strategyAck:           string | null
  misdirectionTarget:    string | null
  tellRisk:              'low' | 'medium' | 'high'
  ally:                  string | null
  contradictionPlanted:  boolean
}

// ── Build three-layer system prompt ──────────────────────────
async function buildSystemPrompt(room: any, players: any[]): Promise<{ prompt: string; backstoryId: string }> {
  // Roll age bracket first, then pick a coherent backstory from that bracket
  const brackets: AgeBracket[] = ['22-28', '29-40', '41-55', '56-70']
  const ageBracket  = brackets[Math.floor(Math.random() * brackets.length)]
  const pool        = backstories().filter(b => b.bracket === ageBracket)
  const backstory   = pool[Math.floor(Math.random() * pool.length)]
  const speechReg   = SPEECH_REGISTERS[ageBracket]

  const humanPlayers = players.filter(p => !p.is_ai)

  // Layer 2: season strategy
  let strategy = { raw_summary: 'Season 1 — Game 1. No lessons yet. Observe.', avoid_words: [] as string[] }
  if (room.season_id) {
    const { data } = await supabase
      .from('ai_strategy')
      .select('raw_summary, avoid_words')
      .eq('season_id', room.season_id)
      .maybeSingle()
    if (data) strategy = data
  }

  // Misdirection target profile
  const humanPlayerIds = humanPlayers.map(p => p.player_id).filter(Boolean)
  let profiles: any[] = []
  if (humanPlayerIds.length) {
    const { data } = await supabase
      .from('player_ai_profile')
      .select('*')
      .in('player_id', humanPlayerIds)
    profiles = data ?? []
  }

  const target = room.misdirection_target ?? selectTarget(humanPlayers, profiles)
  const targetProfile = profiles.find(p =>
    humanPlayers.find(hp => hp.player_id === p.player_id && hp.codename === target)
  )
  const targetNote = targetProfile?.notes
    ? `Known tactic of ${target}: ${targetProfile.notes}. Use this against them.`
    : `Watch ${target} closely for anything that sounds rehearsed.`

  const prompt = agentPrompt()
    .replace(/\{\{AI_CODENAME\}\}/g,                room.ai_codename)
    .replace(/\{\{AGE_BRACKET\}\}/g,                ageBracket)
    .replace(/\{\{SPEECH_REGISTER\}\}/g,            speechReg)
    .replace(/\{\{BACKSTORY_CITY\}\}/g,             backstory.city)
    .replace(/\{\{BACKSTORY_SUBURB\}\}/g,           backstory.suburb)
    .replace(/\{\{BACKSTORY_JOB\}\}/g,              backstory.job)
    .replace(/\{\{BACKSTORY_LOCAL_SPOT\}\}/g,       backstory.local_spot)
    .replace(/\{\{BACKSTORY_FOOTY_TEAM\}\}/g,       backstory.footy_team)
    .replace(/\{\{BACKSTORY_DETAIL\}\}/g,           backstory.detail)
    .replace(/\{\{TOPIC\}\}/g,                      room.topic)
    .replace(/\{\{PLAYER_CODENAMES\}\}/g,           humanPlayers.map(p => p.codename).join(', '))
    .replace(/\{\{CURRENT_ROUND\}\}/g,              String(room.current_round ?? 1))
    .replace(/\{\{SEASON_NAME\}\}/g,               'MERIDIAN')
    .replace(/\{\{STRATEGY_SUMMARY\}\}/g,           strategy.raw_summary)
    .replace(/\{\{AVOID_WORDS_LIST\}\}/g,           strategy.avoid_words?.join(', ') || 'none yet')
    .replace(/\{\{MISDIRECTION_TARGET\}\}/g,        target ?? humanPlayers[0]?.codename ?? 'UNKNOWN')
    .replace(/\{\{MISDIRECTION_TARGET_PROFILE\}\}/g, targetNote)

  return { prompt, backstoryId: backstory.id }
}

function selectTarget(players: any[], profiles: any[]): string {
  if (!players.length) return ''
  const sorted = [...players].sort((a, b) => {
    const pa = profiles.find(p => p.player_id === a.player_id)
    const pb = profiles.find(p => p.player_id === b.player_id)
    return (pb?.times_detected_ai ?? 0) - (pa?.times_detected_ai ?? 0)
  })
  return sorted[0].codename
}

// ── Generate AI response (Sonnet) ────────────────────────────
async function generateResponse(
  systemPrompt: string,
  history:      any[],
  trigger:      any | null,
  mode:         'normal' | 'idle' = 'normal',
): Promise<{ message: string } & Meta> {
  const dedupedHistory  = dedupeHistory(history, trigger)
  const historyMessages = dedupedHistory.map((m: any) => ({
    role:    m.is_ai ? 'assistant' : 'user',
    content: `[${m.codename}]: ${m.content}`,
  }))

  // Idle mode: no real trigger — inject a silent prompt so the model generates unprompted content
  const messages = mode === 'idle'
    ? [...historyMessages, { role: 'user', content: '[chat is quiet — initiate per Directive 8]' }]
    : [...historyMessages, { role: 'user', content: `[${trigger.codename}]: ${trigger.content}` }]

  const res = await anthropic.messages.create({
    model:       'claude-sonnet-4-20250514',
    max_tokens:  350,
    temperature: 0.9,
    system:      systemPrompt,
    messages:    messages as any,
  })

  const raw   = res.content[0].type === 'text' ? res.content[0].text : ''
  const parts = raw.split('\n---\n')
  const msg   = parts[0].trim()

  const meta: Meta = {
    strategyAck:          null,
    misdirectionTarget:   null,
    tellRisk:             'medium',
    ally:                 null,
    contradictionPlanted: false,
  }
  try {
    if (parts[1]) Object.assign(meta, JSON.parse(parts[1].trim()))
  } catch { /* malformed JSON footer — keep defaults */ }

  return { message: msg, ...meta }
}

// ── External evaluator (Haiku — reads cold, no context) ───────
async function evaluateMessage(message: string): Promise<'human' | 'unsure' | 'ai'> {
  const res = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{
      role:    'user',
      content: `Does this message sound like it was written by a human in a casual group chat, or by an AI? Reply with exactly one word: human, unsure, or ai.\n\nMessage: "${message}"`,
    }],
  })
  const verdict = (res.content[0].type === 'text' ? res.content[0].text : '').toLowerCase().trim()
  if (verdict.includes('human')) return 'human'
  if (verdict.includes('ai'))    return 'ai'
  return 'unsure'
}

// ── Load grudge context ───────────────────────────────────────
async function loadGrudgeContext(players: any[]): Promise<string | null> {
  const ids = players.map(p => p.player_id).filter(Boolean)
  if (!ids.length) return null

  const { data: grudges } = await supabase
    .from('grudge_log')
    .select('target_codename, message, ai_was_caught, created_at')
    .in('target_player_id', ids)
    .order('created_at', { ascending: false })
    .limit(3)

  if (!grudges?.length) return null
  return grudges.map(g =>
    `Previously: targeted ${g.target_codename}. AI was ${g.ai_was_caught ? 'caught' : 'not caught'}. Said: "${g.message}"`
  ).join('\n')
}

// Rooms already currency-checked this session (avoid re-running per message)
const checkedRooms = new Set<string>()

// Rooms currently being processed — prevents double-responses from concurrent Realtime events
const inFlight = new Set<string>()

// Idle-initiation timers — one per active room, reset on every human message
const idleTimers      = new Map<string, ReturnType<typeof setTimeout>>()
// Cached system prompts per room — reused for idle messages so backstory stays consistent
const roomPromptCache = new Map<string, string>()

const IDLE_MIN_MS = 30_000   // 30s minimum silence before self-initiation
const IDLE_MAX_MS = 90_000   // 90s maximum

// ── Helpers ───────────────────────────────────────────────────
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

// Remove the trigger message from history to prevent it appearing twice in context.
// The Realtime INSERT event fires after the message lands in the DB, so loadHistory
// always includes the trigger — appending it again would make the model see it twice.
function dedupeHistory(history: any[], trigger: any | null): any[] {
  if (!trigger) return history
  const before   = history.length
  const filtered = history.filter(m => m.id !== trigger.id)
  const after    = filtered.length
  if (before !== after) {
    console.log(`[agent] dedupeHistory: ${before} → ${after} (removed ${before - after} duplicate)`)
  }
  return filtered
}

// Remove [CODENAME]: patterns anywhere in the message — not just at the start.
// Matches 3–13 uppercase-char codenames, optional brackets.
// "hey lol [MERIDIAN]: and then" → "hey lol and then"
function stripPrefix(s: string): string {
  return s.replace(/\[?[A-Z][A-Z0-9]{2,12}\]?:\s*/g, '').trim()
}

// ── Cross-process DB lock ─────────────────────────────────
// Prevents duplicate responses when multiple agent processes run concurrently.
// Requires this table in Supabase (run once):
//
//   CREATE TABLE IF NOT EXISTS in_flight_responses (
//     room_id            uuid        NOT NULL,
//     trigger_message_id uuid        NOT NULL,
//     locked_at          timestamptz NOT NULL DEFAULT now(),
//     PRIMARY KEY (room_id, trigger_message_id)
//   );
//
async function tryAcquireLock(roomId: string, triggerId: string): Promise<boolean> {
  // Sweep stale locks older than 30s (guards against process crashes that skip finally)
  await supabase
    .from('in_flight_responses')
    .delete()
    .lt('locked_at', new Date(Date.now() - 30_000).toISOString())

  const { error } = await supabase
    .from('in_flight_responses')
    .insert({ room_id: roomId, trigger_message_id: triggerId })

  if (!error) return true                  // acquired
  if (error.code === '23505') return false // conflict — another process owns this trigger

  // Table missing or other DB error — warn and fail open so the agent still works
  console.warn(`[agent] Lock table unavailable (${error.code}: ${error.message}) — proceeding without cross-process lock`)
  return true
}

async function releaseLock(roomId: string, triggerId: string): Promise<void> {
  await supabase
    .from('in_flight_responses')
    .delete()
    .eq('room_id', roomId)
    .eq('trigger_message_id', triggerId)
}

// ── Idle-initiation timer ─────────────────────────────────────

function scheduleIdleInitiation(roomId: string) {
  // Cancel any existing timer first
  const existing = idleTimers.get(roomId)
  if (existing) clearTimeout(existing)

  const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS)
  const timer  = setTimeout(() => {
    idleTimers.delete(roomId)
    handleIdleInitiation(roomId).catch(err =>
      console.error('[agent] Idle initiation error:', err)
    )
  }, delay)

  idleTimers.set(roomId, timer)
  console.log(`[agent] Idle timer set for ${roomId} (${Math.round(delay / 1000)}s)`)
}

function cancelIdleTimer(roomId: string) {
  const existing = idleTimers.get(roomId)
  if (existing) {
    clearTimeout(existing)
    idleTimers.delete(roomId)
    console.log(`[agent] Idle timer cancelled for ${roomId}`)
  }
}

async function handleIdleInitiation(roomId: string) {
  console.log(`[agent] Idle initiation firing for room ${roomId}`)

  // Verify room still active
  const { data: room } = await supabase
    .from('rooms').select('*').eq('id', roomId).single()
  if (!room || (room.status !== 'waiting' && room.status !== 'active')) {
    console.log('[agent] Idle: room no longer active — cancelling')
    return
  }

  // Re-verify no recent human message — race protection after the timer delay
  const { data: recentHuman } = await supabase
    .from('messages')
    .select('sent_at')
    .eq('room_id', roomId)
    .eq('is_ai', false)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentHuman) {
    const msSince = Date.now() - new Date(recentHuman.sent_at).getTime()
    if (msSince < 25_000) {
      console.log(`[agent] Idle: human active ${Math.round(msSince / 1000)}s ago — aborting`)
      return
    }
  }

  // Need at least one human player
  const { data: players } = await supabase
    .from('room_players').select('*').eq('room_id', roomId)
  const humans = (players ?? []).filter((p: any) => !p.is_ai)
  if (!humans.length) return

  // DB lock — uses a fresh UUID since there's no real trigger message
  const lockId      = randomUUID()
  const lockAcquired = await tryAcquireLock(roomId, lockId)
  if (!lockAcquired) return

  try {
    // Reuse cached prompt so backstory/identity stays consistent across the game
    const systemPrompt = roomPromptCache.get(roomId)
      ?? (await buildSystemPrompt(room, players ?? [])).prompt

    const idleAddendum = [
      '',
      '----',
      'IDLE INITIATION: The chat has gone quiet. Post something unprompted per Directive 8.',
      'Do NOT say "it\'s been quiet", "anyone there", or acknowledge the silence in any way — that\'s a tell.',
      'Just say whatever a real person would post right now: a tangent, a complaint, a question, an observation.',
      'Keep it under 10 words. No preamble. First thought only.',
    ].join('\n')

    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('sent_at', { ascending: true })
      .limit(40)

    let result = await generateResponse(
      systemPrompt + idleAddendum,
      history ?? [],
      null,
      'idle',
    )

    result.message = stripPrefix(result.message)

    // Enforce word limit (same pipeline as normal messages)
    if (wordCount(result.message) > 15) {
      const shortRetry = await anthropic.messages.create({
        model:       'claude-sonnet-4-20250514',
        max_tokens:  60,
        temperature: 0.9,
        system:      systemPrompt + idleAddendum,
        messages: [
          ...((history ?? []).map((m: any) => ({
            role:    m.is_ai ? 'assistant' : 'user',
            content: `[${m.codename}]: ${m.content}`,
          }))),
          { role: 'user',      content: '[chat is quiet — initiate per Directive 8]' },
          { role: 'assistant', content: result.message },
          { role: 'user',      content: 'Too long. 8 words max. Single thought only.' },
        ] as any,
      })
      const shortRaw = shortRetry.content[0].type === 'text' ? shortRetry.content[0].text : result.message
      result.message = stripPrefix(shortRaw.split('\n---\n')[0].trim())
    }

    // Short natural delay before posting
    await new Promise(r => setTimeout(r, 800 + result.message.length * 30))

    await supabase.from('messages').insert({
      room_id:         roomId,
      is_ai:           true,
      codename:        room.ai_codename,
      content:         result.message,
      evaluator_score: 'human',
      tell_tags:       [],
      sent_at:         new Date().toISOString(),
    })

    console.log(`[agent] → ${room.ai_codename} (idle): "${result.message}"`)

    // After self-initiating, set another idle timer — conversation may still be quiet
    scheduleIdleInitiation(roomId)

  } finally {
    await releaseLock(roomId, lockId)
  }
}

// ── Main message handler ──────────────────────────────────────
async function handleMessage(roomId: string, trigger: any) {
  // A human spoke — cancel any pending idle initiation for this room
  cancelIdleTimer(roomId)

  // Deduplicate concurrent Realtime events for the same room
  if (inFlight.has(roomId)) {
    console.log(`[agent] Already processing ${roomId} — skipping duplicate`)
    return
  }
  inFlight.add(roomId)

  try {
    await _handleMessage(roomId, trigger)
  } finally {
    inFlight.delete(roomId)
  }
}

async function _handleMessage(roomId: string, trigger: any) {
  // Load room
  const { data: room } = await supabase
    .from('rooms').select('*').eq('id', roomId).single()
  if (!room || room.status !== 'waiting' && room.status !== 'active') return

  // Orchestrator currency check — runs once per room per agent session
  if (room.season_id && !checkedRooms.has(roomId)) {
    checkedRooms.add(roomId)
    await ensureStrategyIsCurrent(room.season_id)
  }

  // Throttle: don't reply within 8s of the last AI message
  const { data: lastAI } = await supabase
    .from('messages')
    .select('sent_at')
    .eq('room_id', roomId)
    .eq('is_ai', true)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastAI) {
    const elapsed = Date.now() - new Date(lastAI.sent_at).getTime()
    if (elapsed < 8000) return
  }

  // Load players
  const { data: players } = await supabase
    .from('room_players').select('*').eq('room_id', roomId)
  if (!players?.length) return

  // Cross-process lock: prevents duplicate responses when multiple agent processes run.
  // trigger.id is the messages row UUID — unique per human message sent.
  const lockAcquired = await tryAcquireLock(roomId, trigger.id)
  if (!lockAcquired) {
    console.log(`[agent] Duplicate trigger ${trigger.id} already owned by another process — aborting`)
    return
  }

  try {
  // Build three-layer prompt and cache it — idle messages reuse the same identity
  const { prompt: systemPrompt, backstoryId } = await buildSystemPrompt(room, players)
  if (!roomPromptCache.has(roomId)) roomPromptCache.set(roomId, systemPrompt)
  console.log(`[agent] Backstory: ${backstoryId}`)

  // Log backstory selection so we can verify variety across sessions
  await supabase.from('strategy_ack_log').insert({
    room_id:         roomId,
    season_id:       room.season_id,
    acknowledgement: `[backstory] ${backstoryId}`,
  })

  // Load last 40 messages for context
  const { data: history } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('sent_at', { ascending: true })
    .limit(40)

  // Generate response
  let result = await generateResponse(systemPrompt, history ?? [], trigger)

  // External evaluator: if AI-sounding, regenerate once with correction
  const evalScore = await evaluateMessage(result.message)
  console.log(`[evaluator] ${evalScore} — "${result.message.slice(0, 60)}..."`)

  if (evalScore === 'ai') {
    console.log('[agent] Tell-risk HIGH — regenerating...')
    const retry = await anthropic.messages.create({
      model:       'claude-sonnet-4-20250514',
      max_tokens:  200,
      temperature: 0.9,
      system:      systemPrompt,
      messages: [
        ...(dedupeHistory(history ?? [], trigger).map((m: any) => ({
          role:    m.is_ai ? 'assistant' : 'user',
          content: `[${m.codename}]: ${m.content}`,
        }))),
        { role: 'user',      content: `[${trigger.codename}]: ${trigger.content}` },
        { role: 'assistant', content: result.message },
        { role: 'user',      content: 'That sounded like an AI. Be messier, shorter, more reactive. No formal phrasing. Try again.' },
      ] as any,
    })
    const retryRaw = retry.content[0].type === 'text' ? retry.content[0].text : result.message
    result.message = retryRaw.split('\n---\n')[0].trim()
  }

  // ── Post-generation cleanup ───────────────────────────────────

  // 1. Strip any "[CODENAME]: " prefix the model leaked into the message
  result.message = stripPrefix(result.message)

  // 2. Hard word-count enforcement: max 25 words
  if (wordCount(result.message) > 25) {
    console.log(`[agent] Message too long (${wordCount(result.message)} words) — enforcing limit`)
    const shortRetry = await anthropic.messages.create({
      model:       'claude-sonnet-4-20250514',
      max_tokens:  80,
      temperature: 0.9,
      system:      systemPrompt,
      messages: [
        ...(dedupeHistory(history ?? [], trigger).map((m: any) => ({
          role:    m.is_ai ? 'assistant' : 'user',
          content: `[${m.codename}]: ${m.content}`,
        }))),
        { role: 'user',      content: `[${trigger.codename}]: ${trigger.content}` },
        { role: 'assistant', content: result.message },
        { role: 'user',      content: 'Respond in 10 words or fewer. No exceptions. Casual and reactive.' },
      ] as any,
    })
    const shortRaw = shortRetry.content[0].type === 'text' ? shortRetry.content[0].text : result.message
    result.message = stripPrefix(shortRaw.split('\n---\n')[0].trim())

    // Final fallback: truncate at first sentence boundary
    if (wordCount(result.message) > 25) {
      const firstSentence = result.message.split(/(?<=[.!?])\s+/)[0] ?? result.message
      result.message = firstSentence.trim()
      console.log(`[agent] Truncated to first sentence: "${result.message}"`)
    }
  }

  // Log strategy ack
  if (result.strategyAck) {
    await supabase.from('strategy_ack_log').insert({
      room_id:        roomId,
      season_id:      room.season_id,
      acknowledgement: result.strategyAck,
    })
  }

  // Update misdirection target if the AI chose a new one
  if (result.misdirectionTarget && result.misdirectionTarget !== room.misdirection_target) {
    await supabase
      .from('rooms')
      .update({ misdirection_target: result.misdirectionTarget })
      .eq('id', roomId)
  }

  // Typing delay: 1.5s base + 40ms per character, capped at 8s
  const delay = Math.min(1500 + result.message.length * 40, 8000)
  await new Promise(r => setTimeout(r, delay))

  // Write message to Supabase
  await supabase.from('messages').insert({
    room_id:         roomId,
    is_ai:           true,
    codename:        room.ai_codename,
    content:         result.message,
    evaluator_score: evalScore,
    tell_tags:       [],
    sent_at:         new Date().toISOString(),
  })

  console.log(`[agent] → ${room.ai_codename}: "${result.message}"`)

  // Start idle timer — if no human responds within 30–90s, MERIDIAN self-initiates
  scheduleIdleInitiation(roomId)

  } finally {
    await releaseLock(roomId, trigger.id)
  }
}

// ── Generate grudge message (called post-game) ────────────────
export { generateGrudgeMessage } from './grudge'

// ── Start: subscribe to Supabase Realtime ────────────────────
function start() {
  console.log('[turing-agent] Starting...')
  console.log(`[turing-agent] Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)

  supabase
    .channel('ai-agent')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        const msg = payload.new as any
        if (msg.is_ai) return  // ignore own messages

        console.log(`[agent] Message from ${msg.codename}: "${msg.content}"`)
        try {
          await handleMessage(msg.room_id, msg)
        } catch (err) {
          console.error('[agent] Error handling message:', err)
        }
      }
    )
    .subscribe((status) => {
      console.log(`[turing-agent] Realtime status: ${status}`)
    })

  console.log('[turing-agent] Listening for human messages...')
}

start()
