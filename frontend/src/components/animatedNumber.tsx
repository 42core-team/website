"use client";

import { animate } from "framer-motion";
import { useEffect, useRef } from "react";

export default function AnimatedNumber({ value }: { value: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node)
      return;

    const startValue = prevValueRef.current === null ? 0 : prevValueRef.current;

    const controls = animate(startValue, value, {
      duration: 2,
      onUpdate(v) {
        node.textContent = v.toFixed(0);
      },
    });

    prevValueRef.current = value;

    return () => controls.stop();
  }, [value]);

  return <span ref={nodeRef} />;
}
