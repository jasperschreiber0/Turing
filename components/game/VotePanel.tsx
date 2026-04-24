'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore }  from '@/stores/game'

const MIN_REASON = 20
const MAX_REASON = 200

type Props = {
  roomId:     string
  playerId:   string  // null-safe; voter_id is nullable in schema
  myCodename: string
  voteCount:  number
  humanCount: number
  onVoted:    () => void
}

export function VotePanel({ roomId, myCodename, voteCount, humanCount, onVoted }: Props) {
  const supabase    = createClient()
  const players     = useGameStore(s => s.players)
  const room        = useGameStore(s => s.room)

  const [selected,   setSelected]   = useState<string | null>(null)
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const otherPlayers = players.filter(p => p.codename !== myCodename && !p.is_ai)
  const reasonValid  = reason.trim().length >= MIN_REASON
  const canSubmit    = !!selected && reasonValid && !submitting

  async function submitVote() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const { error: voteError } = await supabase.from('votes').insert({
      room_id:        roomId,
      voter_id:       null,    // no auth yet — TODO: add voter_id when auth is implemented
      voted_codename: selected!,
      reason:         reason.trim(),
      round_number:   room?.current_round ?? 1,
    })

    if (voteError) {
      setError('Vote failed — try again.')
      setSubmitting(false)
      return
    }
    onVoted()
  }

  const progressPct = humanCount > 0 ? (voteCount / humanCount) * 100 : 0

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 z-50"
      style={{ background: 'rgba(255,255,255,0.97)' }}>
      <div className="w-full max-w-md fade-up">

        {/* Header */}
        <div className="pb-4 mb-5" style={{ borderBottom: '1px solid rgba(10,10,10,0.12)' }}>
          <p className="text-xs font-mono text-dim tracking-widest uppercase mb-1">
            Round complete — voting
          </p>
          <h2 className="font-display text-4xl tracking-wider text-ink">
            Who is the AI?
          </h2>
        </div>

        {/* Vote progress bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-mono text-dim tracking-widest uppercase">
              Votes received
            </span>
            <span className="text-xs font-mono text-ink font-bold">
              {voteCount}/{humanCount}
            </span>
          </div>
          <div style={{ height: '2px', background: 'rgba(10,10,10,0.08)', borderRadius: 1 }}>
            <div style={{
              height:     '100%',
              width:      `${progressPct}%`,
              background: '#0A0A0A',
              borderRadius: 1,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <p className="text-xs font-mono mt-1" style={{ color: 'rgba(10,10,10,0.35)' }}>
            Selections hidden until all votes are in
          </p>
        </div>

        {/* Player list */}
        <div className="mb-6">
          {otherPlayers.length === 0 && (
            <p className="text-xs font-mono text-dim text-center py-4">
              Loading players...
            </p>
          )}
          {otherPlayers.map(player => (
            <button
              key={player.codename}
              onClick={() => setSelected(player.codename)}
              className={`vote-card ${selected === player.codename ? 'selected' : ''}`}
            >
              <span className={`font-display text-xl tracking-widest ${
                selected === player.codename ? 'text-ink' : 'text-dim'
              }`}>
                {selected === player.codename ? '■ ' : '  '}{player.codename}
              </span>
            </button>
          ))}
        </div>

        {/* Reason textarea */}
        <div className="mb-6">
          <label className="block text-xs font-mono text-dim tracking-widest uppercase mb-2">
            Why do you suspect them?
            <span className="ml-2" style={{ opacity: 0.45 }}>
              (min {MIN_REASON} chars)
            </span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value.slice(0, MAX_REASON))}
            className="chat-input w-full text-sm font-mono resize-none h-20"
            style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
            placeholder="Too formal. Didn't react to the joke. Perfect grammar under pressure..."
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs font-mono ${reasonValid ? 'text-ink' : 'text-dim'}`}>
              {reason.length}/{MAX_REASON}
            </span>
            {!reasonValid && reason.length > 0 && (
              <span className="text-xs font-mono text-warn">
                {MIN_REASON - reason.trim().length} more chars needed
              </span>
            )}
          </div>
        </div>

        {error && <p className="text-warn text-xs font-mono mb-4">{error}</p>}

        <button
          onClick={submitVote}
          disabled={!canSubmit}
          className="w-full py-3 bg-ink text-paper font-mono text-sm font-bold tracking-widest uppercase
                     hover:opacity-75 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : selected ? `Vote for ${selected}` : '— select a player —'}
        </button>

        <p className="text-xs font-mono text-dim text-center mt-4">
          Your reason will be used to train the AI.{' '}
          <span style={{ opacity: 0.45 }}>Make it specific.</span>
        </p>
      </div>
    </div>
  )
}
