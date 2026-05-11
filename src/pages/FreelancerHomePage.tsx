import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Briefcase, TrendingUp, ArrowRight } from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'

function WordSpan({ word, delay }: { word: string; delay: number }) {
  return (
    <span
      className="inline-block opacity-0 whitespace-pre animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]"
      style={{ animationDelay: `${delay}s` }}
    >
      {word}{' '}
    </span>
  )
}

interface PromptCardProps {
  icon: React.ReactNode
  text: string
  onClick: () => void
}

function PromptCard({ icon, text, onClick }: PromptCardProps) {
  return (
    <div onClick={onClick} className="border border-[#737373]/20 bg-[#ffffff]/[0.02] rounded-2xl p-4 sm:p-5 flex flex-col justify-between items-start min-h-[110px] sm:min-h-[130px] hover:bg-[#ffffff]/[0.05] hover:border-[#737373]/40 transition-all duration-300 cursor-pointer group gap-3">
      <span className="text-[#737373] group-hover:text-[#fafafa] transition-colors">
        {icon}
      </span>
      <p className="text-sm sm:text-base text-[#fafafa] font-extralight leading-snug">
        {text}
      </p>
    </div>
  )
}

export default function FreelancerHomePage() {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [message])

  const userName = useAuthStore((s) => s.user?.name) || 'User'

  const handleSend = () => {
    if (!message.trim()) return
    navigate('/freelancer/chat', { state: { message: message.trim() } })
  }

  const handlePromptClick = (text: string) => {
    setMessage(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] selection:bg-[#737373]/40 selection:text-[#ffffff]">
      <Header />

      <main className="flex-1 h-full w-full overflow-y-auto relative flex flex-col items-center pt-24 sm:pt-32 pb-12 px-5 sm:px-8">
        <div className="flex flex-col gap-8 sm:gap-12 w-full max-w-[760px] my-auto justify-center">

          {/* Hero Headings */}
          <div className="flex flex-col gap-x-4 gap-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-[#fafafa] leading-[1.15] flex flex-col">
              <div className="w-full">
                {['Hi', 'there,'].map((word, i) => (
                  <WordSpan key={word} word={word} delay={0.1 + i * 0.1} />
                ))}
                <WordSpan word={userName} delay={0.3} />
              </div>
              <div className="w-full text-[#a6a6a6]">
                {['What', 'are', 'you', 'looking', 'for?'].map((word, i) => (
                  <WordSpan key={word} word={word} delay={1.0 + i * 0.1} />
                ))}
              </div>
            </h1>
          </div>

          {/* Prompt Cards */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 opacity-0 animate-[fadeUp_1.5s_cubic-bezier(0.16,1,0.3,1)_forwards]"
            style={{ animationDelay: '2.3s' }}
          >
            <PromptCard
              icon={<Search className="w-5 h-5" strokeWidth={1.5} />}
              text="Find opportunities that match my skills"
              onClick={() => handlePromptClick('Find opportunities that match my skills')}
            />
            <PromptCard
              icon={<Briefcase className="w-5 h-5" strokeWidth={1.5} />}
              text="Help me prepare a proposal for a project"
              onClick={() => handlePromptClick('Help me prepare a proposal for a project')}
            />
            <PromptCard
              icon={<TrendingUp className="w-5 h-5" strokeWidth={1.5} />}
              text="How can I improve my profile visibility?"
              onClick={() => handlePromptClick('How can I improve my profile visibility?')}
            />
          </div>

          {/* Main Input Area */}
          <div
            className="border border-[#737373]/30 rounded-3xl bg-[#ffffff]/[0.03] flex flex-col relative focus-within:border-[#737373] focus-within:bg-[#ffffff]/[0.05] transition-all duration-300 shadow-lg mt-0 sm:mt-2 opacity-0 animate-[fadeUp_1.5s_cubic-bezier(0.16,1,0.3,1)_forwards]"
            style={{ animationDelay: '2.9s' }}
          >
            <div className="p-3 sm:p-5 flex flex-col gap-3 sm:gap-4">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <textarea
                  ref={textareaRef}
                  placeholder="Ask whatever you want..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="bg-transparent border-none outline-none resize-none text-[#fafafa] placeholder:text-[#737373] w-full min-h-[40px] sm:min-h-[56px] text-base sm:text-lg font-extralight py-1"
                  rows={1}
                />
              </div>
            </div>

            <div className="px-3 sm:px-5 pb-3 sm:pb-4 flex items-center justify-end">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-xs sm:text-sm font-extralight text-[#737373]">
                  {message.length}/1000
                </span>
                <button
                  type="button"
                  onClick={handleSend}
                  className="bg-[#fafafa] text-[#000000] p-1.5 rounded-xl hover:opacity-80 transition-opacity flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
