'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '@/stores/game'
import { createClient } from '@/lib/supabase/client'

type Props = {
  roomCode:   string
  playerId:   string
  onDecision: (optedIn: boolean) => void
}

export function ConsentOverlay({ roomCode, playerId, onDecision }: Props) {
  const supabase    = createClient()
  const setConsent  = useGameStore(s => s.setConsent)
  const consentGiven = useGameStore(s => s.consentGiven)

  if (consentGiven !== null) return null

  async function decide(optedIn: boolean) {
    await supabase.from('consent_records').upsert({
      player_id:    playerId,
      session_code: roomCode,
      opted_in:     optedIn,
      decided_at:   new Date().toISOString(),
    }, { onConflict: 'player_id,session_code' })
    setConsent(optedIn)
    onDecision(optedIn)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="consent-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm mx-4 bg-paper p-8"
          style={{ border: '1px solid rgba(10,10,10,0.12)' }}
        >
          <div className="w-full h-px mb-6" style={{ background: 'rgba(10,10,10,0.12)' }} />

          <p className="text-xs font-mono text-dim tracking-widest uppercase mb-4">
            Research consent
          </p>

          <p className="font-mono text-sm text-ink leading-relaxed mb-6">
            Your vote reasons may be used in anonymised research studying how
            humans identify AI-generated text. No personally identifiable
            information is stored.
          </p>

          <p className="text-xs font-mono text-dim mb-8">
            Either way you can play. This only affects whether your vote
            reasons enter the research dataset.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => decide(true)}
              className="w-full py-3 bg-ink text-paper font-mono text-sm font-bold tracking-widest uppercase hover:opacity-75 transition-opacity"
            >
              Join and opt in to research
            </button>
            <button
              onClick={() => decide(false)}
              className="w-full py-3 font-mono text-sm tracking-widest uppercase hover:text-ink transition-colors text-dim"
              style={{ border: '1px solid rgba(10,10,10,0.2)' }}
            >
              Join without opting in
            </button>
          </div>

          <div className="w-full h-px mt-6" style={{ background: 'rgba(10,10,10,0.08)' }} />
          <p className="text-xs font-mono text-dim text-center mt-3">
            Data stored in Australia · APP compliant
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
