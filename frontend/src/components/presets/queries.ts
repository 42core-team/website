import { queryOptions } from '@tanstack/react-query'
import { getAdminPresets } from '@/app/actions/presets'

/** Active and archived presets; the admin list's tabs split them. */
export const adminPresetsQuery = queryOptions({
  queryKey: ['admin', 'presets'],
  queryFn: () => getAdminPresets(true),
})
