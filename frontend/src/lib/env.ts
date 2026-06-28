export function getBackendBaseUrl() {
  return (
    import.meta.env.VITE_BACKEND_PUBLIC_URL
    || import.meta.env.VITE_BACKEND_URL
    || "http://localhost:4000"
  ).replace(/\/$/, "");
}

export function getVisualizerUrl() {
  return (import.meta.env.VITE_VISUALIZER_URL || "").replace(/\/$/, "");
}
