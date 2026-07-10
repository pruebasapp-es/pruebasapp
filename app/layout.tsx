import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fichaje Inteligente',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  )
}
