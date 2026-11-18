/** Public URL of a stored media object, or undefined when no media host is configured. */
export function mediaUrl(key: string) {
  const base = (
    import.meta.env.VITE_MEDIA_URL ||
    (import.meta.env.DEV ? 'http://localhost:9000/core-team-images' : '')
  ).replace(/\/$/, '')
  return base
    ? `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
    : undefined
}
