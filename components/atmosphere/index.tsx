'use client'

export function Atmosphere() {
  return null
}

export function Flicker({ children, className = '' }: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export function GlitchText({ text, className = '' }: {
  text: string
  trigger?: boolean
  className?: string
}) {
  return (
    <span className={`font-display tracking-wider ${className}`}>
      {text}
    </span>
  )
}
