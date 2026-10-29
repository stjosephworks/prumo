import { useEffect, useState } from 'react'

// Seconds left before something may be asked again, counting down to zero once started.
export function useCooldown(): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (left <= 0) {
      return
    }

    const timer = setTimeout(() => setLeft(left - 1), 1000)

    return () => clearTimeout(timer)
  }, [left])

  return [left, setLeft]
}
