import * as React from 'react'
import { ThemeProvider as ClientThemeProvider } from '@/lib/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ClientThemeProvider>{children}</ClientThemeProvider>
}
