'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/stores/game'
import type { Message, RoomPlayer } from '@/lib/supabase/client'

const B  = 'Bebas Neue, var(--font-bebas, sans-serif)'
const C  = 'Courier Prime, var(--font-courier, monospace)'

type Props = {
  aiCodename:      string
  aiCaught:        boolean
  correctCount:    number
  totalVotes:      number
  messages:        (Message & { _revealed: boolean })[]
  players:         RoomPlayer[]
  sleeperCodename: string | null
  sleeperGrudge:   string | null
  onComplete:      () => void
}

const AV_COLORS = ['var(--sky)', 'var(--blush)', 'var(--purple-pale)', 'var(--purple-mid)', '#D4E8C8']
function avColor(name: string) {
  const s = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AV_COLORS[s % AV_COLORS.length]
}

function getRoleLabel(p: RoomPlayer, aiCodename: string, sleeperCodename: string | null) {
  if (p.is_ai) return { label: '🤖 The AI', isBot: true }
  if (p.codename === sleeperCodename) return { label: '🤝 Sleeper', isBot: false }
  return { label: '🔍 Detector', isBot: false }
}

const STEPS = [
  { at: 0    },   // 0 — mount
  { at: 500  },   // 1 — badge + heading
  { at: 1200 },   // 2 — player grid
  { at: 2800 },   // 3 — outcome table
  { at: 3800 },   // 4 — grudge block(s)
  { at: 5000 },   // 5 — play again button
]

export function RevealSequence({ aiCodename, aiCaught, correctCount, totalVotes, messages, players, sleeperCodename, sleeperGrudge, onComplete }: Props) {
  const [step, setStep]    = useState(0)
  const grudgeMessage      = useGameStore(s => s.grudgeMessage)
  const fooledCount        = totalVotes - correctCount

  useEffect(() => {
    STEPS.forEach(({ at }, i) => { setTimeout(() => setStep(i), at) })
  }, [])

  const showBadge    = step >= 1
  const showGrid     = step >= 2
  const showOutcome  = step >= 3
  const showGrudge   = step >= 4
  const showButton   = step >= 5

  // Build player role display
  const humanPlayers = players.filter(p => !p.is_ai)

  // Outcome rows: each human player's vote result (simplified)
  // We don't have per-voter data here, so show aggregate
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--beige)',
      zIndex: 50, overflowY: 'auto',
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '56px 24px', textAlign: 'center' }}>

        {/* Badge */}
        {showBadge && (
          <div className="fade-up" style={{
            display: 'inline-block', fontFamily: C, fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            background: 'var(--ink)', color: 'var(--purple)',
            padding: '5px 14px', borderRadius: '2px', marginBottom: '20px',
          }}>
            🤖 Bot revealed
          </div>
        )}

        {/* Heading */}
        {showBadge && (
          <div className="fade-up" style={{ fontFamily: B, fontSize: 'clamp(56px, 10vw, 96px)', letterSpacing: '2px', lineHeight: '0.88', color: 'var(--ink)', marginBottom: '40px' }}>
            THE BOT<br/>
            WAS{' '}
            <span style={{ background: 'var(--purple)', padding: '0 10px', display: 'inline-block', transform: 'rotate(-1.5deg)' }}>
              {aiCodename}.
            </span>
          </div>
        )}

        {/* Player grid */}
        {showGrid && (
          <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px', textAlign: 'left' }}>
            {players.map((p, i) => {
              const { label, isBot } = getRoleLabel(p, aiCodename, sleeperCodename)
              return (
                <div key={p.codename} style={{
                  background: isBot ? 'var(--purple-pale)' : 'var(--white)',
                  border: `${isBot ? 3 : 2}px solid ${isBot ? 'var(--purple-dark)' : 'var(--ink)'}`,
                  borderRadius: 'var(--radius)', padding: '22px', textAlign: 'center',
                  opacity: 0,
                  animation: `flipIn 0.45s cubic-bezier(0.34,1.4,0.64,1) ${0.2 + i * 0.6}s forwards`,
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    border: `2px solid ${isBot ? 'var(--purple-dark)' : 'var(--ink)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: B, fontSize: '19px', margin: '0 auto 10px',
                    background: isBot ? 'var(--purple)' : avColor(p.codename),
                  }}>{p.codename.slice(0, 2)}</div>
                  <div style={{ fontFamily: B, fontSize: '24px', letterSpacing: '1px', marginBottom: '4px' }}>{p.codename}</div>
                  <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isBot ? 'var(--purple-dark)' : 'var(--ink-faint)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Outcome summary */}
        {showOutcome && (
          <div className="fade-up" style={{
            background: 'var(--white)', border: '2px solid var(--ink)',
            borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '20px', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--ink-soft)' }}>Caught the AI</span>
              <span style={{ fontFamily: B, fontSize: '16px', letterSpacing: '0.5px', color: correctCount > 0 ? '#3a7a46' : 'var(--ink-faint)' }}>
                {correctCount > 0 ? `${correctCount} PLAYER${correctCount !== 1 ? 'S' : ''} 🎯` : 'NOBODY'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px' }}>
              <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--ink-soft)' }}>
                {aiCaught ? 'Detectors win' : 'AI + Sleeper win'}
              </span>
              <span style={{ fontFamily: B, fontSize: '16px', letterSpacing: '0.5px', color: aiCaught ? '#3a7a46' : 'var(--purple-dark)' }}>
                {aiCaught ? 'CAUGHT IT 🎯' : 'AI SURVIVED 🤖'}
              </span>
            </div>
          </div>
        )}

        {/* Grudge block(s) */}
        {showGrudge && grudgeMessage && (
          <div className="fade-up" style={{
            background: 'var(--ink)', border: '2px solid var(--ink)',
            borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: sleeperGrudge ? '12px' : '24px',
            textAlign: 'left',
          }}>
            <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--purple-deep)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--purple-mid)' }}>
                📨 A message from {aiCodename}
              </span>
            </div>
            <div style={{ padding: '18px' }}>
              <div style={{ fontSize: '16px', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.65, color: 'rgba(255,255,255,0.82)' }}>
                "{grudgeMessage}"
              </div>
            </div>
          </div>
        )}

        {showGrudge && sleeperGrudge && sleeperCodename && (
          <div className="fade-up" style={{
            background: 'var(--ink)', border: '2px solid var(--ink)',
            borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '24px',
            textAlign: 'left',
          }}>
            <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--purple-deep)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--purple-mid)' }}>
                📨 {aiCodename} to the sleeper
              </span>
            </div>
            <div style={{ padding: '18px' }}>
              <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--purple)', marginBottom: '8px' }}>
                To: {sleeperCodename}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.65, color: 'rgba(255,255,255,0.82)' }}>
                "{sleeperGrudge}"
              </div>
            </div>
          </div>
        )}

        {/* Play again */}
        {showButton && (
          <button
            onClick={onComplete}
            className="flip-in"
            style={{
              fontFamily: B, fontSize: '22px', letterSpacing: '3px',
              padding: '16px 48px', background: 'var(--purple)', color: 'var(--ink)',
              border: '2px solid var(--ink)', borderRadius: 'var(--radius)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'var(--purple-dark)'; b.style.color = 'white'; b.style.transform = 'rotate(-1deg) scale(1.03)' }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'var(--purple)'; b.style.color = 'var(--ink)'; b.style.transform = '' }}
          >
            PLAY AGAIN →
          </button>
        )}

      </div>
    </div>
  )
}
