'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/stores/game'
import type { Message } from '@/lib/supabase/client'

const AI_BAR = '#CC3333'
const AI_BG  = 'rgba(204, 51, 51, 0.06)'
const INK    = '#0A0A0A'
const GREY   = '#999999'

type Props = {
  aiCodename:   string
  aiCaught:     boolean
  correctCount: number   // number of players who correctly identified the AI
  totalVotes:   number
  messages:     (Message & { _revealed: boolean })[]
  onComplete:   () => void
}

const STEPS = [
  { at: 0    },   // 0 — mount
  { at: 600  },   // 1 — codename wipe
  { at: 1300 },   // 2 — "// AI" appended
  { at: 1900 },   // 3 — result + grudge
  { at: 2800 },   // 4 — scoreboard + scroll hint
  { at: 5200 },   // 5 — buttons
]

export function RevealSequence({ aiCodename, aiCaught, correctCount, totalVotes, messages, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const grudgeMessage   = useGameStore(s => s.grudgeMessage)

  const fooledCount  = totalVotes - correctCount

  useEffect(() => {
    STEPS.forEach(({ at }, i) => {
      setTimeout(() => setStep(i), at)
    })
  }, [])

  const showCodename  = step >= 1
  const showAITag     = step >= 2
  const showResult    = step >= 3
  const showScoreboard = step >= 4
  const showButtons   = step >= 5

  // Annotated message list — shows AI messages with red stripe
  const aiMessages = messages.filter(m => m.is_ai)

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     '#FFFFFF',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '2rem 1.5rem',
      zIndex:         50,
      overflowY:      'auto',
    }}>

      {/* Phase label */}
      <p style={{
        fontFamily:    'monospace',
        fontSize:      '0.6rem',
        letterSpacing: '0.2em',
        color:         GREY,
        textTransform: 'uppercase',
        marginBottom:  '2rem',
      }}>
        {aiCaught ? 'AI detected' : 'AI survived'}
      </p>

      {/* Codename ink-wipe */}
      <div style={{ minHeight: '7rem', display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
        {showCodename && (
          <span
            className="font-display ink-reveal"
            style={{
              fontSize:   'clamp(3rem, 12vw, 5.5rem)',
              color:      showAITag ? AI_BAR : INK,
              transition: 'color 0.5s ease',
              display:    'block',
              textAlign:  'center',
              letterSpacing: '0.08em',
            }}
          >
            {showAITag ? `${aiCodename} // AI` : aiCodename}
          </span>
        )}
      </div>

      {/* Result line */}
      {showResult && (
        <p
          className="fade-up"
          style={{
            fontFamily:    'monospace',
            fontSize:      '0.75rem',
            letterSpacing: '0.14em',
            color:         aiCaught ? INK : GREY,
            textTransform: 'uppercase',
            marginBottom:  '1.5rem',
          }}
        >
          {aiCaught
            ? `Identified by ${correctCount} of ${totalVotes} player${totalVotes !== 1 ? 's' : ''}`
            : `The AI fooled everyone — ${totalVotes} wrong vote${totalVotes !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Grudge message */}
      {showResult && grudgeMessage && (
        <div
          className="fade-up"
          style={{
            maxWidth:     '22rem',
            width:        '100%',
            border:       '1px solid rgba(10,10,10,0.15)',
            borderLeft:   `3px solid ${AI_BAR}`,
            padding:      '1rem 1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ fontFamily: 'monospace', fontSize: '0.58rem', letterSpacing: '0.14em', color: GREY, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            {aiCodename} says:
          </p>
          <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: INK, lineHeight: '1.65', fontStyle: 'italic' }}>
            {grudgeMessage}
          </p>
        </div>
      )}

      {/* Scoreboard */}
      {showScoreboard && (
        <div
          className="fade-up"
          style={{
            maxWidth:     '22rem',
            width:        '100%',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{
            display:       'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:           '0.75rem',
          }}>
            <div style={{ textAlign: 'center', padding: '0.75rem', border: '1px solid rgba(10,10,10,0.1)' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '1.5rem', color: INK, fontWeight: 600 }}>
                {correctCount}
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: GREY, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                caught the AI
              </p>
            </div>
            <div style={{ textAlign: 'center', padding: '0.75rem', border: '1px solid rgba(10,10,10,0.1)' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '1.5rem', color: GREY, fontWeight: 600 }}>
                {fooledCount}
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: '0.55rem', color: GREY, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                fooled
              </p>
            </div>
          </div>

          {/* AI message count annotation */}
          {aiMessages.length > 0 && (
            <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: GREY, textAlign: 'center', marginTop: '0.75rem', letterSpacing: '0.08em' }}>
              ↑ scroll up — {aiMessages.length} AI message{aiMessages.length !== 1 ? 's' : ''} highlighted in chat
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {showButtons && (
        <div className="fade-up" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {/* Clip export — Phase 3 */}}
            style={{
              padding:       '0.6rem 1.5rem',
              border:        '1px solid rgba(10,10,10,0.25)',
              background:    'transparent',
              fontFamily:    'monospace',
              fontSize:      '0.62rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color:         GREY,
              cursor:        'pointer',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = INK; (e.target as HTMLElement).style.color = INK }}
            onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'rgba(10,10,10,0.25)'; (e.target as HTMLElement).style.color = GREY }}
          >
            Clip this
          </button>
          <button
            onClick={onComplete}
            style={{
              padding:       '0.6rem 1.5rem',
              background:    INK,
              border:        `1px solid ${INK}`,
              fontFamily:    'monospace',
              fontSize:      '0.62rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color:         '#FFFFFF',
              cursor:        'pointer',
              fontWeight:    600,
            }}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}
