import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Sol',
  description: 'A campus guide for Sun Devils — demo build.',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="bg-bg text-fg min-h-full">{children}</body>
    </html>
  )
}
