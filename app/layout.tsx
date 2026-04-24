import type { Metadata } from 'next'
import { Bebas_Neue, Barlow_Condensed, Courier_Prime } from 'next/font/google'
import './globals.css'

const bebas   = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas', display: 'swap' })
const barlow  = Barlow_Condensed({ subsets: ['latin'], weight: ['300','400','500','600'], variable: '--font-barlow', display: 'swap' })
const courier = Courier_Prime({ subsets: ['latin'], weight: ['400','700'], variable: '--font-courier', display: 'swap' })

export const metadata: Metadata = {
  title: "Faus — Who's the Bot?",
  description: "Four players. One AI. Three minutes to figure out who — or what — you're talking to.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${barlow.variable} ${courier.variable}`}>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
