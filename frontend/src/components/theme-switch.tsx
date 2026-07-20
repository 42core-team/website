import { Check, Gamepad2, Moon, Sun } from 'lucide-react'
import type { Theme } from '@/lib/theme'
import { useTheme } from '@/lib/theme'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/themed'

export function ThemeSwitch() {
  const { setTheme, theme } = useTheme()

  const themes: Array<{
    icon: typeof Sun
    label: string
    value: Theme
  }> = [
    { icon: Sun, label: 'White', value: 'light' },
    { icon: Moon, label: 'Dark', value: 'dark' },
    { icon: Gamepad2, label: '8bit', value: '8bit' },
  ]

  const ActiveIcon =
    themes.find((option) => option.value === theme)?.icon ?? Moon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Choose theme. Current theme: ${theme}`}
        >
          <ActiveIcon className="size-[1.2rem]" />
          <span className="sr-only">Choose theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((option) => {
          const Icon = option.icon

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="gap-2"
            >
              <Icon className="size-4" />
              <span className="flex-1">{option.label}</span>
              {theme === option.value && <Check className="size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
