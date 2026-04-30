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

const AUSSIE_QUEUE_LINES = [
  'finding your mob...',
  'rounding up the crew...',
  'hunting for players...',
  'almost there, hang tight...',
  'getting the gang together...',
]

export default function LobbyInner() {
  const router = useRouter()
  const [codename, setCodename] = useState(() =>
    CODENAMES[Math.floor(Math.random() * CODENAMES.length)]
  )
  const [searching, setSearching] = useState(false)
  const [queueLine, setQueueLine] = useState('')

  function shuffle() {
    const pool = CODENAMES.filter(c => c !== codename)
    setCodename(pool[Math.floor(Math.random() * pool.length)])
  }

  async function findGame() {
    if (!codename.trim() || searching) return
    setSearching(true)
    setQueueLine(AUSSIE_QUEUE_LINES[Math.floor(Math.random() * AUSSIE_QUEUE_LINES.length)])
    sessionStorage.setItem('turing_codename', codename.toUpperCase())

    try {
      const res  = await fetch('/api/find-game', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codename: codename.toUpperCase() }),
      })
      const data = await res.json()
      if (data.code) {
        router.push('/room/' + data.code)
      } else {
        setSearching(false)
      }
    } catch {
      setSearching(false)
    }
  }

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '56px 24px' }}>

      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ fontFamily: B, fontSize: '88px', letterSpacing: '10px', color: 'var(--ink)', lineHeight: 1, marginBottom: '4px', textShadow: '3px 3px 0 var(--purple-mid)' }}>FAUS</div>
        <div style={{ fontFamily: C, fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          can you tell the machine apart?
        </div>
      </div>

      <div style={{ background: 'var(--white)', border: '2px solid var(--ink)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '12px 20px', borderBottom: '2px solid var(--ink)', background: 'var(--beige-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Your codename</span>
          <button onClick={shuffle} disabled={searching} title="Shuffle" style={{ fontFamily: B, fontSize: '18px', background: 'none', border: 'none', cursor: searching ? 'not-allowed' : 'pointer', color: 'var(--ink-faint)', padding: '0 4px' }}>↺</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--purple-dark)', background: 'var(--purple-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: B, fontSize: '17px', flexShrink: 0, color: 'var(--purple-deep)' }}>
            {codename.slice(0, 2)}
          </div>
          <input
            value={codename}
            maxLength={10}
            disabled={searching}
            onChange={e => setCodename(e.target.value.toUpperCase())}
            style={{ fontFamily: B, fontSize: '22px', letterSpacing: '1px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', flex: 1 }}
          />
          <span style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'var(--purple)', color: 'var(--ink)', padding: '3px 9px', borderRadius: '2px', border: '1.5px solid var(--ink)' }}>You</span>
        </div>
      </div>

      <button
        onClick={findGame}
        disabled={!codename.trim() || searching}
        style={{
          width: '100%', fontFamily: B, fontSize: '22px', letterSpacing: '3px',
          padding: '18px',
          background: (!codename.trim() || searching) ? 'var(--beige-dark)' : 'var(--ink)',
          color: (!codename.trim() || searching) ? 'var(--ink-faint)' : 'var(--purple)',
          border: (!codename.trim() || searching) ? '2px solid var(--border-thick)' : '2px solid var(--ink)',
          borderRadius: 'var(--radius)', cursor: (!codename.trim() || searching) ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {searching ? 'SEARCHING...' : 'FIND GAME →'}
      </button>

      {searching && (
        <div style={{ textAlign: 'center', marginTop: '16px', fontFamily: C, fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {queueLine}<span className="waiting-dots"><span/><span/><span/></span>
        </div>
      )}

      <div style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
        <div style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '14px', textAlign: 'center' }}>How it works</div>
        {[
          ['1', '4 players enter a chat. One is an AI, one is their Sleeper.'],
          ['2', 'Chat for 3 minutes. Detectors must expose the AI.'],
          ['3', 'Vote on who you think the AI is. Get it right and your team wins.'],
        ].map(([n, t]) => (
          <div key={n} style={{ display: 'flex', gap: '16px', marginBottom: '10px', alignItems: 'flex-start' }}>
            <div style={{ fontFamily: B, fontSize: '28px', color: 'var(--purple-mid)', lineHeight: 1, minWidth: '20px' }}>{n}</div>
            <div style={{ fontFamily: C, fontSize: '12px', fontWeight: 400, lineHeight: 1.6, color: 'var(--ink-soft)', paddingTop: '4px' }}>{t}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
