import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  MapPin,
  Loader2,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import Header from '@/components/layout/Header'
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

export default function FreelancerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<api.User | null>(null)
  const [platformProjects, setPlatformProjects] = useState<api.Project[]>([])
  const [loading, setLoading] = useState(true)
  const [aboutExpanded, setAboutExpanded] = useState(false)
  const [workHistoryTab, setWorkHistoryTab] = useState<'all' | 'in_progress' | 'completed'>('all')
  const [viewingProject, setViewingProject] = useState<api.PortfolioItem | null>(null)
  const portfolioScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.getUser(id),
      api.listProjects({ memberId: id }),
    ]).then(([u, projects]) => {
      setUser(u)
      setPlatformProjects(projects)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const scrollPortfolio = (dir: 'left' | 'right') => {
    const el = portfolioScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] antialiased">
        <Header />
        <div className="flex items-center justify-center pt-40"><Loader2 className="w-6 h-6 animate-spin text-[#737373]" /></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] antialiased">
        <Header />
        <div className="flex items-center justify-center pt-40"><p className="text-[#a6a6a6]">User not found</p></div>
      </div>
    )
  }

  const socialLinks = (user.socialLinks ?? []) as api.SocialLink[]
  const workHistory = (user.workHistory ?? []) as api.WorkHistoryItem[]
  const portfolio = (user.portfolio ?? []) as api.PortfolioItem[]
  const languages = (user.languages ?? []) as api.LanguageItem[]
  const education = (user.education ?? []) as api.EducationItem[]
  const aboutParagraphs = user.bio ? user.bio.split('\n').filter(Boolean) : []
  const avatarUrl = getImageUrl(user.avatar)

  const filteredProjects = platformProjects.filter((p) => {
    if (workHistoryTab === 'all') return true
    if (workHistoryTab === 'in_progress') return p.status !== 'Completed'
    return p.status === 'Completed'
  })

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] antialiased">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 h-full min-h-0 flex flex-col pb-6 w-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* ── Back Button ── */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[#a6a6a6] hover:text-[#fafafa] transition-colors cursor-pointer mb-2 -ml-1"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          Back
        </button>

        {/* ── Profile Header ── */}
        <section className="flex items-center justify-between gap-4 mb-0 px-2 sm:px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full ring-2 ring-[#ffffff]/[0.08]" alt={user.name} />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-2 ring-[#ffffff]/[0.08] bg-[#1a1a1a] flex items-center justify-center text-xl sm:text-2xl font-semibold text-[#e5e5e5] tracking-tight">
                  {getInitials(user.name || 'U')}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#fafafa]">{user.name || 'Unnamed'}</h1>
              </div>
              {user.location && (
                <div className="flex items-center gap-1.5 text-sm text-[#737373] mt-1">
                  <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{user.location}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="p-2.5 rounded-xl border border-[#ffffff]/[0.08] text-[#737373] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
              <Share2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button type="button" onClick={() => navigate(`/dealrooms?to=${id}`)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#cccccc] transition-colors cursor-pointer flex items-center gap-2">
              <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
              Message
            </button>
          </div>
        </section>

        <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

        {/* ── Two Column: Sidebar + Main Content ── */}
        <div className="flex flex-col lg:flex-row gap-0 px-2 sm:px-4 py-8">

          {/* ── Left Sidebar ── */}
          <aside className="w-full lg:w-[260px] shrink-0 flex flex-col gap-10 lg:pr-8 lg:border-r lg:border-[#ffffff]/10 pb-8 lg:pb-0">

            {/* Availability */}
            <div>
              <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Availability</h3>
              <div className="flex items-center gap-2 text-sm text-[#e5e5e5]">
                <Clock className="w-4 h-4 text-[#10b981]" strokeWidth={1.5} />
                <span>More than {user.availability ?? 30} hrs/week</span>
              </div>
              {user.hourlyRate != null && (
                <p className="text-sm text-[#a6a6a6] mt-2">${user.hourlyRate.toFixed(2)}/hr</p>
              )}
            </div>

            {/* Languages */}
            <div>
              <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Languages</h3>
              {languages.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {languages.map((lang, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-[#e5e5e5]">{lang.name}</span>
                      <span className="text-xs text-[#525252]">{lang.proficiency}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#525252]">Not specified</p>
              )}
            </div>

            {/* Education */}
            <div>
              <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Education</h3>
              {education.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {education.map((edu, i) => (
                    <div key={i}>
                      <p className="text-sm text-[#e5e5e5] font-medium">{edu.degree}</p>
                      <p className="text-xs text-[#737373] mt-0.5">{edu.institution}</p>
                      <p className="text-xs text-[#525252] mt-0.5">{edu.startYear} – {edu.endYear}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#525252]">Not specified</p>
              )}
            </div>

            {/* Links */}
            {socialLinks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Links</h3>
                <div className="flex flex-col gap-2.5">
                  {socialLinks.map((link) => (
                    <a key={link.platform} href={getSocialUrl(link.platform, link.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-[#a6a6a6] hover:text-[#fafafa] transition-colors group">
                      <div className="w-7 h-7 rounded-lg bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] flex items-center justify-center text-[#737373] group-hover:text-[#fafafa] group-hover:border-[#ffffff]/[0.15] transition-all">
                        {SOCIAL_ICON_MAP[link.platform] || <GlobeIcon className="w-3.5 h-3.5" />}
                      </div>
                      <span className="capitalize">{link.platform}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── Right Main Content ── */}
          <div className="flex-1 min-w-0 lg:pl-8">

            {/* Title + Rate */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold text-[#fafafa] tracking-tight">{user.title || user.headline || 'Freelancer'}</h2>
              {user.hourlyRate != null && (
                <span className="text-xl font-semibold text-[#fafafa] shrink-0">${user.hourlyRate.toFixed(2)}<span className="text-sm text-[#737373] font-normal">/hr</span></span>
              )}
            </div>

            {/* About */}
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

            <div className="border-t border-[#ffffff]/10 my-6" />

            {/* Skills */}
            {user.skills.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-4">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <span key={skill} className="px-4 py-1.5 rounded-full bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] text-xs font-medium text-[#a6a6a6]">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

        {/* ── Employment History ── */}
        {workHistory.length > 0 && (
          <>
            <section className="px-2 sm:px-4 py-8 hover:bg-[#ffffff]/[0.02] rounded-2xl transition-colors">
              <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-6">Employment History</h3>

              <div className="space-y-0">
                {workHistory.map((exp, i) => (
                  <div key={i} className={`py-5 ${i < workHistory.length - 1 ? 'border-b border-[#ffffff]/[0.05]' : ''}`}>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-[#fafafa] tracking-tight">{exp.role}</h4>
                      <span className="text-[#525252]">|</span>
                      <span className="text-sm text-[#737373]">{exp.company}</span>
                    </div>
                    <p className="text-xs text-[#525252] mt-1">{exp.startDate} – {exp.current ? 'Present' : exp.endDate}</p>
                    {exp.description && (
                      <p className="text-sm text-[#a6a6a6] mt-2 font-light leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />
          </>
        )}

        {/* ── Portfolio ── */}
        {portfolio.length > 0 && (
          <>
            <section className="px-2 sm:px-4 py-8 hover:bg-[#ffffff]/[0.02] rounded-2xl transition-colors">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Portfolio</h3>
                {portfolio.length > 2 && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => scrollPortfolio('left')} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                      <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button type="button" onClick={() => scrollPortfolio('right')} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                      <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>

              <div ref={portfolioScrollRef} className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none' }}>
                {portfolio.map((proj, i) => (
                  <div key={i} onClick={() => setViewingProject(proj)} className="w-[320px] shrink-0 snap-start bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06] rounded-xl overflow-hidden hover:border-[#ffffff]/[0.12] transition-all cursor-pointer">
                    <div className="w-full h-[180px] bg-[#0a0a0a]" />
                    <div className="p-4">
                      <h4 className="text-sm font-medium text-[#fafafa] tracking-tight">{proj.title}</h4>
                      <p className="text-xs text-[#a6a6a6] mt-2 font-light leading-relaxed line-clamp-2">{proj.description}</p>
                      {proj.techStack && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {proj.techStack.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.06] text-[10px] text-[#737373]">{t}</span>
                          ))}
                        </div>
                      )}
                      {proj.link && (
                        <a href={proj.link.startsWith('http') ? proj.link : `https://${proj.link}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-[#10b981] mt-3 hover:text-[#34d399] transition-colors font-medium">
                          View Project
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />
          </>
        )}

        {/* ── Work History (Platform Projects) — only show if there are projects ── */}
        {platformProjects.length > 0 && (
        <section className="px-2 sm:px-4 py-8 pb-16 hover:bg-[#ffffff]/[0.02] rounded-2xl transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Work History</h3>

            <div className="flex items-center gap-1 bg-[#ffffff]/[0.03] rounded-lg p-0.5">
              {([['all', 'All'], ['in_progress', 'In progress'], ['completed', 'Completed']] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setWorkHistoryTab(key)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${workHistoryTab === key ? 'bg-[#ffffff]/[0.08] text-[#fafafa]' : 'text-[#525252] hover:text-[#a6a6a6]'}`}>
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
                  <div key={project.id} className="py-5 border-b border-[#ffffff]/[0.05] last:border-b-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-[#10b981] tracking-tight">{project.title}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {project.status}
                          </span>
                          {project.dueDate && (
                            <span className="text-xs text-[#525252]">{new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-xs text-[#737373] mt-2 font-light leading-relaxed line-clamp-2">{project.description}</p>
                        )}
                        <p className="text-xs text-[#525252] mt-2">Client: {project.owner.name || 'Unknown'}</p>
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
            <div className="flex flex-col items-center py-8">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="14" y="24" width="52" height="36" rx="4" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1.5"/>
                <rect x="22" y="32" width="16" height="2" rx="1" fill="#252525"/>
                <rect x="22" y="38" width="28" height="2" rx="1" fill="#1f1f1f"/>
                <rect x="22" y="44" width="20" height="2" rx="1" fill="#1f1f1f"/>
                <circle cx="54" cy="34" r="5" fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="1" strokeOpacity="0.25"/>
                <path d="M52 34l1.5 1.5 3-3" stroke="#10b981" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.35"/>
                <rect x="22" y="50" width="36" height="3" rx="1.5" fill="#151515"/>
                <rect x="22" y="50" width="14" height="3" rx="1.5" fill="#10b981" fillOpacity="0.15"/>
              </svg>
              <p className="text-sm text-[#525252] mt-3">{workHistoryTab === 'all' ? 'No platform projects yet' : `No ${workHistoryTab === 'in_progress' ? 'in-progress' : 'completed'} projects`}</p>
            </div>
          )}
        </section>
        )}

      </main>

      {/* ── Portfolio Detail Overlay ── */}
      {viewingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setViewingProject(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border border-[#ffffff]/[0.08] rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
            {/* Header image area */}
            <div className="w-full h-[200px] bg-[#0f0f0f] relative">
              <button type="button" onClick={() => setViewingProject(null)} className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-[#a6a6a6] hover:text-[#fafafa] hover:bg-black/70 transition-all cursor-pointer">
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Title + date */}
              <div>
                <h2 className="text-xl font-semibold text-[#fafafa] tracking-tight">{viewingProject.title}</h2>
                {(viewingProject.month || viewingProject.year) && (
                  <p className="text-xs text-[#525252] mt-1.5 font-light">
                    {viewingProject.month && viewingProject.month}{viewingProject.month && viewingProject.year && ' '}{viewingProject.year && viewingProject.year}
                  </p>
                )}
              </div>

              {/* Description */}
              {viewingProject.description && (
                <div>
                  <h4 className="text-xs font-medium text-[#737373] uppercase tracking-wider mb-2">About this project</h4>
                  <p className="text-sm text-[#a6a6a6] font-light leading-relaxed whitespace-pre-wrap">{viewingProject.description}</p>
                </div>
              )}

              {/* Tech stack */}
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

              {/* Project link */}
              {viewingProject.link && (
                <div className="pt-1">
                  <a
                    href={viewingProject.link.startsWith('http') ? viewingProject.link : `https://${viewingProject.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 text-sm text-[#10b981] hover:bg-[#10b981]/20 transition-all font-medium"
                  >
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
