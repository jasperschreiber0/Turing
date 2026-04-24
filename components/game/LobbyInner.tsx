'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const INK    = '#0A0A0A'
const BG     = '#FFFFFF'
const GREY   = '#999999'
const BORDER = 'rgba(10,10,10,0.14)'

const CODENAMES = [
  'SIGNAL', 'CIPHER', 'AXIOM', 'VECTOR', 'DELTA', 'ECHO',
  'GHOST',  'INDIGO', 'JADE',  'LAMBDA', 'NOVA',  'PROXY',
  'QUARTZ', 'RAVEN',  'SIGMA', 'TANGO',  'UMBRA', 'VEGA',
  'WREN',   'ZENITH', 'ATLAS', 'COBALT', 'DUNE',  'FLARE',
]

function EyeIcon() {
  return (
    <svg width="48" height="30" viewBox="0 0 48 30" fill="none"
      stroke="currentColor" strokeWidth="1" strokeLinecap="round">
      <path d="M2 15 C12 2 36 2 46 15 C36 28 12 28 2 15Z" />
      <circle cx="24" cy="15" r="6" />
      <circle cx="24" cy="15" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FingerprintIcon() {
  return (
    <svg width="36" height="42" viewBox="0 0 36 42" fill="none"
      stroke="currentColor" strokeWidth="1" strokeLinecap="round">
      <path d="M18 4 C10 4 4 10 4 18 C4 28 10 35 18 38" />
      <path d="M18 8 C12 8 9 13 9 18 C9 27 13 33 18 36" />
      <path d="M18 12 C14 12 13 15 13 18 C13 26 16 31 18 34" />
      <path d="M18 16 C17 16 16 17 16 19 C16 22 17 26 18 28" />
      <path d="M22 5 C28 7 32 12 32 18 C32 27 27 34 22 38" />
      <path d="M27 11 C29 14 27 17 27 18 C27 26 24 32 22 36" />
    </svg>
  )
}

const baseInput: React.CSSProperties = {
  background:   'transparent',
  border:       'none',
  borderBottom: `1px solid ${BORDER}`,
  borderRadius: 0,
  color:        INK,
  fontFamily:   'monospace',
  outline:      'none',
}

export default function LobbyInner() {
  const router = useRouter()
  const [codename, setCodename] = useState('SIGNAL')
  const [roomCode, setRoomCode] = useState('')
  const [mode, setMode]         = useState<'join' | 'create'>('join')
  const [ctaHover, setCtaHover] = useState(false)

  function shuffle() {
    const pool = CODENAMES.filter(c => c !== codename)
    setCodename(pool[Math.floor(Math.random() * pool.length)])
  }

  function go() {
    if (!codename.trim()) return
    if (mode === 'join' && !roomCode.trim()) return
    sessionStorage.setItem('turing_codename', codename.toUpperCase())
    const code = mode === 'create'
      ? Math.random().toString(36).substring(2, 8).toUpperCase()
      : roomCode.trim().toUpperCase()
    router.push('/room/' + code)
  }

  const ctaDisabled = !codename.trim() || (mode === 'join' && !roomCode.trim())

  return (
    <div style={{
      minHeight:      '100vh',
      background:     BG,
      color:          INK,
      fontFamily:     'monospace',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '3rem 2rem',
    }}>

      {/* Eye motif */}
      <div style={{ color: INK, opacity: 0.15, marginBottom: '2.5rem' }}>
        <EyeIcon />
      </div>

      {/* Wordmark */}
      <div style={{ lineHeight: 1, marginBottom: '0.5rem' }}>
        <span style={{
          fontFamily:    'var(--font-bebas), sans-serif',
          fontSize:      'clamp(5rem, 14vw, 8rem)',
          letterSpacing: '0.06em',
          color:         INK,
        }}>
          TURING
        </span>
      </div>

      {/* Subtitle */}
      <p style={{
        fontSize:      '0.6rem',
        letterSpacing: '0.28em',
        color:         GREY,
        textTransform: 'uppercase',
        marginBottom:  '3.5rem',
      }}>
        Identify the machine
      </p>

      {/* Form */}
      <div style={{ width: '100%', maxWidth: '320px' }}>

        {/* Codename */}
        <label style={{
          display:       'block',
          fontSize:      '0.58rem',
          letterSpacing: '0.2em',
          color:         GREY,
          textTransform: 'uppercase',
          marginBottom:  '0.4rem',
        }}>
          Codename
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', alignItems: 'center' }}>
          <input
            value={codename}
            maxLength={10}
            onChange={e => setCodename(e.target.value.toUpperCase())}
            style={{ ...baseInput, flex: 1, padding: '0.5rem 0', fontSize: '0.875rem', letterSpacing: '0.1em' }}
            onFocus={e  => (e.target.style.borderBottomColor = INK)}
            onBlur={e   => (e.target.style.borderBottomColor = BORDER)}
          />
          <button
            onClick={shuffle}
            title="Random codename"
            style={{
              background: 'none', border: 'none', padding: '0.5rem 0.25rem',
              fontSize: '1.1rem', color: GREY, cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = INK)}
            onMouseLeave={e => (e.currentTarget.style.color = GREY)}
          >
            ↺
          </button>
        </div>

        {/* Mode toggle — underline text style */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
          {(['join', 'create'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background:   'none',
                border:       'none',
                borderBottom: mode === m ? `1px solid ${INK}` : '1px solid transparent',
                padding:      '0 0 0.2rem 0',
                fontFamily:   'monospace',
                fontSize:     '0.62rem',
                letterSpacing:'0.18em',
                textTransform:'uppercase',
                color:        mode === m ? INK : GREY,
                cursor:       'pointer',
                transition:   'color 0.1s',
              }}
            >
              {m === 'join' ? 'Join room' : 'Create room'}
            </button>
          ))}
        </div>

        {/* Room code */}
        {mode === 'join' && (
          <input
            value={roomCode}
            maxLength={6}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            style={{
              ...baseInput,
              width:         '100%',
              padding:       '0.5rem 0',
              fontSize:      '1rem',
              letterSpacing: '0.35em',
              textAlign:     'center',
              marginBottom:  '2rem',
              boxSizing:     'border-box',
            }}
            onFocus={e  => (e.target.style.borderBottomColor = INK)}
            onBlur={e   => (e.target.style.borderBottomColor = BORDER)}
          />
        )}

        {/* CTA — outlined with hover invert */}
        <button
          onClick={go}
          disabled={ctaDisabled}
          onMouseEnter={() => !ctaDisabled && setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
          style={{
            width:         '100%',
            padding:       '0.875rem',
            background:    ctaHover && !ctaDisabled ? INK : 'transparent',
            color:         ctaHover && !ctaDisabled ? BG  : INK,
            fontFamily:    'monospace',
            fontSize:      '0.7rem',
            fontWeight:    'bold',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            border:        `1px solid ${INK}`,
            borderRadius:  0,
            cursor:        ctaDisabled ? 'not-allowed' : 'pointer',
            opacity:       ctaDisabled ? 0.3 : 1,
            transition:    'background 0.12s, color 0.12s',
          }}
        >
          {mode === 'join' ? 'Join room →' : 'Create room →'}
        </button>

      </div>

      {/* Fingerprint motif */}
      <div style={{ color: INK, opacity: 0.1, marginTop: '4rem' }}>
        <FingerprintIcon />
      </div>

    </div>
  )
}
