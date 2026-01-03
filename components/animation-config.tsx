"use client"

import { MotionConfig } from "framer-motion"

interface AnimationConfigProps {
  children: React.ReactNode
}

export function AnimationConfig({ children }: AnimationConfigProps) {
  return (
    // reducedMotion="user" tells Framer to respect the OS setting.
    // It will automatically turn transform animations (x, y, scale) into opacity fades.
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}