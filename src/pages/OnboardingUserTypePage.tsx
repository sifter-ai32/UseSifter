import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, User, Search, ArrowRight } from 'lucide-react'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useAuthStore } from '@/stores/authStore'

const TYPEWRITER_TEXT = 'What are you here for?'

interface OptionProps {
  icon: React.ReactNode
  label: string
  selected: boolean
  onClick: () => void
}

function OptionButton({ icon, label, selected, onClick }: OptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center w-full border rounded-xl relative shadow-sm cursor-pointer transition-all duration-200 group text-left ${
        selected
          ? 'bg-white/[0.15] border-white/40 ring-1 ring-white/20'
          : 'bg-white/5 border-white/[0.12] hover:bg-white/10 hover:border-white/20'
      }`}
      style={{ padding: '18px 20px' }}
    >
      <span className={`mr-4 shrink-0 transition-colors duration-200 ${selected ? 'text-[#e5e5e5]' : 'text-[#a3a3a3] group-hover:text-[#e5e5e5]'}`}>
        {icon}
      </span>
      <span className={`text-lg font-normal transition-colors duration-200 ${selected ? 'text-white' : 'text-[#e5e5e5] group-hover:text-white'}`}>
        {label}
      </span>
    </button>
  )
}

export default function OnboardingUserTypePage() {
  const [selected, setSelected] = useState<string | null>(null)
  const navigate = useNavigate()
  const setUserType = useAuthStore((s) => s.setUserType)
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete)
  const existingUserType = useAuthStore((s) => s.userType)
  const { displayed, done } = useTypewriter(TYPEWRITER_TEXT)

  // If onboarding is already complete, redirect to dashboard (or pending invite)
  useEffect(() => {
    if (onboardingComplete && existingUserType) {
      const invite = sessionStorage.getItem('sifter-invite-redirect')
      if (invite) {
        sessionStorage.removeItem('sifter-invite-redirect')
        navigate(invite, { replace: true })
      } else {
        navigate(existingUserType === 'talent' ? '/freelancer/dashboard' : '/chat', { replace: true })
      }
    }
  }, [onboardingComplete, existingUserType, navigate])

  const handleContinue = () => {
    if (!selected) return
    setUserType(selected as 'client' | 'talent')
    const invite = sessionStorage.getItem('sifter-invite-redirect')
    if (invite) {
      sessionStorage.removeItem('sifter-invite-redirect')
      navigate(invite)
    } else if (selected === 'client') {
      navigate('/chat')
    } else {
      navigate('/onboarding/freelancer')
    }
  }

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

        {/* Options */}
        <div className={`w-full transition-all duration-[800ms] ease-out ${done ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div className="flex flex-col w-full gap-3">
            <OptionButton
              icon={<User className="w-[22px] h-[22px]" strokeWidth={1.5} />}
              label="I am Talent"
              selected={selected === 'talent'}
              onClick={() => setSelected('talent')}
            />
            <OptionButton
              icon={<Search className="w-[22px] h-[22px]" strokeWidth={1.5} />}
              label="I need Talent"
              selected={selected === 'client'}
              onClick={() => setSelected('client')}
            />

            {/* Continue Button */}
            <div className="flex items-center justify-end w-full mt-2">
              <button
                type="button"
                onClick={handleContinue}
                className="flex items-center justify-center rounded-full cursor-pointer transition-colors duration-200 bg-[#e5e5e5] hover:bg-[#a3a3a3] text-[#0a0a0a] font-medium"
                style={{ padding: '10px 24px' }}
              >
                Continue
                <ArrowRight className="w-[18px] h-[18px] ml-2" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
