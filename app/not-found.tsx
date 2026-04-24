export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#999', textTransform: 'uppercase', marginBottom: '1rem' }}>404</p>
        <p style={{ fontSize: '0.875rem', color: '#0A0A0A' }}>room not found</p>
        <a href="/lobby" style={{ display: 'block', marginTop: '1.5rem', fontSize: '0.65rem', letterSpacing: '0.14em', color: '#999', textTransform: 'uppercase' }}>
          → back to lobby
        </a>
      </div>
    </div>
  )
}
