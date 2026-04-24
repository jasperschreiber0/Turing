'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  roundEndsAt: string   // ISO timestamp from DB
  onExpire:    () => void
}

export function RoundTimer({ roundEndsAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(0)
  const onExpireRef  = useRef(onExpire)
  const expiredRef   = useRef(false)

  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    expiredRef.current = false
    const end = new Date(roundEndsAt).getTime()

    function tick() {
      const ms = Math.max(0, end - Date.now())
      setRemaining(ms)
      if (ms === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpireRef.current()
      }
    }

    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [roundEndsAt])

  const totalSec  = Math.ceil(remaining / 1000)
  const mins      = Math.floor(totalSec / 60)
  const secs      = totalSec % 60
  const display   = `${mins}:${secs.toString().padStart(2, '0')}`
  const isUrgent  = remaining > 0 && remaining <= 30_000

  return (
    <span
      style={{
        fontFamily:    'monospace',
        fontSize:      '0.72rem',
        letterSpacing: '0.12em',
        color:         remaining === 0 ? '#999' : isUrgent ? '#CC3333' : '#0A0A0A',
        fontWeight:    isUrgent ? 600 : 400,
        animation:     isUrgent ? 'timerPulse 1s ease-in-out infinite' : 'none',
      }}
    >
      {remaining === 0 ? '0:00' : display}
    </span>
  )
}
