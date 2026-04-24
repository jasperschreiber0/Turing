import type { Metadata } from 'next'
import { DM_Sans, DM_Mono, Bebas_Neue } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm', display: 'swap' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300','400','500'], variable: '--font-mono', display: 'swap' })
const bebas  = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas', display: 'swap' })

export const metadata: Metadata = {
  title: 'TURING',
  description: 'Find the AI before it fools you.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${bebas.variable}`}>
      <body className="antialiased min-h-screen font-mono" style={{ background: '#FFFFFF', color: '#0A0A0A' }}>
        {children}
      </body>
    </html>
  )
}
