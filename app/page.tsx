import Link from 'next/link'

const B = 'Bebas Neue, var(--font-bebas, sans-serif)'
const C = 'Courier Prime, var(--font-courier, monospace)'

export default function Landing() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>

      <div style={{
        padding: '64px 48px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', borderRight: '2px solid var(--ink)',
        background: 'var(--beige)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          fontFamily: C, fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          background: 'var(--ink)', color: 'var(--purple)',
          padding: '6px 12px', borderRadius: '2px', width: 'fit-content',
        }}>
          Party game · free to play
        </div>

        <div>
          <div style={{ fontFamily: B, fontSize: 'clamp(100px, 14vw, 160px)', lineHeight: '0.88', letterSpacing: '6px', textShadow: '4px 4px 0 var(--purple-mid)' }}>
            FAUS
          </div>
          <div style={{
            fontFamily: C, fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.25em', textTransform: 'uppercase',
            color: 'var(--ink-faint)', marginTop: '10px', marginBottom: '20px',
          }}>
            can you tell the machine apart?
          </div>
          <p style={{
            fontSize: '17px', fontWeight: 300, lineHeight: 1.65,
            color: 'var(--ink-soft)', maxWidth: '380px',
          }}>
            Four players. One AI. One sleeper. Three minutes to figure out who — or what — you're talking to.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Link href="/lobby" style={{
            fontFamily: B, fontSize: '22px', letterSpacing: '2px',
            padding: '16px 36px', background: 'var(--ink)', color: 'var(--purple)',
            border: '2px solid var(--ink)', borderRadius: 'var(--radius)',
            textDecoration: 'none', width: 'fit-content', display: 'inline-block',
          }}>
            PLAY NOW →
          </Link>
          <span style={{ fontFamily: C, fontSize: '11px', color: 'var(--ink-faint)', letterSpacing: '0.06em' }}>
            no account needed · works on your phone
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', background: 'var(--white)' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '2px solid var(--ink)' }}>
          {([
            { pill: '× 2', bg: 'var(--purple-pale)', title: 'Detector', hint: 'Two of you hunting the AI' },
            { pill: '× 1', bg: 'var(--beige)',       title: 'The AI',   hint: 'Blend in, fool everyone' },
            { pill: '× 1', bg: 'var(--blush)',       title: 'Sleeper',  hint: 'You know who the AI is. Help them survive.' },
          ] as const).map((r, i) => (
            <div key={i} style={{
              padding: '28px 20px',
              borderRight: i < 2 ? '2px solid var(--ink)' : 'none',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <span style={{
                fontFamily: B, fontSize: '11px', letterSpacing: '3px',
                padding: '3px 8px', borderRadius: '2px', width: 'fit-content',
                border: '1.5px solid var(--ink)', background: r.bg, color: 'var(--ink)',
              }}>{r.pill}</span>
              <div style={{ fontFamily: B, fontSize: '32px', letterSpacing: '1px', lineHeight: 1 }}>{r.title}</div>
              <div style={{ fontSize: '13px', fontWeight: 300, color: 'var(--ink-soft)', lineHeight: 1.45 }}>{r.hint}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--beige)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '2px solid var(--ink)' }}>
          <div style={{ fontFamily: C, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '2px' }}>
            Live game — 1:42 left
          </div>
          {([
            { init: 'M', name: 'Marcus', text: "wait you've never burned your tongue on coffee??",         bg: 'var(--beige)',  ai: false },
            { init: 'A', name: 'Alex',   text: "I said I prefer it warm, not that I've never been burned", bg: 'var(--purple)', ai: true  },
            { init: 'J', name: 'Jade',   text: "lol that's literally what a bot would say",                 bg: 'var(--blush)',  ai: false },
          ] as const).map((m, i) => (
            <div key={i} style={{
              display: 'flex', gap: '9px', alignItems: 'flex-start',
              ...(m.ai ? { borderLeft: '3px solid var(--purple)', paddingLeft: '10px', marginLeft: '-13px' } : {}),
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: B, fontSize: '11px',
                flexShrink: 0, background: m.bg,
              }}>{m.init}</div>
              <div>
                <div style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '2px' }}>
                  {m.name}{m.ai && <span style={{ color: 'var(--purple-dark)' }}> ← AI</span>}
                </div>
                <span style={{
                  fontSize: '13px', fontWeight: 300, lineHeight: 1.5,
                  color: 'var(--ink-soft)', background: 'var(--white)',
                  padding: '7px 11px', borderRadius: '0 7px 7px 7px',
                  border: '1px solid var(--border)', display: 'inline-block',
                }}>{m.text}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {([
            { n: '63%',  l: 'AI catch rate' },
            { n: '3MIN', l: 'Per round'     },
            { n: '4',    l: 'Max players'   },
          ] as const).map((s, i) => (
            <div key={i} style={{
              padding: '18px 20px', textAlign: 'center',
              borderRight: i < 2 ? '2px solid var(--ink)' : 'none',
              borderTop: '2px solid var(--ink)',
            }}>
              <div style={{ fontFamily: B, fontSize: '36px', letterSpacing: '1px', lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontFamily: C, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: '2px' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
