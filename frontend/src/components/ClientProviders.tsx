import React from 'react'
import { MotionConfig } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
import { NavbarProvider } from '@/contexts/NavbarContext'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { PostOAuthRedirect } from './post-oauth-redirect'

interface ClientProvidersProps {
  children: React.ReactNode
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PostOAuthRedirect />
        <MotionConfig reducedMotion="user">
          <NavbarProvider>{children}</NavbarProvider>
        </MotionConfig>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}
