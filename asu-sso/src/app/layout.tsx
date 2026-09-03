import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sol — Demo Sign In',
  description:
    'Mock OAuth 2.0 identity provider for the ASU AIR Spark Challenge. Not a real ASU login.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-asu-bg text-asu-ink antialiased font-sans">{children}</body>
    </html>
  )
}
