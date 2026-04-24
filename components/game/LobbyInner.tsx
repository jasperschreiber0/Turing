'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const B = 'Bebas Neue, var(--font-bebas, sans-serif)'
const C = 'Courier Prime, var(--font-courier, monospace)'

const CODENAMES = [
  'SIGNAL', 'CIPHER', 'AXIOM', 'VECTOR', 'DELTA', 'ECHO',
  'GHOST',  'INDIGO', 'JADE',  'LAMBDA', 'NOVA',  'PROXY',
  'QUARTZ', 'RAVEN',  'SIGMA', 'TANGO',  'UMBRA', 'VEGA',
  'WREN',   'ZENITH', 'ATLAS', 'COBALT', 'DUNE',  'FLARE',
]

export default function LobbyInner() {
  const router = useRouter()
  const [codename, setCodename] = useState('SIGNAL')
  const [roomCode, setRoomCode] = useState('')
  const [mode,     setMode]     = useState<'join' | 'create'>('join')

  function shuffle() {
    const pool = CODENAMES.filter(c => c !== codename)
    setCodename(pool[Math.floor(Math.random() * pool.length)])
  }

  const generatedCode = useState(() =>
    Math.random().toString(36).substring(2, 8).toUpperCase()
  )[0]

  function go() {
    if (!codename.trim()) return
    if (mode === 'join' && !roomCode.trim()) return
    sessionStorage.setItem('turing_codename', codename.toUpperCase())
    const code = mode === 'create' ? generatedCode : roomCode.trim().toUpperCase()
    router.push('/room/' + code)
  }

  const ctaDisabled = !codename.trim() || (mode === 'join' && !roomCode.trim())
  const displayCode = mode === 'create' ? generatedCode : roomCode

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '56px 24px' }}>

      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          fontFamily: B, fontSize: '88px', letterSpacing: '10px',
          color: 'var(--ink)', lineHeight: 1, marginBottom: '4px',
          textShadow: '3px 3px 0 var(--purple-mid)',
        }}>FAUS</div>
        <div style={{ fontFamily: C, fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {mode === 'join' ? 'Enter your room code' : 'Share this code with friends'}
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', border: '2px solid var(--ink)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {(['join', 'create'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: '10px', fontFamily: B, fontSize: '16px', letterSpacing: '2px',
            background: mode === m ? 'var(--ink)' : 'transparent',
            color: mode === m ? 'var(--purple)' : 'var(--ink-faint)',
            border: 'none', cursor: 'pointer', transition: 'all 0.12s',
          }}>
            {m === 'join' ? 'JOIN ROOM' : 'CREATE ROOM'}
          </button>
        ))}
      </div>

      {/* Code display */}
      <div style={{
        background: 'var(--ink)', borderRadius: 'var(--radius)',
        padding: '32px', textAlign: 'center', marginBottom: '20px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
          fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap',
        }}>ROOM CODE</div>

        {mode === 'join' ? (
          <input
            value={roomCode}
            maxLength={8}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            style={{
              fontFamily: B, fontSize: '64px', letterSpacing: '12px',
              color: roomCode ? 'var(--purple)' : 'rgba(184,158,232,0.3)',
              background: 'transparent', border: 'none', outline: 'none',
              width: '100%', textAlign: 'center', marginTop: '12px',
              textShadow: roomCode ? '0 0 40px rgba(184,158,232,0.4)' : 'none',
            }}
          />
        ) : (
          <div style={{
            fontFamily: B, fontSize: '72px', letterSpacing: '14px',
            color: 'var(--purple)', lineHeight: 1, marginTop: '12px',
            textShadow: '0 0 40px rgba(184,158,232,0.4)',
          }}>{generatedCode}</div>
        )}

        <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginTop: '8px' }}>
          {mode === 'create' ? 'Share with friends to join' : 'Ask a friend for the code'}
        </div>
      </div>

      {/* Codename */}
      <div style={{
        background: 'var(--white)', border: '2px solid var(--ink)', borderRadius: 'var(--radius)',
        overflow: 'hidden', marginBottom: '20px',
      }}>
        <div style={{ padding: '12px 20px', borderBottom: '2px solid var(--ink)', background: 'var(--beige-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Your codename</span>
          <button onClick={shuffle} title="Shuffle" style={{ fontFamily: B, fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: '0 4px' }}>↺</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '2px solid var(--purple-dark)', background: 'var(--purple-pale)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: B, fontSize: '17px', flexShrink: 0, color: 'var(--purple-deep)',
          }}>{codename.slice(0, 2)}</div>
          <input
            value={codename}
            maxLength={10}
            onChange={e => setCodename(e.target.value.toUpperCase())}
            style={{
              fontFamily: B, fontSize: '22px', letterSpacing: '1px',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', flex: 1,
            }}
          />
          <span style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'var(--purple)', color: 'var(--ink)', padding: '3px 9px', borderRadius: '2px', border: '1.5px solid var(--ink)' }}>You</span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={go}
        disabled={ctaDisabled}
        style={{
          width: '100%', fontFamily: B, fontSize: '22px', letterSpacing: '3px',
          padding: '18px', background: ctaDisabled ? 'var(--beige-dark)' : 'var(--ink)',
          color: ctaDisabled ? 'var(--ink-faint)' : 'var(--purple)',
          border: ctaDisabled ? '2px solid var(--border-thick)' : '2px solid var(--ink)',
          borderRadius: 'var(--radius)', cursor: ctaDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {mode === 'join' ? 'JOIN ROOM →' : 'CREATE ROOM →'}
      </button>

    </div>
  )
}
