import { useEffect, useState } from 'react'

// Canvas needs resolved colors. Chart.js cannot resolve CSS custom properties.
function getChartTheme() {
  const styles =
    typeof document === 'undefined'
      ? undefined
      : getComputedStyle(document.documentElement)
  const color = (role: string, fallback: string) =>
    styles?.getPropertyValue(`--${role}`).trim() || fallback
  const foreground = color('foreground', '#17131a')
  const mutedForeground = color('muted-foreground', '#626262')
  const border = color('border', '#e2dae6')

  return {
    foreground,
    mutedForeground,
    border,
    series: [
      color('chart-1', '#8725ab'),
      color('chart-2', '#a64a00'),
      color('chart-3', '#176951'),
      color('chart-4', '#2465a4'),
      color('chart-5', '#9f365e'),
    ],
    tooltip: {
      backgroundColor: color('popover', '#ffffff'),
      titleColor: foreground,
      bodyColor: foreground,
      footerColor: mutedForeground,
      borderColor: border,
      borderWidth: 1,
    },
  }
}

export function useChartTheme() {
  const [theme, setTheme] = useState(getChartTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getChartTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
