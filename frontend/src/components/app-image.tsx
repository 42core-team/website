import React from 'react'

type AppImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null
  width?: number | string
  height?: number | string
  priority?: boolean
  unoptimized?: boolean
}

export default function Image({
  src,
  alt = '',
  width,
  height,
  priority: _priority,
  unoptimized: _unoptimized,
  style,
  ...props
}: AppImageProps) {
  void _priority
  void _unoptimized

  return (
    <img
      src={src || undefined}
      alt={alt}
      width={width}
      height={height}
      style={{ maxWidth: '100%', height: 'auto', ...style }}
      {...props}
    />
  )
}
