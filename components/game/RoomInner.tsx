'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams }      from 'next/navigation'
import { createClient }   from '@/lib/supabase/client'
import { useGameStore }   from '@/stores/game'
import { VotePanel }      from './VotePanel'
import { RevealSequence } from './RevealSequence'
import type { Message, RoomPlayer } from '@/lib/supabase/client'

const B  = 'Bebas Neue, var(--font-bebas, sans-serif)'
const C  = 'Courier Prime, var(--font-courier, monospace)'
const BL = 'Barlow Condensed, var(--font-barlow, sans-serif)'

type Phase = 'connecting' | 'waiting' | 'chat' | 'voting' | 'reveal' | 'done'

type RevealData = {
  aiCaught:        boolean
  grudgeMessage:   string | null
  correctCount:    number
  totalVotes:      number
  sleeperCodename: string | null
  sleeperGrudge:   string | null
}

// Deterministic avatar color from codename
const AV_COLORS = ['var(--sky)', 'var(--blush)', 'var(--purple-pale)', 'var(--purple-mid)', '#D4E8C8']
function avColor(name: string) {
  const s = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AV_COLORS[s % AV_COLORS.length]
}

// ── Chat message (Faus style) ──────────────────────────────
function ChatLine({ msg, revealed }: { msg: Message; revealed: boolean }) {
  const full   = msg.content
  const isAI   = msg.is_ai
  const stripe = isAI && revealed

  const [n, setN] = useState(revealed ? full.length : 0)
  const done      = n >= full.length
  const ts        = new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (n >= full.length) return
    const t = setTimeout(() => setN(v => v + 1), 22)
    return () => clearTimeout(t)
  }, [n, full.length])

  return (
    <div style={{
      display: 'flex', gap: '10px', animation: 'fadeUp 0.2s ease',
      ...(stripe ? { borderLeft: '3px solid var(--purple)', paddingLeft: '12px', marginLeft: '-15px' } : {}),
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        border: '1.5px solid var(--ink)', flexShrink: 0, marginTop: '2px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: B, fontSize: '13px',
        background: stripe ? 'var(--purple)' : avColor(msg.codename),
      }}>{msg.codename.slice(0, 2)}</div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
          <span style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: stripe ? 'var(--purple-dark)' : 'var(--ink)' }}>
            {stripe ? `${msg.codename} // AI` : msg.codename}
          </span>
          {done && <span style={{ fontFamily: C, fontSize: '10px', color: 'var(--ink-faint)', marginLeft: 'auto' }}>{ts}</span>}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 300, lineHeight: 1.6, color: 'var(--ink-soft)', wordBreak: 'break-word' }}>
          {full.slice(0, n)}
          {!done && <span style={{ color: 'var(--ink-faint)', opacity: 0.5 }}>█</span>}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function RoomInner() {
  const supabase = useMemo(() => createClient(), [])
  const params   = useParams()
  const code     = ((params?.code as string) || '').toUpperCase()
  const codename = typeof window !== 'undefined'
    ? sessionStorage.getItem('turing_codename') || 'ANON'
    : 'ANON'

  const [roomId,     setRoomId]     = useState<string | null>(null)
  const [room,       setRoomState]  = useState<any>(null)
  const [players,    setPlayers]    = useState<RoomPlayer[]>([])
  const [messages,   setMessages]   = useState<(Message & { _revealed: boolean })[]>([])
  const [voteCount,  setVoteCount]  = useState(0)
  const [hasVoted,   setHasVoted]   = useState(false)
  const [revealData, setRevealData] = useState<RevealData | null>(null)
  const [connStatus, setConnStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const [input,      setInput]      = useState('')
  // inline timer state
  const [timerMs,    setTimerMs]    = useState(0)

  const { setRoom, setPlayers: storePlayers, setGrudgeMessage, setSleeperGrudge } = useGameStore()

  const timerCalledRef = useRef(false)
  const finalizingRef  = useRef(false)
  const timerExpRef    = useRef(false)
  const bottomRef      = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)

  // Derive phase
  const phase: Phase = useMemo(() => {
    if (!room) return 'connecting'
    switch (room.status) {
      case 'waiting':  return 'waiting'
      case 'active':   return 'chat'
      case 'voting':   return 'voting'
      case 'reveal':   return 'reveal'
      case 'complete': return 'done'
      default:         return 'chat'
    }
  }, [room?.status])

  // My role (derived after roles assigned)
  const myPlayer = players.find(p => p.codename === codename && !p.is_ai)
  const myRole   = myPlayer?.role ?? 'detector'

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return
    async function init() {
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
          .select('*').single()
        if (error || !created) { setConnStatus('error'); return }
        roomData = created
      }

      setRoomId(roomData.id)
      setRoomState(roomData)
      setRoom(roomData)

      await supabase.from('room_players').upsert(
        { room_id: roomData.id, player_id: null, codename, role: 'detector', is_ai: false },
        { onConflict: 'room_id,codename' }
      )

      const { data: msgs } = await supabase
        .from('messages').select('*').eq('room_id', roomData.id).order('sent_at', { ascending: true })
      const revealed = roomData.status === 'reveal' || roomData.status === 'complete'
      setMessages((msgs ?? []).map(m => ({ ...m, _revealed: revealed && m.is_ai })))

      const { data: rps } = await supabase
        .from('room_players').select('*').eq('room_id', roomData.id)
      setPlayers(rps ?? [])
      storePlayers(rps ?? [])

      if (roomData.status === 'voting') {
        const { count } = await supabase
          .from('votes').select('*', { count: 'exact', head: true }).eq('room_id', roomData.id)
        setVoteCount(count ?? 0)
      }
      if (revealed) await loadRevealData(roomData.id)
    }
    init()
  }, [code])

  // ── Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return
    const channel = supabase.channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, payload => {
        setMessages(prev => {
          const msg = payload.new as Message
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, { ...msg, _revealed: false }]
        })
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, payload => {
        const rp = payload.new as RoomPlayer
        setPlayers(prev => {
          if (prev.some(p => p.id === rp.id)) return prev
          const next = [...prev, rp]
          storePlayers(next)
          return next
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, async payload => {
        const updated = payload.new as any
        setRoomState(updated)
        setRoom(updated)

        // Refresh player roles when round starts
        if (updated.status === 'active') {
          const { data: rps } = await supabase
            .from('room_players').select('*').eq('room_id', roomId)
          if (rps) { setPlayers(rps); storePlayers(rps) }
        }

        if (updated.status === 'reveal' || updated.status === 'complete') {
          setMessages(prev => prev.map(m => m.is_ai ? { ...m, _revealed: true } : m))
          await loadRevealData(updated.id)
        }
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') setConnStatus('live') })

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  // ── Inline timer ──────────────────────────────────────────
  useEffect(() => {
    if (!room?.round_ends_at) return
    timerExpRef.current = false
    const end = new Date(room.round_ends_at).getTime()

    function tick() {
      const ms = Math.max(0, end - Date.now())
      setTimerMs(ms)
      if (ms === 0 && !timerExpRef.current) {
        timerExpRef.current = true
        onTimerExpire()
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [room?.round_ends_at])

  // ── Auto-scroll ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Poll vote count ───────────────────────────────────────
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

  // ── Trigger finalize ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'voting' || !roomId) return
    const hc = players.filter(p => !p.is_ai).length
    if (hc > 0 && voteCount >= hc && !finalizingRef.current) {
      finalizingRef.current = true
      finalizeGame()
    }
  }, [voteCount, players, phase, roomId])

  // ── Load reveal data ──────────────────────────────────────
  const loadRevealData = useCallback(async (rid: string) => {
    const { data: session } = await supabase
      .from('sessions').select('id, ai_was_caught').eq('room_id', rid).maybeSingle()
    if (!session) return

    const [{ data: grudges }, { data: votes }] = await Promise.all([
      supabase.from('grudge_log').select('message, type, target_codename').eq('session_id', session.id),
      supabase.from('votes').select('voted_codename, is_correct').eq('room_id', rid),
    ])

    const catcherGrudge  = grudges?.find(g => g.type === 'catcher' || !g.type)?.message ?? null
    const sleeperGrudge  = grudges?.find(g => g.type === 'sleeper')?.message ?? null
    const sleeperCodename = grudges?.find(g => g.type === 'sleeper')?.target_codename ?? null

    const data: RevealData = {
      aiCaught:        session.ai_was_caught,
      grudgeMessage:   catcherGrudge,
      correctCount:    votes?.filter(v => v.is_correct).length ?? 0,
      totalVotes:      votes?.length ?? 0,
      sleeperCodename,
      sleeperGrudge,
    }
    setRevealData(data)
    if (catcherGrudge)  setGrudgeMessage(catcherGrudge)
    if (sleeperGrudge)  setSleeperGrudge(sleeperGrudge)
  }, [supabase])

  // ── API actions ───────────────────────────────────────────
  async function startRound() {
    if (!roomId) return
    await fetch('/api/start-round', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    })
  }

  async function onTimerExpire() {
    if (!roomId || timerCalledRef.current) return
    timerCalledRef.current = true
    await fetch('/api/start-voting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    })
  }

  async function finalizeGame() {
    if (!roomId) return
    const res  = await fetch('/api/finalize-game', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    })
    const data = await res.json()
    if (data.grudgeMessage) setGrudgeMessage(data.grudgeMessage)
    if (data.sleeperGrudge) setSleeperGrudge(data.sleeperGrudge)
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

  const humanCount   = players.filter(p => !p.is_ai).length
  const isUrgent     = timerMs > 0 && timerMs <= 30_000
  const timerSec     = Math.ceil(timerMs / 1000)
  const timerDisplay = `${Math.floor(timerSec / 60)}:${(timerSec % 60).toString().padStart(2, '0')}`
  const timerFill    = room?.round_ends_at
    ? Math.min(100, (timerMs / 180_000) * 100)
    : 100

  // ── Reveal overlay ────────────────────────────────────────
  if (phase === 'reveal' || phase === 'done') {
    return (
      <>
        {/* Dimmed chat behind */}
        <div style={{ height: '100vh', overflow: 'hidden', opacity: 0.12, pointerEvents: 'none', userSelect: 'none', background: 'var(--beige)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--beige)' }}>
            {messages.map(m => <ChatLine key={m.id} msg={m} revealed={m._revealed} />)}
          </div>
        </div>
        <RevealSequence
          aiCodename={room?.ai_codename ?? 'AI'}
          aiCaught={revealData?.aiCaught ?? false}
          correctCount={revealData?.correctCount ?? 0}
          totalVotes={revealData?.totalVotes ?? humanCount}
          messages={messages}
          players={players}
          sleeperCodename={revealData?.sleeperCodename ?? null}
          sleeperGrudge={revealData?.sleeperGrudge ?? null}
          onComplete={() => { window.location.href = '/lobby' }}
        />
      </>
    )
  }

  // ── Connecting ────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--beige)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: B, fontSize: '56px', letterSpacing: '8px', color: 'var(--ink)', textShadow: '2px 2px 0 var(--purple-mid)', marginBottom: '12px' }}>FAUS</div>
          <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            Connecting
            <span className="waiting-dots"><span/><span/><span/></span>
          </div>
        </div>
      </div>
    )
  }

  // ── Waiting room ──────────────────────────────────────────
  if (phase === 'waiting') {
    const maxPlayers = room?.max_players ?? 4
    const filledSlots = players.filter(p => !p.is_ai)
    const emptyCount  = Math.max(0, maxPlayers - filledSlots.length)

    return (
      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '56px 24px' }}>
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontFamily: B, fontSize: '88px', letterSpacing: '10px', color: 'var(--ink)', lineHeight: 1, marginBottom: '4px', textShadow: '3px 3px 0 var(--purple-mid)' }}>FAUS</div>
          <div style={{ fontFamily: C, fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            Waiting for players
            <span className="waiting-dots"><span/><span/><span/></span>
          </div>
        </div>

        {/* Room code */}
        <div style={{ background: 'var(--ink)', borderRadius: 'var(--radius)', padding: '32px', textAlign: 'center', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>ROOM CODE</div>
          <div style={{ fontFamily: B, fontSize: '72px', letterSpacing: '14px', color: 'var(--purple)', lineHeight: 1, marginTop: '12px', textShadow: '0 0 40px rgba(184,158,232,0.4)' }}>{code}</div>
          <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginTop: '8px' }}>Share with friends to join</div>
        </div>

        {/* Player slots */}
        <div style={{ background: 'var(--white)', border: '2px solid var(--ink)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '2px solid var(--ink)', background: 'var(--beige-dark)' }}>
            <span style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Players</span>
            <span style={{ fontFamily: B, fontSize: '20px', letterSpacing: '1px' }}>{filledSlots.length} / {maxPlayers}</span>
          </div>
          {filledSlots.map(p => (
            <div key={p.id} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--border)', animation: 'slotIn 0.3s cubic-bezier(0.34,1.3,0.64,1)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: B, fontSize: '17px', background: p.codename === codename ? 'var(--purple-pale)' : avColor(p.codename), borderColor: p.codename === codename ? 'var(--purple-dark)' : 'var(--ink)' }}>
                {p.codename.slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: B, fontSize: '22px', letterSpacing: '1px', lineHeight: 1 }}>{p.codename}</div>
              </div>
              {p.codename === codename && (
                <span style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'var(--purple)', color: 'var(--ink)', padding: '3px 9px', borderRadius: '2px', border: '1.5px solid var(--ink)' }}>You</span>
              )}
            </div>
          ))}
          {Array.from({ length: emptyCount }).map((_, i) => (
            <div key={`empty-${i}`} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: i < emptyCount - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--border-thick)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: B, fontSize: '17px', background: 'var(--beige-dark)', color: 'var(--ink-faint)' }}>?</div>
              <div style={{ fontFamily: C, fontSize: '13px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                Waiting<span className="waiting-dots"><span/><span/><span/></span>
              </div>
            </div>
          ))}
        </div>

        {/* Start button */}
        <button
          onClick={startRound}
          disabled={filledSlots.length < 2}
          style={{
            width: '100%', fontFamily: B, fontSize: '22px', letterSpacing: '3px',
            padding: '18px', borderRadius: 'var(--radius)', border: '2px solid var(--ink)',
            cursor: filledSlots.length < 2 ? 'not-allowed' : 'pointer',
            background: filledSlots.length < 2 ? 'var(--beige-dark)' : 'var(--ink)',
            color: filledSlots.length < 2 ? 'var(--ink-faint)' : 'var(--purple)',
            borderColor: filledSlots.length < 2 ? 'var(--border-thick)' : 'var(--ink)',
            transition: 'all 0.15s',
          }}
        >
          {filledSlots.length < 2
            ? `NEED ${2 - filledSlots.length} MORE PLAYER${2 - filledSlots.length !== 1 ? 'S' : ''}`
            : 'START ROUND →'}
        </button>
      </div>
    )
  }

  // ── Game screen (chat + voting) ───────────────────────────
  const chatDisabled = phase === 'voting'

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '200px 1fr', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{ borderRight: '2px solid var(--ink)', background: 'var(--white)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>

        {/* Timer box */}
        {room?.round_ends_at && (
          <div style={{
            border: `2px solid ${isUrgent ? '#C44' : 'var(--ink)'}`,
            borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center',
            background: isUrgent ? '#F5E8E8' : 'var(--beige)',
            transition: 'background 0.5s, border-color 0.5s',
            animation: isUrgent ? 'urgentShake 0.5s ease' : 'none',
          }}>
            <div style={{ fontFamily: B, fontSize: '52px', letterSpacing: '-1px', lineHeight: 1, color: isUrgent ? '#C44' : 'var(--ink)', transition: 'color 0.5s' }}>
              {timerMs === 0 ? '0:00' : timerDisplay}
            </div>
            <div style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: '4px' }}>Open chat</div>
            <div style={{ height: '3px', background: 'var(--beige-darker)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: isUrgent ? '#C44' : 'var(--purple)', borderRadius: '2px', width: `${timerFill}%`, transition: 'width 1s linear, background 0.5s' }} />
            </div>
          </div>
        )}

        {/* Role box */}
        <div style={{ border: '2px solid var(--purple-dark)', borderRadius: 'var(--radius)', padding: '14px', background: 'var(--purple-pale)' }}>
          <div style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--purple-dark)', marginBottom: '3px' }}>Your role</div>
          <div style={{ fontFamily: B, fontSize: '28px', letterSpacing: '1px', color: 'var(--ink)', lineHeight: 1 }}>{myRole.toUpperCase()}</div>
          <div style={{ fontSize: '12px', fontWeight: 300, color: 'var(--ink-soft)', marginTop: '4px', lineHeight: 1.4 }}>
            {myRole === 'sleeper'  ? `You know the AI. Help them survive.` :
             myRole === 'detector' ? 'Find the AI. Vote right to win.' :
                                     'Blend in. Fool everyone.'}
          </div>
          {myRole === 'sleeper' && room?.ai_codename && (
            <div style={{ marginTop: '8px', fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--purple-deep)' }}>
              AI is {room.ai_codename}
            </div>
          )}
        </div>

        {/* Players */}
        <div>
          <div style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>In the room</div>
          {players.map(p => (
            <div key={p.codename} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: B, fontSize: '12px', flexShrink: 0, background: p.codename === codename ? 'var(--purple-pale)' : avColor(p.codename) }}>
                {p.codename.slice(0, 2)}
              </div>
              <span style={{ fontFamily: B, fontSize: '16px', letterSpacing: '0.5px', flex: 1 }}>{p.codename}</span>
              {p.codename === codename && <span style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--purple-dark)' }}>you</span>}
            </div>
          ))}
        </div>

        {phase === 'voting' && (
          <div style={{ marginTop: 'auto', fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--purple-dark)', textAlign: 'center', padding: '8px', background: 'var(--purple-pale)', borderRadius: 'var(--radius)', border: '1px solid var(--purple-mid)' }}>
            {voteCount}/{humanCount} voted
          </div>
        )}
      </div>

      {/* Chat */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Chat header */}
        <div style={{
          padding: '12px 20px', background: isUrgent ? '#F5E8E8' : 'var(--white)',
          borderBottom: '2px solid var(--ink)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          transition: 'background 0.5s', flexShrink: 0,
        }}>
          <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            Room {code} · {humanCount} player{humanCount !== 1 ? 's' : ''}
          </div>
          {connStatus === 'live' ? (
            <span className="live-pill"><span className="live-d"/>LIVE</span>
          ) : (
            <span style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
              {connStatus === 'error' ? '✕ ERROR' : '○ CONNECTING'}
            </span>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px',
          display: 'flex', flexDirection: 'column', gap: '14px',
          background: isUrgent ? '#F0EBE2' : 'var(--beige)',
          transition: 'background 0.8s, opacity 0.3s',
          opacity: chatDisabled ? 0.5 : 1,
        }}>
          {messages.length === 0 && (
            <div style={{ fontFamily: C, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', textAlign: 'center', marginTop: '40px', opacity: 0.5 }}>
              — say something —
            </div>
          )}
          {messages.map(m => <ChatLine key={m.id} msg={m} revealed={m._revealed} />)}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '14px 20px', background: isUrgent ? '#F5E8E8' : 'var(--white)',
          borderTop: '2px solid var(--ink)',
          display: 'flex', gap: '10px', alignItems: 'flex-end',
          transition: 'background 0.5s, opacity 0.3s',
          opacity: chatDisabled ? 0.3 : 1, flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={chatDisabled ? 'voting in progress…' : 'Say something…'}
            disabled={chatDisabled || connStatus !== 'live'}
            autoFocus
            style={{
              flex: 1, fontFamily: BL, fontSize: '15px', fontWeight: 400,
              padding: '10px 14px', background: 'var(--beige)',
              border: '2px solid var(--ink)', borderRadius: 'var(--radius)',
              color: 'var(--ink)', resize: 'none', outline: 'none',
              minHeight: '44px', maxHeight: '100px',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--purple-dark)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--ink)')}
          />
          <button
            onClick={send}
            disabled={!input.trim() || chatDisabled || connStatus !== 'live'}
            style={{
              fontFamily: B, fontSize: '16px', letterSpacing: '1px',
              padding: '10px 20px', height: '44px', flexShrink: 0,
              background: (!input.trim() || chatDisabled) ? 'var(--beige-dark)' : 'var(--ink)',
              color: (!input.trim() || chatDisabled) ? 'var(--ink-faint)' : 'var(--purple)',
              border: '2px solid var(--ink)', borderRadius: 'var(--radius)',
              cursor: (!input.trim() || chatDisabled) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            SEND →
          </button>
        </div>
      </div>

      {/* Vote overlay */}
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

      {/* Waiting for others after voting */}
      {phase === 'voting' && hasVoted && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(237,232,223,0.96)', zIndex: 50 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '12px' }}>Vote submitted</div>
            <div style={{ fontFamily: B, fontSize: '56px', letterSpacing: '4px', color: 'var(--ink)', marginBottom: '12px' }}>{voteCount}/{humanCount}</div>
            <div style={{ fontFamily: C, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
              Waiting for others<span className="waiting-dots"><span/><span/><span/></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
