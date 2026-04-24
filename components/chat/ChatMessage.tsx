'use client'

import { useEffect, useState, useRef } from 'react'
import type { Message } from '@/lib/supabase/client'

type Props = {
  message:   Message
  revealed:  boolean
  tellTags?: string[]
}

const CHARS_PER_SECOND = 40

export function ChatMessage({ message, revealed, tellTags = [] }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone]           = useState(false)
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const full = message.content
    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      setDisplayed(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(intervalRef.current!)
        setDone(true)
      }
    }, 1000 / CHARS_PER_SECOND)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [message.content])

  const isAI       = message.is_ai
  const isRevealed = revealed && isAI
  const hasTells   = isRevealed && tellTags.length > 0

  return (
    <div className={`fade-up px-4 py-3 ${isAI ? 'message-ai' : ''} ${isRevealed ? 'revealed' : ''}`}>

      {/* Codename + timestamp */}
      <div className="flex items-baseline gap-3 mb-1">
        <span className={`font-display text-sm tracking-widest ${
          isRevealed ? 'text-ink font-bold' : 'text-dim'
        }`}>
          {isRevealed ? `${message.codename} // AI` : message.codename}
        </span>
        <span className="text-xs font-mono text-dim" style={{ opacity: 0.45 }}>
          {new Date(message.sent_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {isRevealed && (
          <span className="text-xs font-mono text-ink tracking-widest uppercase">AI CONFIRMED</span>
        )}
      </div>

      {/* Message content */}
      <p className="font-mono text-sm leading-relaxed text-ink">
        {displayed}
        {!done && <span className="typing-cursor" />}
      </p>

      {/* Tell annotations */}
      {hasTells && (
        <div className="mt-2 flex flex-wrap gap-2 fade-up">
          {tellTags.map((tag, i) => (
            <span
              key={i}
              className="text-xs font-mono px-2 py-0.5 border border-ink/20 text-dim"
            >
              ↳ {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────
export function TypingIndicator({ codenames }: { codenames: string[] }) {
  if (!codenames.length) return null

  return (
    <div className="px-4 py-2 flex items-center gap-3">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1 h-1 bg-dim"
            style={{ display: 'inline-block', animation: 'blink 1.2s step-end infinite', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-xs font-mono text-dim">
        {codenames.slice(0, 2).join(', ')} {codenames.length === 1 ? 'is' : 'are'} typing
      </span>
    </div>
  )
}
