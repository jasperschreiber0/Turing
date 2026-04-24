'use client'
import dynamic from 'next/dynamic'
const Room = dynamic(() => import('@/components/game/RoomInner'), { ssr: false })
export default function RoomPage() { return <Room /> }
