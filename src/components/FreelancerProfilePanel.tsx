import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  MapPin,
  Loader2,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react'
import * as api from '@/lib/api'
import { getImageUrl } from '@/lib/utils'

/* ─── Social Icons ─── */
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
)
const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
)
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
)
const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
)

const SOCIAL_ICON_MAP: Record<string, React.ReactNode> = {
  linkedin: <LinkedInIcon className="w-4 h-4" />,
  github: <GitHubIcon className="w-4 h-4" />,
  x: <XIcon className="w-4 h-4" />,
  portfolio: <GlobeIcon className="w-4 h-4" />,
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getSocialUrl(platform: string, url: string): string {
  if (url.startsWith('http')) return url
  if (platform === 'linkedin') return `https://linkedin.com/in/${url}`
  if (platform === 'github') return `https://github.com/${url}`
  if (platform === 'x') return `https://x.com/${url}`
  return url.startsWith('http') ? url : `https://${url}`
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Beginning: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  Processing: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  Completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
}

interface Props {
  freelancerId: string | null
  onClose: () => void
}

export default function FreelancerProfilePanel({ freelancerId, onClose }: Props) {
  const navigate = useNavigate()
  const [user, setUser] = useState<api.User | null>(null)
  const [platformProjects, setPlatformProjects] = useState<api.Project[]>([])
  const [loading, setLoading] = useState(false)
  const [aboutExpanded, setAboutExpanded] = useState(false)
  const [workHistoryTab, setWorkHistoryTab] = useState<'all' | 'in_progress' | 'completed'>('all')
  const [viewingProject, setViewingProject] = useState<api.PortfolioItem | null>(null)
  const portfolioScrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  // Load user data when freelancerId changes
  useEffect(() => {
    if (!freelancerId) {
      setVisible(false)
      return
    }
    setLoading(true)
    setUser(null)
    setAboutExpanded(false)
    setWorkHistoryTab('all')
    setViewingProject(null)

    // Trigger slide-in
    requestAnimationFrame(() => setVisible(true))

    Promise.all([
      api.getUser(freelancerId),
      api.listProjects({ memberId: freelancerId }),
    ]).then(([u, projects]) => {
      setUser(u)
      setPlatformProjects(projects)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [freelancerId])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    if (freelancerId) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [freelancerId])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300) // wait for slide-out animation
  }

  const handleMessage = useCallback(() => {
    if (!freelancerId) return
    handleClose()
    navigate(`/dealrooms?to=${freelancerId}`)
  }, [freelancerId, navigate])

  if (!freelancerId) return null

  const socialLinks = (user?.socialLinks ?? []) as api.SocialLink[]
  const workHistory = (user?.workHistory ?? []) as api.WorkHistoryItem[]
  const portfolio = (user?.portfolio ?? []) as api.PortfolioItem[]
  const languages = (user?.languages ?? []) as api.LanguageItem[]
  const education = (user?.education ?? []) as api.EducationItem[]
  const aboutParagraphs = user?.bio ? user.bio.split('\n').filter(Boolean) : []
  const avatarUrl = getImageUrl(user?.avatar)

  const filteredProjects = platformProjects.filter((p) => {
    if (workHistoryTab === 'all') return true
    if (workHistoryTab === 'in_progress') return p.status !== 'Completed'
    return p.status === 'Completed'
  })

  const scrollPortfolio = (dir: 'left' | 'right') => {
    const el = portfolioScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }

  return (
    <div className="fixed inset-0 top-16 z-50 flex justify-end">
      {/* Backdrop — no blur, just a light dim */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Panel — ~75% width like Upwork */}
      <div
        ref={panelRef}
        className={`relative w-full max-w-[75%] xl:max-w-[70%] h-full bg-[#0a0a0a] border-l border-[#ffffff]/10 overflow-y-auto transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#ffffff]/[0.06] px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-[#737373] hover:text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => { handleClose(); navigate(`/profile/${freelancerId}`) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[#fafafa] hover:bg-[#ffffff]/10 transition-colors cursor-pointer border border-[#ffffff]/10"
          >
            Open profile in new window
            <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-[#737373]" strokeWidth={1.5} />
          </div>
        ) : !user ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-sm text-[#525252]">User not found</p>
          </div>
        ) : (
          <div className="px-6 pb-10">

            {/* ── Profile Header ── */}
            <section className="flex items-center justify-between gap-4 py-6">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-full ring-2 ring-[#ffffff]/[0.08]" alt={user.name} />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-2 ring-[#ffffff]/[0.08] bg-[#1a1a1a] flex items-center justify-center text-lg sm:text-xl font-semibold text-[#e5e5e5] tracking-tight">
                      {getInitials(user.name || 'U')}
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#fafafa]">{user.name || 'Unnamed'}</h1>
                  {user.location && (
                    <div className="flex items-center gap-1.5 text-sm text-[#737373] mt-1">
                      <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>{user.location}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" className="p-2.5 rounded-xl border border-[#ffffff]/[0.08] text-[#737373] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                  <Share2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button type="button" onClick={handleMessage} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#cccccc] transition-colors cursor-pointer flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                  Message
                </button>
              </div>
            </section>

            <div className="border-t border-[#ffffff]/10" />

            {/* ── Title + Rate ── */}
            <div className="flex items-start justify-between gap-4 py-6">
              <h2 className="text-base font-semibold text-[#fafafa] tracking-tight">{user.title || user.headline || 'Freelancer'}</h2>
              {user.hourlyRate != null && (
                <span className="text-lg font-semibold text-[#fafafa] shrink-0">${user.hourlyRate.toFixed(2)}<span className="text-xs text-[#737373] font-normal">/hr</span></span>
              )}
            </div>

            {/* ── About ── */}
            {aboutParagraphs.length > 0 && (
              <div className="mb-6">
                <div className={`text-sm text-[#a6a6a6] font-light leading-[1.8] space-y-3 ${aboutExpanded ? '' : 'line-clamp-4'} transition-all duration-300`}>
                  {aboutParagraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
                {(user.bio?.length ?? 0) > 200 && (
                  <button type="button" onClick={() => setAboutExpanded((v) => !v)} className="text-xs text-[#fafafa] mt-3 font-medium hover:text-[#a6a6a6] transition-colors cursor-pointer">
                    {aboutExpanded ? 'less' : 'more'}
                  </button>
                )}
              </div>
            )}

            <div className="border-t border-[#ffffff]/10 my-2" />

            {/* ── Skills ── */}
            {user.skills.length > 0 && (
              <div className="py-6">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-4">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <span key={skill} className="px-3 py-1.5 rounded-full bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] text-xs font-medium text-[#a6a6a6]">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-[#ffffff]/10" />

            {/* ── Sidebar Info (inline in panel) ── */}
            <div className="grid grid-cols-2 gap-6 py-6">
              {/* Availability */}
              <div>
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Availability</h3>
                <div className="flex items-center gap-2 text-sm text-[#e5e5e5]">
                  <Clock className="w-4 h-4 text-[#10b981]" strokeWidth={1.5} />
                  <span>More than {user.availability ?? 30} hrs/week</span>
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Languages</h3>
                {languages.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {languages.map((lang, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm text-[#e5e5e5]">{lang.name}</span>
                        <span className="text-[10px] text-[#525252]">{lang.proficiency}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#525252]">Not specified</p>
                )}
              </div>

              {/* Education */}
              {education.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Education</h3>
                  <div className="flex flex-col gap-2">
                    {education.map((edu, i) => (
                      <div key={i}>
                        <p className="text-sm text-[#e5e5e5] font-medium">{edu.degree}</p>
                        <p className="text-[11px] text-[#737373] mt-0.5">{edu.institution}</p>
                        <p className="text-[11px] text-[#525252]">{edu.startYear} – {edu.endYear}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Links */}
              {socialLinks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Links</h3>
                  <div className="flex flex-col gap-2">
                    {socialLinks.map((link) => (
                      <a key={link.platform} href={getSocialUrl(link.platform, link.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#a6a6a6] hover:text-[#fafafa] transition-colors group">
                        <div className="w-6 h-6 rounded-md bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] flex items-center justify-center text-[#737373] group-hover:text-[#fafafa] transition-all">
                          {SOCIAL_ICON_MAP[link.platform] || <GlobeIcon className="w-3.5 h-3.5" />}
                        </div>
                        <span className="capitalize text-xs">{link.platform}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#ffffff]/10" />

            {/* ── Employment History ── */}
            {workHistory.length > 0 && (
              <>
                <section className="py-6">
                  <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-5">Employment History</h3>
                  <div className="space-y-0">
                    {workHistory.map((exp, i) => (
                      <div key={i} className={`py-4 ${i < workHistory.length - 1 ? 'border-b border-[#ffffff]/[0.05]' : ''}`}>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-[#fafafa] tracking-tight">{exp.role}</h4>
                          <span className="text-[#525252]">|</span>
                          <span className="text-sm text-[#737373]">{exp.company}</span>
                        </div>
                        <p className="text-xs text-[#525252] mt-1">{exp.startDate} – {exp.current ? 'Present' : exp.endDate}</p>
                        {exp.description && (
                          <p className="text-xs text-[#a6a6a6] mt-2 font-light leading-relaxed">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
                <div className="border-t border-[#ffffff]/10" />
              </>
            )}

            {/* ── Portfolio ── */}
            {portfolio.length > 0 && (
              <>
                <section className="py-6">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Portfolio</h3>
                    {portfolio.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => scrollPortfolio('left')} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button type="button" onClick={() => scrollPortfolio('right')} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div ref={portfolioScrollRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none' }}>
                    {portfolio.map((proj, i) => (
                      <div key={i} onClick={() => setViewingProject(proj)} className="w-[280px] shrink-0 snap-start bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06] rounded-xl overflow-hidden hover:border-[#ffffff]/[0.12] transition-all cursor-pointer">
                        <div className="w-full h-[140px] bg-[#0f0f0f]" />
                        <div className="p-3.5">
                          <h4 className="text-sm font-medium text-[#fafafa] tracking-tight">{proj.title}</h4>
                          <p className="text-xs text-[#a6a6a6] mt-1.5 font-light leading-relaxed line-clamp-2">{proj.description}</p>
                          {proj.techStack && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {proj.techStack.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3).map((t) => (
                                <span key={t} className="px-2 py-0.5 rounded-full bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.06] text-[10px] text-[#737373]">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="border-t border-[#ffffff]/10" />
              </>
            )}

            {/* ── Work History (Platform Projects) — only show if there are projects ── */}
            {platformProjects.length > 0 && (
              <section className="py-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Work History</h3>
                  <div className="flex items-center gap-1 bg-[#ffffff]/[0.03] rounded-lg p-0.5">
                    {([['all', 'All'], ['in_progress', 'In progress'], ['completed', 'Completed']] as const).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setWorkHistoryTab(key)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${workHistoryTab === key ? 'bg-[#ffffff]/[0.08] text-[#fafafa]' : 'text-[#525252] hover:text-[#a6a6a6]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredProjects.length > 0 ? (
                  <div className="space-y-0">
                    {filteredProjects.map((project) => {
                      const sc = STATUS_COLORS[project.status] || STATUS_COLORS.Beginning
                      return (
                        <div key={project.id} className="py-4 border-b border-[#ffffff]/[0.05] last:border-b-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-[#10b981] tracking-tight">{project.title}</h4>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {project.status}
                                </span>
                              </div>
                              {project.description && (
                                <p className="text-xs text-[#737373] mt-2 font-light leading-relaxed line-clamp-2">{project.description}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              {project.budget != null && (
                                <p className="text-sm font-medium text-[#fafafa]">${project.budget.toLocaleString()}</p>
                              )}
                            </div>
                          </div>
                          {project.progress > 0 && (
                            <div className="mt-3">
                              <div className="w-full h-1 rounded-full bg-[#ffffff]/[0.05]">
                                <div className="h-full rounded-full bg-emerald-500/60 transition-all" style={{ width: `${project.progress}%` }} />
                              </div>
                              <p className="text-[10px] text-[#525252] mt-1">{project.progress}% complete</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6">
                    <p className="text-sm text-[#525252]">{`No ${workHistoryTab === 'in_progress' ? 'in-progress' : 'completed'} projects`}</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Portfolio Detail Overlay (on top of panel) ── */}
      {viewingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setViewingProject(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border border-[#ffffff]/[0.08] rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
            <div className="w-full h-[200px] bg-[#0f0f0f] relative">
              <button type="button" onClick={() => setViewingProject(null)} className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-[#a6a6a6] hover:text-[#fafafa] hover:bg-black/70 transition-all cursor-pointer">
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-[#fafafa] tracking-tight">{viewingProject.title}</h2>
                {(viewingProject.month || viewingProject.year) && (
                  <p className="text-xs text-[#525252] mt-1.5 font-light">
                    {viewingProject.month}{viewingProject.month && viewingProject.year && ' '}{viewingProject.year}
                  </p>
                )}
              </div>
              {viewingProject.description && (
                <div>
                  <h4 className="text-xs font-medium text-[#737373] uppercase tracking-wider mb-2">About this project</h4>
                  <p className="text-sm text-[#a6a6a6] font-light leading-relaxed whitespace-pre-wrap">{viewingProject.description}</p>
                </div>
              )}
              {viewingProject.techStack && (
                <div>
                  <h4 className="text-xs font-medium text-[#737373] uppercase tracking-wider mb-2.5">Technologies</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProject.techStack.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="px-3 py-1 rounded-full bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] text-xs text-[#a6a6a6]">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {viewingProject.link && (
                <div className="pt-1">
                  <a href={viewingProject.link.startsWith('http') ? viewingProject.link : `https://${viewingProject.link}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 text-sm text-[#10b981] hover:bg-[#10b981]/20 transition-all font-medium">
                    View Project
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
