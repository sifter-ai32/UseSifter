import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import FreelancerProfilePanel from '@/components/FreelancerProfilePanel'
import { listFreelancers } from '@/lib/api'

// Skill groups
const SKILL_GROUPS: Record<string, string[]> = {
  'AI & ML': ['ai', 'ml', 'machine learning', 'deep learning', 'nlp', 'natural language', 'gen ai', 'generative ai', 'computer vision', 'tensorflow', 'pytorch', 'llm', 'neural', 'data science'],
  'Web Development': ['react', 'angular', 'vue', 'next.js', 'nuxt', 'svelte', 'html', 'css', 'tailwind', 'javascript', 'typescript', 'frontend', 'front-end', 'web dev'],
  'Backend': ['node.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'ruby on rails', 'golang', 'go', 'rust', 'backend', 'back-end', 'rest api', 'graphql'],
  'Mobile': ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'mobile'],
  'Cloud & DevOps': ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'devops', 'terraform', 'cloud', 'linux', 'jenkins'],
  'Data & Analytics': ['sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'data engineering', 'etl', 'tableau', 'power bi', 'analytics', 'database'],
  'Design': ['ui', 'ux', 'ui/ux', 'figma', 'sketch', 'adobe', 'photoshop', 'illustrator', 'graphic design', 'product design', 'web design'],
  'Blockchain': ['blockchain', 'solidity', 'web3', 'ethereum', 'smart contract', 'defi', 'nft', 'crypto'],
  'Cybersecurity': ['security', 'cybersecurity', 'penetration', 'ethical hacking', 'soc', 'infosec'],
  'Marketing': ['seo', 'sem', 'digital marketing', 'content writing', 'copywriting', 'social media', 'google ads', 'marketing'],
  'Project Management': ['project management', 'agile', 'scrum', 'jira', 'product management'],
  'QA & Testing': ['qa', 'testing', 'selenium', 'cypress', 'jest', 'automation testing', 'quality assurance'],
}

function matchesGroup(skills: string[], groupKeywords: string[]): boolean {
  return skills.some((skill) => {
    const s = skill.toLowerCase()
    return groupKeywords.some((kw) => s.includes(kw) || kw.includes(s))
  })
}

// Filter definitions
const BUDGET_OPTIONS = [
  { label: 'Any Budget', value: '' },
  { label: 'Under $25/hr', value: '0-25' },
  { label: '$25 – $50/hr', value: '25-50' },
  { label: '$50 – $100/hr', value: '50-100' },
  { label: '$100+/hr', value: '100+' },
]

const EXPERIENCE_OPTIONS = [
  { label: 'Any Level', value: '' },
  { label: 'Entry Level', value: 'entry', hint: '0–2 yrs' },
  { label: 'Intermediate', value: 'intermediate', hint: '3–5 yrs' },
  { label: 'Expert', value: 'expert', hint: '6+ yrs' },
]

const AVAILABILITY_OPTIONS = [
  { label: 'Any Availability', value: '' },
  { label: 'Part-time', value: 'part', hint: '< 20 hrs/wk' },
  { label: 'Full-time', value: 'full', hint: '30+ hrs/wk' },
  { label: 'As needed', value: 'asneeded', hint: '< 10 hrs/wk' },
]

interface FilterDropdownProps {
  label: string
  value: string
  options: { label: string; value: string; hint?: string }[]
  onChange: (value: string) => void
  isOpen: boolean
  onToggle: () => void
}

