import { useState, useEffect, useRef, useCallback } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ArrowUp } from 'lucide-react'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useAuthStore } from '@/stores/authStore'

const TYPEWRITER_TEXT = 'Before we get started, what should I call you?'

export default function OnboardingNamePage() {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const setStoreName = useAuthStore((s) => s.setName)
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete)
  const userType = useAuthStore((s) => s.userType)
  const existingName = useAuthStore((s) => s.user?.name)
  const { displayed, done } = useTypewriter(TYPEWRITER_TEXT)

  const firstLetter = name.trim().charAt(0).toUpperCase() || '?'

  // If onboarding is already complete, redirect to dashboard
  useEffect(() => {
    if (onboardingComplete && userType) {
      navigate(userType === 'talent' ? '/freelancer/dashboard' : '/chat', { replace: true })
    } else if (existingName && existingName.trim()) {
      // User already has a name, skip to type selection
      navigate('/onboarding/type', { replace: true })
    }
  }, [onboardingComplete, userType, existingName, navigate])

  useEffect(() => {
    if (done) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 800)
      return () => clearTimeout(timeout)
    }
  }, [done])

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setStoreName(name.trim())
    navigate('/onboarding/type')
  }, [name])

  return (
    <div className="min-h-screen antialiased overflow-x-hidden bg-[#0a0a0a]">
      <main className="flex flex-col w-full max-w-2xl px-6 mx-auto items-start pt-32">
        {/* Decorative Icon */}
        <div className="mb-6 flex items-center justify-center">
          <Sparkles className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />
        </div>

        {/* Typewriter Text */}
        <div className="min-h-[3rem] flex w-full mb-3 items-start">
          <h1 className="leading-snug text-3xl font-light text-[#e5e5e5] tracking-tight w-full">
            {displayed.split('').map((char, i) => (
              char === ' ' ? (
                <span key={i}>{' '}</span>
              ) : (
                <span
                  key={i}
                  className="inline-block animate-[charFadeIn_0.3s_cubic-bezier(0.1,0.9,0.2,1)_forwards]"
                >
                  {char}
                </span>
              )
            ))}
            {!done && (
              <span
                className="inline-block bg-[#e5e5e5] ml-[2px] shrink-0 animate-[cursorPulse_0.9s_ease-in-out_infinite]"
                style={{ width: 2, height: '1.8rem' }}
              />
            )}
          </h1>
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className={`w-full transition-all duration-[800ms] ease-out ${done ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
        >
          <div
            className="flex w-full border rounded-xl relative shadow-sm items-center"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', padding: '12px 20px' }}
          >
            {/* User Avatar */}
            <div
              className="flex items-center justify-center rounded-lg shrink-0 ml-1"
              style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.1)' }}
            >
              <span className="text-2xl font-medium text-red-300">{firstLetter}</span>
            </div>

            {/* Text Input */}
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 outline-none text-xl font-medium bg-transparent w-full pr-4 pl-4 text-[#e5e5e5] placeholder:text-[#525252]"
            />

            {/* Submit Button */}
            <button
              type="submit"
              className="flex items-center justify-center rounded-full shrink-0 cursor-pointer transition-colors duration-200 bg-[#e5e5e5] hover:bg-[#a3a3a3]"
              style={{ width: 34, height: 34, marginRight: 2 }}
            >
              <ArrowUp className="w-[18px] h-[18px] text-[#0a0a0a]" strokeWidth={1.5} />
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
