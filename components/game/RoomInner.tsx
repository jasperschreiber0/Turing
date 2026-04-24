'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams }         from 'next/navigation'
import { createClient }      from '@/lib/supabase/client'
import { useGameStore }      from '@/stores/game'
import { RoundTimer }        from './RoundTimer'
import { VotePanel }         from './VotePanel'
import { RevealSequence }    from './RevealSequence'
import type { Message, RoomPlayer } from '@/lib/supabase/client'

// ── Colour tokens ─────────────────────────────────────────────
const BG     = '#FFFFFF'
const INK    = '#0A0A0A'
const GREY   = '#999999'
const BORDER = 'rgba(10,10,10,0.1)'
const AI_BG  = 'rgba(204, 51, 51, 0.04)'
const AI_BAR = '#CC3333'

type Phase = 'connecting' | 'chat' | 'voting' | 'reveal' | 'done'

type RevealData = {
  aiCaught:      boolean
  grudgeMessage: string | null
  correctCount:  number
  totalVotes:    number
}

// ── Inline chat message (uses reveal flag for AI stripe) ──────
function ChatLine({ msg, revealed }: { msg: Message; revealed: boolean }) {
  const full    = msg.content
  const isAI    = msg.is_ai
  const showBar = isAI && revealed

  const [n, setN]   = useState(revealed ? 0 : full.length)
  const done        = n >= full.length
  const ts          = new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (n >= full.length) return
    const t = setTimeout(() => setN(v => v + 1), 25)
    return () => clearTimeout(t)
  }, [n, full.length])

  return (
    <div style={{
      display:         'flex',
      gap:             '0.75rem',
      padding:         '0.3rem 0',
      paddingLeft:     showBar ? '0.75rem' : '0',
      alignItems:      'baseline',
      borderLeft:      showBar ? `2px solid ${AI_BAR}` : '2px solid transparent',
      background:      showBar ? AI_BG : 'transparent',
      transition:      'border-left-color 0.6s ease, background 0.6s ease',
    }}>
      <span style={{
        fontFamily:    'monospace',
        fontSize:      '0.62rem',
        letterSpacing: '0.1em',
        color:         showBar ? AI_BAR : GREY,
        minWidth:      '5.5rem',
        textAlign:     'right',
        flexShrink:    0,
        transition:    'color 0.4s ease',
      }}>
        {showBar ? `${msg.codename} // AI` : msg.codename}
      </span>

      <span style={{
        fontFamily: 'monospace',
        fontSize:   '0.875rem',
        color:      INK,
        lineHeight: '1.55',
        flex:       1,
        wordBreak:  'break-word',
      }}>
        {full.slice(0, n)}
        {!done && <span style={{ color: GREY, opacity: 0.5 }}>█</span>}
      </span>

      <span style={{
        fontFamily:  'monospace',
        fontSize:    '0.58rem',
        color:       GREY,
        opacity:     0.4,
        flexShrink:  0,
        visibility:  done ? 'visible' : 'hidden',
      }}>
        {ts}
      </span>
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="12" height="17" viewBox="0 0 12 17" fill="none"
      stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="1" width="6" height="9" rx="3" />
      <path d="M1 8 C1 12 11 12 11 8" />
      <line x1="6" y1="12" x2="6" y2="15" />
      <line x1="3" y1="15" x2="9" y2="15" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────
export default function RoomInner() {
  const supabase  = useMemo(() => createClient(), [])
  const params    = useParams()
  const code      = ((params?.code as string) || '').toUpperCase()
  const codename  = typeof window !== 'undefined'
    ? sessionStorage.getItem('turing_codename') || 'ANON'
    : 'ANON'

  // ── Local state ──────────────────────────────────────────────
  const [roomId,     setRoomId]     = useState<string | null>(null)
  const [room,       setRoomState]  = useState<any>(null)
  const [players,    setPlayers]    = useState<RoomPlayer[]>([])
  const [messages,   setMessages]   = useState<(Message & { _revealed: boolean })[]>([])
  const [voteCount,  setVoteCount]  = useState(0)
  const [hasVoted,   setHasVoted]   = useState(false)
  const [revealData, setRevealData] = useState<RevealData | null>(null)
  const [connStatus, setConnStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const [input,      setInput]      = useState('')

  // Zustand store — VotePanel and RevealSequence read from here
  const { setRoom, setPlayers: storePlayers, setGrudgeMessage } = useGameStore()

  // Refs for one-shot calls
  const timerCalledRef   = useRef(false)
  const finalizingRef    = useRef(false)
  const bottomRef        = useRef<HTMLDivElement>(null)
  const inputRef         = useRef<HTMLInputElement>(null)

  // ── Derived phase from room.status ───────────────────────────
  const phase: Phase = useMemo(() => {
    if (!room) return 'connecting'
    switch (room.status) {
      case 'waiting':
      case 'active':    return 'chat'
      case 'voting':    return 'voting'
      case 'reveal':    return 'reveal'
      case 'complete':  return 'done'
      default:          return 'chat'
    }
  }, [room?.status])

  // ── Init: load room, join, hydrate messages + players ────────
  useEffect(() => {
    if (!code) return

    async function init() {
      // Load or create room
      const { data: existing } = await supabase
        .from('rooms').select('*').eq('code', code).maybeSingle()

      let roomData: any

      if (existing) {
        roomData = existing
      } else {
        const { data: season } = await supabase
          .from('seasons').select('id').eq('is_active', true).maybeSingle()
        const { data: created, error } = await supabase
          .from('rooms')
          .insert({ code, topic: 'freeplay', ai_codename: 'MERIDIAN', status: 'waiting', season_id: season?.id ?? null })
          .select('*')
          .single()
        if (error || !created) { setConnStatus('error'); return }
        roomData = created
      }

      setRoomId(roomData.id)
      setRoomState(roomData)
      setRoom(roomData)

      // Join as player (upsert in case of reconnect)
      await supabase.from('room_players').upsert(
        { room_id: roomData.id, player_id: null, codename, role: 'detector', is_ai: false },
        { onConflict: 'room_id,codename' }
      )

      // Load historical messages
      const { data: msgs } = await supabase
        .from('messages').select('*').eq('room_id', roomData.id).order('sent_at', { ascending: true })
      const revealed = roomData.status === 'reveal' || roomData.status === 'complete'
      setMessages((msgs ?? []).map(m => ({ ...m, _revealed: revealed && m.is_ai })))

      // Load players
      const { data: rps } = await supabase
        .from('room_players').select('*').eq('room_id', roomData.id)
      setPlayers(rps ?? [])
      storePlayers(rps ?? [])

      // Load vote count if in voting phase
      if (roomData.status === 'voting') {
        const { count } = await supabase
          .from('votes').select('*', { count: 'exact', head: true }).eq('room_id', roomData.id)
        setVoteCount(count ?? 0)
      }

      // Load reveal data if already in reveal/complete
      if (revealed) {
        await loadRevealData(roomData.id, roomData.ai_codename)
      }
    }

    init()
  }, [code])

  // ── Realtime subscriptions ────────────────────────────────────
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`room:${roomId}`)

      // New messages
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => {
          const msg = payload.new as Message
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, { ...msg, _revealed: false }]
        })
      })

      // New players joining
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const rp = payload.new as RoomPlayer
        setPlayers(prev => {
          if (prev.some(p => p.id === rp.id)) return prev
          const next = [...prev, rp]
          storePlayers(next)
          return next
        })
      })

      // Room status changes (timer → voting → reveal)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as any
        setRoomState(updated)
        setRoom(updated)

        if (updated.status === 'reveal' || updated.status === 'complete') {
          // Retroactively highlight all AI messages
          setMessages(prev => prev.map(m => m.is_ai ? { ...m, _revealed: true } : m))
          loadRevealData(updated.id, updated.ai_codename)
        }
      })

      .subscribe(s => { if (s === 'SUBSCRIBED') setConnStatus('live') })

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  // ── Auto-scroll on new messages ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Poll vote count while in voting phase ─────────────────────
  useEffect(() => {
    if (phase !== 'voting' || !roomId) return

    async function pollVotes() {
      const { count } = await supabase
        .from('votes').select('*', { count: 'exact', head: true }).eq('room_id', roomId!)
      setVoteCount(count ?? 0)
    }

    pollVotes()
    const id = setInterval(pollVotes, 2000)
    return () => clearInterval(id)
  }, [phase, roomId])

  // ── Trigger finalize when all votes are in ────────────────────
  useEffect(() => {
    if (phase !== 'voting' || !roomId) return
    const humanCount = players.filter(p => !p.is_ai).length
    if (humanCount > 0 && voteCount >= humanCount && !finalizingRef.current) {
      finalizingRef.current = true
      finalizeGame()
    }
  }, [voteCount, players, phase, roomId])

  // ── Load reveal data (session + grudge) ───────────────────────
  const loadRevealData = useCallback(async (rid: string, _aiCodename: string) => {
    const { data: session } = await supabase
      .from('sessions').select('id, ai_was_caught').eq('room_id', rid).maybeSingle()
    if (!session) return

    const [{ data: grudge }, { data: votes }] = await Promise.all([
      supabase.from('grudge_log').select('message').eq('session_id', session.id).maybeSingle(),
      supabase.from('votes').select('voted_codename, is_correct').eq('room_id', rid),
    ])

    const data: RevealData = {
      aiCaught:     session.ai_was_caught,
      grudgeMessage: grudge?.message ?? null,
      correctCount:  votes?.filter(v => v.is_correct).length ?? 0,
      totalVotes:    votes?.length ?? 0,
    }
    setRevealData(data)
    if (grudge?.message) setGrudgeMessage(grudge.message)
  }, [supabase])

  // ── API actions ───────────────────────────────────────────────
  async function startRound() {
    if (!roomId) return
    await fetch('/api/start-round', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ roomId }),
    })
    // Room update arrives via Realtime subscription
  }

  async function onTimerExpire() {
    if (!roomId || timerCalledRef.current) return
    timerCalledRef.current = true
    await fetch('/api/start-voting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ roomId }),
    })
  }

  async function finalizeGame() {
    if (!roomId) return
    const res = await fetch('/api/finalize-game', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ roomId }),
    })
    const data = await res.json()
    if (data.grudgeMessage) setGrudgeMessage(data.grudgeMessage)
    // Room status update arrives via Realtime — no need to set locally
  }

  async function send() {
    const content = input.trim()
    if (!content || !roomId || phase !== 'chat' || connStatus !== 'live') return
    setInput('')
    await supabase.from('messages').insert({
      room_id: roomId, player_id: null, codename,
      content, is_ai: false, tell_tags: [], sent_at: new Date().toISOString(),
    })
  }

  const humanCount = players.filter(p => !p.is_ai).length

  // ── Reveal screen (full page takeover) ───────────────────────
  if (phase === 'reveal' || phase === 'done') {
    const aiCodename   = room?.ai_codename ?? 'AI'
    const aiCaught     = revealData?.aiCaught ?? false
    const correctCount = revealData?.correctCount ?? 0
    const totalVotes   = revealData?.totalVotes ?? humanCount

    return (
      <>
        {/* Chat stays mounted behind the reveal so scroll-up works */}
        <div style={{ minHeight: '100vh', background: BG, color: INK, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', opacity: 0.15, pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
            {messages.map(m => <ChatLine key={m.id} msg={m} revealed={m._revealed} />)}
          </div>
        </div>

        <RevealSequence
          aiCodename={aiCodename}
          aiCaught={aiCaught}
          correctCount={correctCount}
          totalVotes={totalVotes}
          messages={messages}
          onComplete={() => {
            // Reset and return to lobby
            window.location.href = '/lobby'
          }}
        />
      </>
    )
  }

  // ── Chat screen (active during chat + voting) ─────────────────
  const chatDisabled = phase === 'voting'

  return (
    <div style={{ minHeight: '100vh', background: BG, color: INK, fontFamily: 'monospace', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${BORDER}`, padding: '0.7rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.35rem', letterSpacing: '0.1em', color: INK, flexShrink: 0 }}>
          TURING
        </span>

        <span style={{ color: BORDER, userSelect: 'none' }}>│</span>
        <span style={{ color: GREY, opacity: 0.35, display: 'flex', alignItems: 'center' }}><MicIcon /></span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: GREY }}>{code}</span>

        {/* Round timer — only shown when round is active */}
        {room?.status === 'active' && room.round_ends_at && (
          <>
            <span style={{ color: BORDER, userSelect: 'none' }}>│</span>
            <RoundTimer roundEndsAt={room.round_ends_at} onExpire={onTimerExpire} />
          </>
        )}

        {/* Voting progress */}
        {phase === 'voting' && (
          <>
            <span style={{ color: BORDER, userSelect: 'none' }}>│</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '0.1em', color: GREY }}>
              {voteCount}/{humanCount} voted
            </span>
          </>
        )}

        {/* Connection status */}
        <span style={{ marginLeft: 'auto', fontSize: '0.55rem', letterSpacing: '0.14em', color: connStatus === 'live' ? INK : GREY, textTransform: 'uppercase' }}>
          {connStatus === 'live' ? '● live' : connStatus === 'error' ? '✕ error' : '○ connecting'}
        </span>

        {/* Player tags */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', width: '100%', paddingTop: '0.35rem', alignItems: 'center' }}>
          {players.map(p => (
            <span key={p.codename} style={{
              fontSize:      '0.58rem',
              letterSpacing: '0.1em',
              padding:       '0.18rem 0.5rem',
              border:        `1px solid ${p.codename === codename ? INK : BORDER}`,
              color:         p.codename === codename ? INK : GREY,
              textTransform: 'uppercase',
            }}>
              {p.codename}
            </span>
          ))}

          {/* Start Round button — only visible when waiting and game hasn't started */}
          {room?.status === 'waiting' && (
            <button
              onClick={startRound}
              style={{
                marginLeft:    'auto',
                background:    'transparent',
                color:         INK,
                border:        `1px solid ${INK}`,
                padding:       '0.18rem 0.75rem',
                fontFamily:    'monospace',
                fontSize:      '0.58rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor:        'pointer',
              }}
            >
              ▶ Start Round
            </button>
          )}

          {/* Voting label */}
          {phase === 'voting' && (
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.58rem', letterSpacing: '0.14em', color: GREY, textTransform: 'uppercase' }}>
              — voting phase —
            </span>
          )}
        </div>
      </header>

      {/* Chat stream */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', opacity: chatDisabled ? 0.5 : 1, transition: 'opacity 0.3s' }}>
        {messages.length === 0 && (
          <p style={{ color: GREY, fontSize: '0.65rem', letterSpacing: '0.12em', textAlign: 'center', marginTop: '4rem', textTransform: 'uppercase', opacity: 0.45 }}>
            — room {code} —
          </p>
        )}
        {messages.map(m => <ChatLine key={m.id} msg={m} revealed={m._revealed} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '0.875rem 1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', opacity: chatDisabled ? 0.3 : 1, transition: 'opacity 0.3s' }}>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: GREY, flexShrink: 0, minWidth: '4rem', textAlign: 'right' }}>
          {codename}
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={chatDisabled ? 'voting in progress...' : 'say something...'}
          disabled={chatDisabled || connStatus !== 'live'}
          autoFocus
          style={{
            flex:         1,
            background:   'transparent',
            border:       'none',
            borderBottom: `1px solid ${BORDER}`,
            color:        INK,
            padding:      '0.4rem 0',
            fontFamily:   'monospace',
            fontSize:     '0.875rem',
            outline:      'none',
          }}
          onFocus={e => (e.target.style.borderBottomColor = INK)}
          onBlur={e  => (e.target.style.borderBottomColor = BORDER)}
        />
        <button
          onClick={send}
          disabled={!input.trim() || chatDisabled || connStatus !== 'live'}
          style={{
            background:    'transparent',
            color:         INK,
            border:        `1px solid ${INK}`,
            borderRadius:  0,
            padding:       '0.5rem 1rem',
            fontFamily:    'monospace',
            fontSize:      '0.62rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor:        (!input.trim() || chatDisabled || connStatus !== 'live') ? 'not-allowed' : 'pointer',
            opacity:       (!input.trim() || chatDisabled || connStatus !== 'live') ? 0.3 : 1,
            flexShrink:    0,
          }}
        >
          Send
        </button>
      </footer>

      {/* Voting panel overlay — shown during voting phase */}
      {phase === 'voting' && !hasVoted && roomId && (
        <VotePanel
          roomId={roomId}
          playerId=""
          myCodename={codename}
          voteCount={voteCount}
          humanCount={humanCount}
          onVoted={() => setHasVoted(true)}
        />
      )}

      {/* Waiting-for-others message after voting */}
      {phase === 'voting' && hasVoted && (
        <div style={{
          position:       'fixed',
          inset:          0,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'rgba(255,255,255,0.96)',
          zIndex:         50,
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '0.18em', color: GREY, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Vote submitted
            </p>
            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2rem', letterSpacing: '0.1em', color: INK, marginBottom: '1.5rem' }}>
              {voteCount}/{humanCount} voted
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.12em', color: GREY, textTransform: 'uppercase', opacity: 0.5 }}>
              waiting for the others...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
