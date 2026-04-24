'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore }  from '@/stores/game'

const B  = 'Bebas Neue, var(--font-bebas, sans-serif)'
const C  = 'Courier Prime, var(--font-courier, monospace)'
const BL = 'Barlow Condensed, var(--font-barlow, sans-serif)'

const MIN_REASON = 20
const MAX_REASON = 200

type Props = {
  roomId:     string
  playerId:   string
  myCodename: string
  voteCount:  number
  humanCount: number
  onVoted:    () => void
}

// Deterministic avatar color
const AV_COLORS = ['var(--sky)', 'var(--blush)', 'var(--purple-pale)', 'var(--purple-mid)', '#D4E8C8']
function avColor(name: string) {
  const s = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AV_COLORS[s % AV_COLORS.length]
}

export function VotePanel({ roomId, myCodename, voteCount, humanCount, onVoted }: Props) {
  const supabase   = createClient()
  const players    = useGameStore(s => s.players)
  const room       = useGameStore(s => s.room)

  const [selected,   setSelected]   = useState<string | null>(null)
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const otherPlayers = players.filter(p => p.codename !== myCodename && !p.is_ai)
  const reasonValid  = reason.trim().length >= MIN_REASON
  const canSubmit    = !!selected && reasonValid && !submitting

  async function submitVote() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    const { error: voteError } = await supabase.from('votes').insert({
      room_id:        roomId,
      voter_id:       null,
      voted_codename: selected!,
      reason:         reason.trim(),
      round_number:   room?.current_round ?? 1,
    })
    if (voteError) {
      setError('Vote failed — try again.')
      setSubmitting(false)
      return
    }
    onVoted()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(237,232,223,0.97)', backdropFilter: 'blur(4px)', zIndex: 50, overflowY: 'auto' }}>
      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '56px 24px' }}>

        {/* Eyebrow */}
        <div style={{
          display: 'inline-block', fontFamily: C, fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          background: 'var(--ink)', color: 'var(--purple)',
          padding: '5px 12px', borderRadius: '2px', marginBottom: '12px',
        }}>
          ⏱ Time's up
        </div>

        {/* Heading */}
        <div style={{ fontFamily: B, fontSize: 'clamp(56px, 12vw, 72px)', letterSpacing: '2px', lineHeight: '0.9', color: 'var(--ink)', marginBottom: '6px' }}>
          CAST YOUR<br/>VOTE.
        </div>
        <div style={{ fontFamily: C, fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '28px' }}>
          Who was the bot?
        </div>

        {/* Vote progress */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--white)',
          border: '2px solid var(--ink)', borderRadius: 'var(--radius)', marginBottom: '20px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 300, color: 'var(--ink-soft)' }}>Votes in</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: humanCount }).map((_, i) => (
              <div key={i} style={{
                width: '10px', height: '10px', borderRadius: '50%',
                border: '1.5px solid var(--ink)',
                background: i < voteCount ? 'var(--purple)' : 'var(--beige)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
          <span style={{ fontFamily: B, fontSize: '22px', letterSpacing: '1px', color: 'var(--ink)' }}>
            {voteCount} / {humanCount}
          </span>
        </div>

        {/* Player options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {otherPlayers.length === 0 && (
            <div style={{ fontFamily: C, fontSize: '11px', color: 'var(--ink-faint)', textAlign: 'center', padding: '24px' }}>Loading players…</div>
          )}
          {otherPlayers.map(player => {
            const picked = selected === player.codename
            return (
              <button
                key={player.codename}
                onClick={() => setSelected(player.codename)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '15px 18px', background: picked ? 'var(--purple-pale)' : 'var(--white)',
                  border: `2px solid ${picked ? 'var(--purple-dark)' : 'var(--ink)'}`,
                  borderRadius: 'var(--radius)', cursor: 'pointer',
                  transition: 'all 0.12s', width: '100%', textAlign: 'left',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  border: '2px solid var(--ink)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: B, fontSize: '16px', flexShrink: 0,
                  background: avColor(player.codename),
                }}>{player.codename.slice(0, 2)}</div>
                <span style={{ fontFamily: B, fontSize: '24px', letterSpacing: '1px', flex: 1 }}>{player.codename}</span>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: `2px solid ${picked ? 'var(--purple-dark)' : 'var(--border-thick)'}`,
                  background: picked ? 'var(--purple-dark)' : 'var(--beige)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '12px', fontWeight: 700,
                  transition: 'all 0.12s',
                }}>{picked ? '✓' : ''}</div>
              </button>
            )
          })}
        </div>

        {/* Reason */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '8px' }}>
            <span>Why? <span style={{ opacity: 0.5 }}>(min {MIN_REASON} chars)</span></span>
            <span style={{ color: reasonValid ? '#3a7a46' : 'var(--ink)', transition: 'color 0.2s' }}>
              {reason.length} / {MIN_REASON}
            </span>
          </div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value.slice(0, MAX_REASON))}
            placeholder="What gave it away?"
            style={{
              width: '100%', fontFamily: BL, fontSize: '15px', fontWeight: 400,
              padding: '12px 14px', background: 'var(--white)',
              border: '2px solid var(--ink)', borderRadius: 'var(--radius)',
              color: 'var(--ink)', resize: 'none', outline: 'none', minHeight: '72px',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--purple-dark)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--ink)')}
          />
        </div>

        {error && (
          <div style={{ fontFamily: C, fontSize: '11px', color: 'var(--warn)', marginBottom: '12px' }}>{error}</div>
        )}

        {/* Vote button */}
        <button
          onClick={submitVote}
          disabled={!canSubmit}
          style={{
            width: '100%', fontFamily: B, fontSize: '22px', letterSpacing: '3px',
            padding: '17px', borderRadius: 'var(--radius)',
            background: canSubmit ? 'var(--ink)' : 'var(--beige-dark)',
            color: canSubmit ? 'var(--purple)' : 'var(--ink-faint)',
            border: canSubmit ? '2px solid var(--ink)' : '2px solid var(--border-thick)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          {submitting ? 'LOCKING IN…' : canSubmit ? `LOCK IN VOTE →` : '— SELECT + EXPLAIN —'}
        </button>

        <div style={{ fontFamily: C, fontSize: '10px', color: 'var(--ink-faint)', textAlign: 'center', marginTop: '16px', letterSpacing: '0.06em' }}>
          Your reason helps train the AI. Make it specific.
        </div>
      </div>
    </div>
  )
}
