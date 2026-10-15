import { useSyncExternalStore } from 'react'

export type WikiLanguage = 'c' | 'go'

const LANGUAGES: readonly WikiLanguage[] = ['c', 'go']

const DEFAULT_LANGUAGE: WikiLanguage = 'c'
const STORAGE_KEY = 'wiki-language'
const QUERY_PARAM = 'lang'

const listeners = new Set<() => void>()
let current: WikiLanguage | null = null

export function parseWikiLanguage(value: unknown): WikiLanguage | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return LANGUAGES.includes(normalized as WikiLanguage)
    ? (normalized as WikiLanguage)
    : null
}

// The ?lang= query parameter wins over the saved choice so that links such as
// /wiki/my_first_core_bot?lang=go open in the intended language.
function readInitialLanguage(): WikiLanguage {
  const fromQuery = parseWikiLanguage(
    new URLSearchParams(window.location.search).get(QUERY_PARAM),
  )
  if (fromQuery) {
    saveLanguage(fromQuery)
    return fromQuery
  }
  try {
    return (
      parseWikiLanguage(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_LANGUAGE
    )
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function saveLanguage(language: WikiLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Ignore storage errors; the choice then lasts until the page reloads.
  }
}

function getSnapshot(): WikiLanguage {
  current ??= readInitialLanguage()
  return current
}

function getServerSnapshot(): WikiLanguage {
  return DEFAULT_LANGUAGE
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setWikiLanguage(language: WikiLanguage) {
  if (language === getSnapshot()) return
  current = language
  saveLanguage(language)
  listeners.forEach((listener) => listener())
}

/**
 * The programming language the reader last chose in a C/Go code group. All
 * code groups and language-specific blocks follow it.
 */
export function useWikiLanguage(): WikiLanguage {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
