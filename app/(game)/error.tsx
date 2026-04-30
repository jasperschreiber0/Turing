'use client'

export default function GameError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#EDE8DF', padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '72px', letterSpacing: '6px', color: '#1A1A18', marginBottom: '16px' }}>
          ERROR
        </div>
        <div style={{ fontFamily: 'Courier Prime, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9A958C', marginBottom: '24px' }}>
          Something went wrong
        </div>
        <div style={{ fontFamily: 'Courier Prime, monospace', fontSize: '12px', color: '#CC4444', background: '#1A1A18', padding: '12px 16px', borderRadius: '3px', marginBottom: '24px', textAlign: 'left', wordBreak: 'break-all' }}>
          {error?.message || 'Unknown error'}
        </div>
        <button
          onClick={reset}
          style={{
            fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px', letterSpacing: '2px',
            padding: '12px 32px', background: '#B89EE8', color: '#1A1A18',
            border: '2px solid #1A1A18', borderRadius: '3px', cursor: 'pointer',
            marginRight: '12px',
          }}
        >
          RETRY →
        </button>
        <a
          href="/lobby"
          style={{
            fontFamily: 'Courier Prime, monospace', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9A958C',
            textDecoration: 'none',
          }}
        >
          ← back to lobby
        </a>
      </div>
    </div>
  )
}
