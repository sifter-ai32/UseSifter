import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { getImageUrl } from '@/lib/utils'

const NAV_LINKS = ['DASHBOARD', 'MESSAGES', 'DEAL ROOMS', 'OPPORTUNITIES', 'PROFILE']

const LINK_ROUTES: Record<string, string> = {
  'DASHBOARD': '/freelancer/dashboard',
  'MESSAGES': '/freelancer/dealrooms',
  'DEAL ROOMS': '/freelancer/dealroom',
  'OPPORTUNITIES': '/freelancer/opportunities',
  'PROFILE': '/freelancer/profile',
}

function LogoIcon() {
  return <img src="/sifter-navbar-logo.png" alt="Sifter" className="h-8 w-auto" />
}

export default function FreelancerHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const avatarUrl = getImageUrl(user?.avatar)
  const initial = (user?.name || 'U').charAt(0).toUpperCase()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileOpen])

  const isActive = (link: string) => {
    const route = LINK_ROUTES[link]
    if (location.pathname === route) return true
    return location.pathname.startsWith(route + '/')
  }

  return (
    <>
      <header className="fixed grid grid-cols-2 lg:grid-cols-3 bg-[#000000]/80 h-16 z-[100] border-[#ffffff]/10 border-b pr-6 pl-6 top-0 right-0 left-0 backdrop-blur-md items-center">
        {/* Left: Logo */}
        <div className="flex items-center justify-start">
          <button type="button" onClick={() => navigate('/freelancer')} className="cursor-pointer">
            <LogoIcon />
          </button>
        </div>

        {/* Center: Desktop Links */}
        <nav className="hidden lg:flex items-center justify-center gap-8">
          {NAV_LINKS.map((link) => {
            const active = isActive(link)
            return (
              <button
                key={link}
                type="button"
                onClick={() => navigate(LINK_ROUTES[link])}
                className={[
                  'relative pb-2.5 text-xs tracking-widest transition-colors whitespace-nowrap cursor-pointer font-light',
                  active ? 'text-[#fafafa]' : 'text-[#a6a6a6] hover:text-[#fafafa]',
                ].join(' ')}
              >
                {link}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#fafafa]" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Right: Controls */}
        <div className="flex gap-x-5 gap-y-5 items-center justify-end">
          <div ref={profileRef} className="relative">
            <button type="button" onClick={() => setProfileOpen((v) => !v)} className="w-8 h-8 rounded-full overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-[#ffffff]/20 transition-all">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-[#e5e5e5] text-sm font-semibold">
                  {initial}
                </div>
              )}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-11 w-44 bg-[#111111] border border-[#ffffff]/[0.08] rounded-xl shadow-2xl overflow-hidden z-[200]">
                <button type="button" onClick={() => { setProfileOpen(false); navigate('/settings') }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                  <Settings className="w-4 h-4" strokeWidth={1.5} />
                  Settings
                </button>
                <div className="border-t border-[#ffffff]/[0.06]" />
                <button type="button" onClick={() => { setProfileOpen(false); logout(); navigate('/') }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#ef4444] hover:bg-[#ef4444]/10 transition-all cursor-pointer">
                  <LogOut className="w-4 h-4" strokeWidth={1.5} />
                  Logout
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-[#a6a6a6] hover:text-[#fafafa] relative w-5 h-5 ml-2 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-[#000000]/95 backdrop-blur-xl z-[90] flex flex-col items-center justify-center gap-8">
          {NAV_LINKS.map((link) => {
            const active = isActive(link)
            return (
              <button
                key={link}
                type="button"
                onClick={() => { navigate(LINK_ROUTES[link]); setMobileMenuOpen(false) }}
                className={[
                  'relative pb-2.5 text-sm tracking-widest transition-colors whitespace-nowrap cursor-pointer font-light',
                  active ? 'text-[#fafafa]' : 'text-[#a6a6a6] hover:text-[#fafafa]',
                ].join(' ')}
              >
                {link}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#fafafa]" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
