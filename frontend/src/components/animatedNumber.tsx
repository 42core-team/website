'use client'

import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

const numberFormatter = new Intl.NumberFormat('en-US')

export default function AnimatedNumber({ value }: { value: number }) {
  const prefersReducedMotion = useReducedMotion()
  const nodeRef = useRef<HTMLSpanElement>(null)
  const prevValueRef = useRef<number | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    if (prefersReducedMotion) {
      node.textContent = numberFormatter.format(value)
      prevValueRef.current = value
      return
    }

    const startValue = prevValueRef.current === null ? 0 : prevValueRef.current

    const controls = animate(startValue, value, {
      duration: 0.8,
      onUpdate(v) {
        node.textContent = numberFormatter.format(Math.round(v))
      },
    })

    prevValueRef.current = value

    return () => controls.stop()
  }, [prefersReducedMotion, value])

  return <span ref={nodeRef} />
}
