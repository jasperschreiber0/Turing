'use client'

import { create } from 'zustand'
import type { Room, RoomPlayer, Message, Vote } from '@/lib/supabase/client'

type GameState = {
  room:         Room | null
  players:      RoomPlayer[]
  messages:     Message[]
  votes:        Vote[]
  myPlayer:     RoomPlayer | null
  myRole:       'detector' | 'ai' | 'sleeper' | null
  aiCodename:   string | null
  isTyping:     boolean
  typingPlayers: string[]
  roundEndsAt:  Date | null
  votingEndsAt: Date | null
  revealed:         boolean
  revealStep:       number
  grudgeMessage:    string | null
  consentGiven: boolean | null
  setRoom:          (room: Room) => void
  setPlayers:       (players: RoomPlayer[]) => void
  addMessage:       (msg: Message) => void
  setMyPlayer:      (p: RoomPlayer) => void
  setAiCodename:    (name: string) => void
  setTypingPlayers: (codenames: string[]) => void
  startReveal:      () => void
  nextRevealStep:   () => void
  setGrudgeMessage: (msg: string) => void
  setConsent:       (given: boolean) => void
  addVote:          (vote: Vote) => void
  reset:            () => void
}

export const useGameStore = create<GameState>((set) => ({
  room: null, players: [], messages: [], votes: [],
  myPlayer: null, myRole: null, aiCodename: null,
  isTyping: false, typingPlayers: [],
  roundEndsAt: null, votingEndsAt: null,
  revealed: false, revealStep: 0,
  grudgeMessage: null, consentGiven: null,
  setRoom:          (room) => set({ room, roundEndsAt: room.round_ends_at ? new Date(room.round_ends_at) : null }),
  setPlayers:       (players) => set({ players }),
  addMessage:       (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMyPlayer:      (p) => set({ myPlayer: p, myRole: p.role }),
  setAiCodename:    (name) => set({ aiCodename: name }),
  setTypingPlayers: (codenames) => set({ typingPlayers: codenames }),
  startReveal:      () => set({ revealed: true, revealStep: 0 }),
  nextRevealStep:   () => set((s) => ({ revealStep: s.revealStep + 1 })),
  setGrudgeMessage: (msg) => set({ grudgeMessage: msg }),
  setConsent:       (given) => set({ consentGiven: given }),
  addVote:          (vote) => set((s) => ({ votes: [...s.votes, vote] })),
  reset:            () => set({
    room: null, players: [], messages: [], votes: [],
    myPlayer: null, myRole: null, aiCodename: null,
    typingPlayers: [], roundEndsAt: null, votingEndsAt: null,
    revealed: false, revealStep: 0, grudgeMessage: null, consentGiven: null,
  }),
}))
