'use client'

import dynamic from 'next/dynamic'

const Lobby = dynamic(() => import('@/components/game/LobbyInner'), { ssr: false })

export default function LobbyPage() {
  return <Lobby />
}
