import type { Metadata } from 'next'
import { Poppins, Mitr } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const mitr = Mitr({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600'],
  variable: '--font-mitr',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI Overview Tracker — NerdOptimize × Ahrefs',
  description:
    'Track AI Overview citation KPIs per project with Ahrefs-backed Site Explorer data — NerdOptimize.',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${mitr.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
