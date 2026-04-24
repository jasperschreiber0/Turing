import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Room       = { id: string; code: string; topic: string; ai_codename: string; status: string; current_round: number; round_ends_at: string | null; voting_ends_at: string | null; misdirection_target: string | null }
export type RoomPlayer = { id: string; room_id: string; player_id: string | null; codename: string; role: 'detector' | 'ai' | 'sleeper'; is_ai: boolean }
export type Message    = { id: string; room_id: string; player_id: string | null; is_ai: boolean; codename: string; content: string; evaluator_score: string | null; tell_tags: string[]; sent_at: string }
export type Vote       = { id: string; room_id: string; voter_id: string; voted_codename: string; reason: string; is_correct: boolean | null; round_number: number }
