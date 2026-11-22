import { useSearchParam } from '@/hooks/useSearchParam'

export function useTabParam(defaultTab: string = 'graph') {
  const [tab, setTab] = useSearchParam('tab', { push: true })
  return { currentTab: tab || defaultTab, onTabChange: setTab }
}
