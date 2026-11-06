/** Takes keyboard focus once loaded, so keys like space control the replay. */
export function MatchVisualizerFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      title="Match visualizer"
      // Focus arrives without user input, which would otherwise draw a ring
      // around the whole viewport.
      className="h-full w-full outline-none"
      allowFullScreen
      onLoad={(event) => {
        // Leave focus alone if the user already moved it while this loaded.
        if (document.activeElement !== document.body) return
        event.currentTarget.focus({ preventScroll: true })
      }}
    />
  )
}
