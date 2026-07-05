import React from 'react'

type AppImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null
  width?: number | string
  height?: number | string
}

export default function Image({
  src,
  alt = '',
  width,
  height,
  style,
  ...props
}: AppImageProps) {
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