function FilterDropdown({ label, value, options, onChange, isOpen, onToggle }: FilterDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const activeOption = options.find((o) => o.value === value)
  const displayLabel = value ? activeOption?.label || label : label

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors cursor-pointer whitespace-nowrap ${
          value
            ? 'border-[#3b82f6]/30 bg-[#3b82f6]/10 font-medium text-[#60a5fa]'
            : 'border-[#ffffff]/10 bg-transparent text-[#a6a6a6] hover:bg-[#ffffff]/5 hover:text-[#fafafa]'
        }`}
      >
        {displayLabel}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-48 bg-[#111111] border border-[#ffffff]/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); onToggle() }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center justify-between ${
                value === opt.value
                  ? 'text-[#60a5fa] bg-[#3b82f6]/10'
                  : 'text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/[0.05]'
              }`}
            >
              <span>{opt.label}</span>
              {opt.hint && <span className="text-[10px] text-[#525252]">{opt.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<string | null>(null)

  // Filters
  const [budgetFilter, setBudgetFilter] = useState('')
  const [experienceFilter, setExperienceFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const toggleDropdown = (name: string) => setOpenDropdown((prev) => (prev === name ? null : name))

  const activeFilterCount = [budgetFilter, experienceFilter, locationFilter, availabilityFilter].filter(Boolean).length

  const clearAllFilters = () => {
    setBudgetFilter('')
    setExperienceFilter('')
    setLocationFilter('')
    setAvailabilityFilter('')
  }

  const { data: freelancers = [], isLoading } = useQuery({
    queryKey: ['freelancers'],
    queryFn: listFreelancers,
  })

  // Derive locations from data
  const locationOptions = useMemo(() => {
    const locs = new Set<string>()
    freelancers.forEach((f) => { if (f.location) locs.add(f.location) })
    return [
      { label: 'Any Location', value: '' },
      ...Array.from(locs).sort().map((l) => ({ label: l, value: l })),
    ]
  }, [freelancers])

  // Show group categories that have at least one matching freelancer
  const categories = useMemo(() => {
    const active = Object.keys(SKILL_GROUPS).filter((group) =>
      freelancers.some((f) => f.skills && matchesGroup(f.skills, SKILL_GROUPS[group]))
    )
    return ['All', ...active]
  }, [freelancers])

  // Filter
  const filtered = useMemo(() => {
    let list = freelancers

    // Category
    if (activeCategory !== 'All') {
      const keywords = SKILL_GROUPS[activeCategory]
      if (keywords) {
        list = list.filter((f) => f.skills && matchesGroup(f.skills, keywords))
      }
    }

    // Budget (hourly rate)
    if (budgetFilter) {
      list = list.filter((f) => {
        const rate = f.hourlyRate ?? 0
        if (budgetFilter === '0-25') return rate > 0 && rate < 25
        if (budgetFilter === '25-50') return rate >= 25 && rate <= 50
        if (budgetFilter === '50-100') return rate > 50 && rate <= 100
        if (budgetFilter === '100+') return rate > 100
        return true
      })
    }

    // Experience
    if (experienceFilter) {
      list = list.filter((f) => {
        const yrs = f.experience ?? 0
        if (experienceFilter === 'entry') return yrs <= 2
        if (experienceFilter === 'intermediate') return yrs >= 3 && yrs <= 5
        if (experienceFilter === 'expert') return yrs >= 6
        return true
      })
    }

    // Location
    if (locationFilter) {
      list = list.filter((f) => f.location === locationFilter)
    }

    // Availability
    if (availabilityFilter) {
      list = list.filter((f) => {
        const hrs = f.availability ?? 0
        if (availabilityFilter === 'asneeded') return hrs > 0 && hrs < 10
        if (availabilityFilter === 'part') return hrs >= 10 && hrs < 30
        if (availabilityFilter === 'full') return hrs >= 30
        return true
      })
    }

    // Search
    if (searchQuery.trim()) {
      const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
      list = list.filter((f) => {
        const haystack = [
          f.name, f.title, f.headline, f.bio, f.location,
          ...(f.skills || []),
        ].filter(Boolean).join(' ').toLowerCase()
        return words.every((w) => haystack.includes(w))
      })
    }

    return list
  }, [freelancers, activeCategory, budgetFilter, experienceFilter, locationFilter, availabilityFilter, searchQuery])

  function getInitials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }

  if (isLoading) {
    return (
      <div className="bg-[#000000] text-[#fafafa] antialiased h-screen selection:bg-[#ffffff]/20 overflow-hidden flex flex-col">
        <Header />
        <main className="flex flex-col flex-1 min-h-0 pt-14 lg:pt-16 animate-pulse">
          <div className="flex flex-col gap-3 lg:gap-4 px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-3 lg:pb-4 w-full max-w-[1800px] mx-auto shrink-0">
            {/* Search bar skeleton */}
            <div className="flex flex-col md:flex-row gap-3 w-full">
              <div className="flex-grow h-[38px] lg:h-[42px] bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.06] rounded-xl" />
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-[30px] w-[72px] bg-[#ffffff]/[0.04] rounded-full" />
                <div className="h-[30px] w-[88px] bg-[#ffffff]/[0.04] rounded-full" />
                <div className="h-[30px] w-[76px] bg-[#ffffff]/[0.04] rounded-full" />
                <div className="h-[30px] w-[92px] bg-[#ffffff]/[0.04] rounded-full" />
              </div>
            </div>
            {/* Category pills skeleton */}
            <div className="flex items-center gap-2">
              {[40, 64, 56, 80, 48, 72].map((w, i) => (
                <div key={i} className="h-[30px] rounded-full bg-[#ffffff]/[0.04]" style={{ width: w }} />
              ))}
            </div>
          </div>
          {/* Card grid skeleton */}
          <div className="flex-1 min-h-0 overflow-hidden px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4 max-w-[1800px] mx-auto pb-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="sm:p-4 lg:p-5 flex flex-col bg-[#000000] border-[#ffffff]/[0.06] border-2 rounded-[16px] p-3.5">
                  <div className="flex items-start gap-2.5 sm:gap-3 lg:gap-4">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-[54px] lg:h-[54px] xl:w-[60px] xl:h-[60px] rounded-full bg-[#ffffff]/[0.06] shrink-0" />
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="h-4 w-28 bg-[#ffffff]/[0.06] rounded-md" />
                      <div className="h-3 w-16 bg-[#ffffff]/[0.04] rounded-md" />
                      <div className="h-3.5 w-14 bg-[#ffffff]/[0.06] rounded-md mt-0.5" />
                    </div>
                  </div>
                  <div className="mt-3 lg:mt-4 space-y-2">
                    <div className="h-3 w-full bg-[#ffffff]/[0.04] rounded-md" />
                    <div className="h-3 w-4/5 bg-[#ffffff]/[0.04] rounded-md" />
                  </div>
                  <div className="flex gap-2 mt-3 lg:mt-4">
                    <div className="h-6 w-16 bg-[#ffffff]/[0.04] rounded-full" />
                    <div className="h-6 w-20 bg-[#ffffff]/[0.04] rounded-full" />
                    <div className="h-6 w-14 bg-[#ffffff]/[0.04] rounded-full" />
                  </div>
                  <div className="flex-grow" />
                  <div className="h-10 w-full bg-[#ffffff]/[0.04] rounded-xl mt-4 lg:mt-5" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[#000000] text-[#fafafa] antialiased h-screen selection:bg-[#ffffff]/20 overflow-hidden flex flex-col">
      <Header />

      <main className="flex flex-col flex-1 min-h-0 pt-14 lg:pt-16">
        {/* Search and Filter Container */}
        <div className="flex flex-col gap-3 lg:gap-4 px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-3 lg:pb-4 w-full max-w-[1800px] mx-auto shrink-0">
          {/* Top Row: Search + Filters */}
          <div className="flex flex-col md:flex-row gap-3 w-full">
            <div className="relative flex-grow">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search by name, skill, title, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="focus:outline-none focus:border-[#ffffff]/20 focus:ring-1 focus:ring-[#ffffff]/20 transition-all placeholder:text-[#737373] text-xs lg:text-sm text-[#fafafa] bg-[#0a0a0a] w-full h-[38px] lg:h-[42px] border-[#ffffff]/10 border rounded-xl pr-4 pl-10 lg:pl-11 shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#525252] shrink-0 hidden md:block" strokeWidth={1.5} />
              <FilterDropdown
                label="Budget"
                value={budgetFilter}
                options={BUDGET_OPTIONS}
                onChange={setBudgetFilter}
                isOpen={openDropdown === 'budget'}
                onToggle={() => toggleDropdown('budget')}
              />
              <FilterDropdown
                label="Experience"
                value={experienceFilter}
                options={EXPERIENCE_OPTIONS}
                onChange={setExperienceFilter}
                isOpen={openDropdown === 'experience'}
                onToggle={() => toggleDropdown('experience')}
              />
              <FilterDropdown
                label="Location"
                value={locationFilter}
                options={locationOptions}
                onChange={setLocationFilter}
                isOpen={openDropdown === 'location'}
                onToggle={() => toggleDropdown('location')}
              />
              <FilterDropdown
                label="Availability"
                value={availabilityFilter}
                options={AVAILABILITY_OPTIONS}
                onChange={setAvailabilityFilter}
                isOpen={openDropdown === 'availability'}
                onToggle={() => toggleDropdown('availability')}
              />
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Categories Row */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 lg:px-4 py-1 lg:py-1.5 rounded-full border text-xs lg:text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'border-[#3b82f6]/30 bg-[#3b82f6]/10 font-medium text-[#60a5fa] hover:bg-[#3b82f6]/20'
                    : 'border-[#ffffff]/10 bg-transparent text-[#a6a6a6] hover:bg-[#ffffff]/5 hover:text-[#fafafa]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Freelancer Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 sm:px-6 lg:px-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="text-sm text-[#737373]">No freelancers found</span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-[#60a5fa] hover:text-[#93bbfd] transition-colors cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4 max-w-[1800px] mx-auto pb-8">
          {filtered.map((freelancer, i) => (
            <div
              key={freelancer.id}
              className="sm:p-4 lg:p-5 flex flex-col group hover:border-[#ffffff]/20 transition-colors bg-[#000000] border-[#ffffff]/10 border-2 rounded-[16px] p-3.5"
              style={{ opacity: 0, animation: `slideFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.05 * Math.min(i, 15)}s forwards` }}
            >
              {/* Header: Avatar + Info */}
              <div className="flex items-start gap-2.5 sm:gap-3 lg:gap-4">
                {freelancer.avatar ? (
                  <img
                    src={freelancer.avatar}
                    alt={freelancer.name}
                    onClick={() => setSelectedFreelancerId(freelancer.id)}
                    className="w-10 h-10 sm:w-11 sm:h-11 lg:w-[54px] lg:h-[54px] xl:w-[60px] xl:h-[60px] rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <div
                    onClick={() => setSelectedFreelancerId(freelancer.id)}
                    className="w-10 h-10 sm:w-11 sm:h-11 lg:w-[54px] lg:h-[54px] xl:w-[60px] xl:h-[60px] rounded-full bg-[#ffffff]/10 border border-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-sm shrink-0 cursor-pointer hover:bg-[#ffffff]/15 transition-colors"
                  >
                    {getInitials(freelancer.name || '?')}
                  </div>
                )}
                <div className="flex flex-col">
                  <h3
                    onClick={() => setSelectedFreelancerId(freelancer.id)}
                    className="text-[14px] lg:text-[16px] font-normal text-[#fafafa] tracking-tight leading-tight cursor-pointer hover:underline"
                  >
                    {freelancer.name}
                  </h3>
                  {freelancer.location && (
                    <p className="text-[11px] lg:text-[12px] font-normal text-[#737373] mt-0.5">
                      {freelancer.location}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 lg:gap-3 mt-1 lg:mt-1.5 text-[13px] lg:text-[14px] font-medium text-[#fafafa]">
                    {freelancer.hourlyRate != null && <span>${freelancer.hourlyRate}/hr</span>}
                  </div>
                </div>
              </div>

              {/* Description */}
              {freelancer.bio && (
                <p className="text-[11px] sm:text-[12px] lg:text-[13px] xl:text-[14px] font-normal text-[#a6a6a6] mt-2.5 sm:mt-3 lg:mt-4 leading-relaxed line-clamp-2 sm:line-clamp-3">
                  {freelancer.bio}
                </p>
              )}

              {/* Skill Tags */}
              {freelancer.skills?.length > 0 && (
                <div className="relative mt-2.5 sm:mt-3 lg:mt-4">
                  <div id={`skills-${freelancer.id}`} className="flex items-center gap-2 overflow-x-auto overscroll-x-contain hide-scrollbar scroll-smooth w-full pr-8">
                    {freelancer.skills.map((skill) => (
                      <span
                        key={skill}
                        className="bg-[#000000] text-[#fafafa] px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full text-[11px] lg:text-[12px] font-normal whitespace-nowrap shrink-0 border border-[#ffffff]/10"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-[#000000] via-[#000000]/90 to-transparent pointer-events-none flex items-center justify-end">
                    <ChevronRight
                      className="w-4 h-4 text-[#737373] pointer-events-auto cursor-pointer mr-1 hover:text-[#fafafa] transition-colors"
                      strokeWidth={1.5}
                      onClick={() => document.getElementById(`skills-${freelancer.id}`)?.scrollBy({ left: 120, behavior: 'smooth' })}
                    />
                  </div>
                </div>
              )}

              {/* Spacer to push button to bottom */}
              <div className="flex-grow" />

              {/* See Profile Button */}
              <button
                type="button"
                onClick={() => setSelectedFreelancerId(freelancer.id)}
                className="mt-3 sm:mt-4 lg:mt-5 hover:bg-[#ffffff]/5 sm:py-2.5 lg:py-3 transition-colors text-[13px] lg:text-[14px] font-medium text-[#fafafa] bg-[#000000] w-full border-[#ffffff]/10 border-2 rounded-xl py-2 cursor-pointer"
              >
                See profile
              </button>
            </div>
          ))}
          </div>
          )}
        </div>
      </main>

      <FreelancerProfilePanel
        freelancerId={selectedFreelancerId}
        onClose={() => setSelectedFreelancerId(null)}
      />
    </div>
  )
}
