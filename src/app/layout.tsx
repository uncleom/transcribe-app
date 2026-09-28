import type { ReactNode } from 'react'
import './globals.css'

// Root layout is a pass-through; <html>/<body> live in [locale]/layout
// so `lang` can follow the active locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
