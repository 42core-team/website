'use client'

import { Label } from '@/components/ui/8bit/label'
import { Switch } from '@/components/ui/8bit/switch'
import { usePathname, useRouter, useSearchParams } from '@/lib/router-hooks'

interface AdminRevealSwitchProps {
  disabled?: boolean
}

export function AdminRevealSwitch({
  disabled = false,
}: AdminRevealSwitchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isAdminReveal = searchParams.get('adminReveal') === 'true'

  return (
    <div className="flex items-center space-x-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 shadow-sm">
      <Switch
        id="admin-reveal"
        checked={isAdminReveal}
        disabled={disabled}
        onCheckedChange={(value) => {
          const params = new URLSearchParams(searchParams.toString())
          if (value) {
            params.set('adminReveal', 'true')
          } else {
            params.delete('adminReveal')
          }
          const query = params.toString()
          router.replace(query ? `${pathname}?${query}` : pathname)
        }}
      />
      <Label
        htmlFor="admin-reveal"
        className="cursor-pointer select-none text-xs font-medium"
      >
        Admin View
      </Label>
    </div>
  )
}
