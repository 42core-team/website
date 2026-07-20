import React from 'react'

export type Theme = 'light' | 'dark' | '8bit'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined,
)

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'dark'
    }

    const stored = window.localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark' || stored === '8bit') {
      return stored
    }

    if (stored === 'system' || stored === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }

    return 'dark'
  })
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>(
    () => resolveTheme(theme),
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const applyTheme = () => {
      const resolved = resolveTheme(theme)
      setResolvedTheme(resolved)
      document.documentElement.classList.toggle('dark', resolved === 'dark')
      document.documentElement.classList.toggle('light', resolved === 'light')
      document.documentElement.classList.toggle('theme-8bit', theme === '8bit')
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = resolved
    }

    applyTheme()
  }, [theme])

  const setTheme = React.useCallback((nextTheme: Theme) => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem('theme', nextTheme)
    setThemeState(nextTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const value = React.useContext(ThemeContext)

  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return value
}

export function useOptionalTheme() {
  return React.useContext(ThemeContext)
}
