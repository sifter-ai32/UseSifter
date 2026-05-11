import { useState, useEffect } from 'react'

export function useTypewriter(text: string, delay = 600) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let charIdx = 0
    let timeout: ReturnType<typeof setTimeout>

    const startTimeout = setTimeout(() => {
      function type() {
        if (charIdx < text.length) {
          setDisplayed(text.slice(0, charIdx + 1))
          charIdx++
          timeout = setTimeout(type, Math.random() * 20 + 20)
        } else {
          setTimeout(() => setDone(true), 400)
        }
      }
      type()
    }, delay)

    return () => {
      clearTimeout(startTimeout)
      clearTimeout(timeout)
    }
  }, [text, delay])

  return { displayed, done }
}
