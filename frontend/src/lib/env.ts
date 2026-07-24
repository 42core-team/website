export function getBackendBaseUrl() {
  return (
    import.meta.env.VITE_BACKEND_PUBLIC_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    'http://localhost:4000'
  ).replace(/\/$/, '')
}

export function getVisualizerUrl() {
  return (import.meta.env.VITE_VISUALIZER_URL || '').replace(/\/$/, '')
}

export function getFortyTwoClientId() {
  return import.meta.env.VITE_FORTY_TWO_CLIENT_ID || ''
}

export function getS3ReplaysBucketUrl() {
  return (import.meta.env.VITE_S3_REPLAYS_BUCKET_URL || '').replace(/\/$/, '')
}
