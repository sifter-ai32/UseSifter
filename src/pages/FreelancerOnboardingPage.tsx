import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, FileText, Pen, FileCheck, Loader2, CheckCircle2, Circle,
  Sparkles, Star, FolderOpen, Wallet2, Clock, Package, PlusCircle, XCircle,
  X, ChevronDown, Globe, Check,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import * as api from '@/lib/api'

// ─── Types ───
type View = 'setup' | 'scanning' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5'

interface Experience {
  role: string
  company: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

interface Project {
  title: string
  month: string
  year: string
  description: string
  techStack: string
  link: string
}

interface SocialLink {
  platform: string
  url: string
}

// ─── Data ───
const ROLES = [
  'Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
  'Product Manager', 'UI/UX Designer', 'Data Scientist', 'DevOps Engineer',
  'Marketing Specialist', 'Graphic Designer',
]

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica',
  'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','East Timor','Ecuador',
  'Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France',
  'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau',
  'Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland',
  'Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo',
  'Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania',
  'Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius',
  'Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia',
  'Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
  'Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Tonga',
  'Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates',
  'United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
]

const CATEGORY_DATA: Record<string, string[]> = {
  'UI/UX Design': ['Figma', 'Adobe XD', 'Wireframing', 'Prototyping', 'User Research', 'Interaction Design', 'Visual Design'],
  'Frontend Development': ['React', 'Vue.js', 'Angular', 'TypeScript', 'CSS/SASS', 'Tailwind CSS', 'Next.js', 'Responsive Design'],
  'Backend Development': ['Node.js', 'Python', 'Java', 'PostgreSQL', 'MongoDB', 'REST APIs', 'GraphQL', 'AWS'],
  'Mobile Development': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android'],
  'DevOps & Cloud': ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'GCP', 'Azure', 'Terraform'],
  'Data Science': ['Python', 'R', 'Machine Learning', 'TensorFlow', 'PyTorch', 'SQL', 'Data Visualization'],
  'Product Management': ['Roadmapping', 'User Stories', 'Agile', 'Scrum', 'Analytics', 'A/B Testing'],
  'Marketing': ['SEO', 'Content Strategy', 'Google Ads', 'Social Media', 'Email Marketing', 'Analytics'],
}

const ALL_CATEGORIES = Object.keys(CATEGORY_DATA)

const ALL_SKILLS = [...new Set(Object.values(CATEGORY_DATA).flat())]

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
)
const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
)
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
)

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  linkedin: <LinkedInIcon className="w-[18px] h-[18px]" />,
  github: <GitHubIcon className="w-[18px] h-[18px]" />,
  x: <XIcon className="w-[18px] h-[18px]" />,
  portfolio: <Globe className="w-[18px] h-[18px]" strokeWidth={1.5} />,
}

const PLATFORMS = [
  { id: 'linkedin', placeholder: 'linkedin.com/in/username' },
  { id: 'github', placeholder: 'github.com/username' },
  { id: 'x', placeholder: 'x.com/username' },
  { id: 'portfolio', placeholder: 'yourwebsite.com' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Shared Input Styles ───
const INPUT_CLS = 'w-full rounded-xl text-sm font-normal text-[#e5e5e5] outline-none transition-all duration-200 placeholder:text-[#525252] bg-white/[0.02] border border-white/[0.12] hover:border-white/20 focus:border-white/40 focus:bg-white/[0.05]'
const INPUT_STYLE = { padding: '14px 16px' }
const INPUT_STYLE_SM = { padding: '12px 14px' }

// ─── Typewriter Component ───
function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
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
          setTimeout(() => {
            setDone(true)
            onDone?.()
          }, 400)
        }
      }
      type()
    }, 400)

    return () => {
      clearTimeout(startTimeout)
      clearTimeout(timeout)
    }
  }, [text])

  return (
    <div className="min-h-[4rem] flex w-full mb-6 items-start">
      <h1 className="leading-snug text-3xl font-light text-[#e5e5e5] tracking-tight w-full">
        {displayed.split('').map((char, i) =>
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
        )}
        {!done && (
          <span
            className="inline-block bg-[#e5e5e5] ml-[2px] shrink-0 animate-[cursorPulse_0.9s_ease-in-out_infinite]"
            style={{ width: 2, height: '1.8rem' }}
          />
        )}
      </h1>
    </div>
  )
}

// ─── Autocomplete Input ───
function AutocompleteInput({
  label,
  required,
  placeholder,
  value,
  onChange,
  suggestions,
  countLabel,
}: {
  label: string
  required?: boolean
  placeholder: string
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  countLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const filtered = value
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : []

  return (
    <div className="relative">
      <label className="flex justify-between items-center text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
        <span>
          {label}
          {required && <span className="text-red-500/60 ml-0.5">*</span>}
        </span>
        {countLabel && <span className="text-[#525252] font-normal">{countLabel}</span>}
      </label>
      <input
        type="text"
        required={required}
        autoComplete="off"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={INPUT_CLS}
        style={INPUT_STYLE}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-2 rounded-xl flex-col max-h-48 overflow-y-auto bg-[#111] border border-white/[0.12] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.5)] py-1">
          {filtered.map((item) => (
            <div
              key={item}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(item)
                setOpen(false)
              }}
              className="px-4 py-2 cursor-pointer text-sm text-[#e5e5e5] hover:bg-white/5 transition-colors"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Country Select (searchable dropdown) ───
function CountrySelectOnboarding({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = search
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && value && listRef.current) {
      const idx = COUNTRIES.indexOf(value)
      if (idx >= 0) listRef.current.scrollTop = idx * 36 - 72
    }
  }, [open, value])

  return (
    <div ref={ref} className="relative">
      <label className="flex justify-between items-center text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
        <span>Country{required && <span className="text-red-500/60 ml-0.5">*</span>}</span>
      </label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className={`${INPUT_CLS} text-left cursor-pointer flex items-center justify-between`}
        style={INPUT_STYLE}
      >
        <span className={value ? 'text-[#e5e5e5]' : 'text-[#525252]'}>{value || 'Select country'}</span>
        <ChevronDown className={`w-4 h-4 text-[#525252] transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-[#111] border border-white/[0.12] rounded-xl shadow-[0_10px_15px_-3px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              autoFocus
              className="w-full rounded-lg text-sm text-[#e5e5e5] outline-none bg-white/[0.05] border border-white/[0.1] px-3 py-2 placeholder:text-[#525252] focus:border-white/[0.25] transition-colors"
            />
          </div>
          <div ref={listRef} className="max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((country) => (
              <button
                key={country}
                type="button"
                onClick={() => { onChange(country); setOpen(false) }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${country === value ? 'bg-white/[0.08] text-[#fafafa]' : 'text-[#a6a6a6] hover:bg-white/5 hover:text-[#fafafa]'}`}
              >
                {country}
              </button>
            )) : (
              <p className="px-4 py-3 text-sm text-[#525252]">No countries found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Continue Button ───
function ContinueButton({ onClick, label = 'Continue', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-end w-full mt-4 pt-6 border-t border-white/[0.08]">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex items-center justify-center rounded-full cursor-pointer transition-colors duration-200 bg-[#e5e5e5] hover:bg-[#a3a3a3] text-[#0a0a0a] font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ padding: '10px 24px' }}
      >
        {label}
        {label === 'Complete Profile' ? (
          <CheckCircle2 className="w-4 h-4 ml-2" strokeWidth={1.5} />
        ) : (
          <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.5} />
        )}
      </button>
    </div>
  )
}

// ─── Chip ───
function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.12] text-xs font-medium text-[#e5e5e5]">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-[#525252] hover:text-[#e5e5e5] transition-colors">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

// ─── Scanning View ───
function ScanningView({ onComplete }: { onComplete: () => void }) {
  const [tasks, setTasks] = useState<('pending' | 'active' | 'complete')[]>(['active', 'pending', 'pending'])

  useEffect(() => {
    const t1 = setTimeout(() => setTasks(['complete', 'active', 'pending']), 1200)
    const t2 = setTimeout(() => setTasks(['complete', 'complete', 'active']), 2600)
    // Keep last task as 'active' (spinning) until API completes and view changes
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Suppress unused parameter warning
  void onComplete

  const taskLabels = ['Reading document structure', 'Extracting personal information', 'Extracting skills & experience']

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center animate-[fadeIn_0.5s_ease-out]">
      <h2 className="text-2xl font-light text-[#e5e5e5] tracking-tight mb-12">Analyzing Document</h2>
      <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16 w-full max-w-lg mx-auto">
        <div className="relative w-44 h-60 shrink-0 rounded-xl overflow-hidden flex flex-col items-start justify-start p-6 shadow-2xl bg-white/[0.03] border border-white/[0.08]">
          <div className="w-1/3 h-2 bg-[#e5e5e5]/20 rounded-full mb-8" />
          <div className="w-full h-1.5 bg-[#e5e5e5]/10 rounded-full mb-3.5" />
          <div className="w-[90%] h-1.5 bg-[#e5e5e5]/10 rounded-full mb-3.5" />
          <div className="w-[95%] h-1.5 bg-[#e5e5e5]/10 rounded-full mb-8" />
          <div className="w-1/2 h-1.5 bg-[#e5e5e5]/10 rounded-full mb-3.5" />
          <div className="w-full h-1.5 bg-[#e5e5e5]/10 rounded-full mb-3.5" />
          <div className="w-[80%] h-1.5 bg-[#e5e5e5]/10 rounded-full mb-3.5" />
          <div className="w-[85%] h-1.5 bg-[#e5e5e5]/10 rounded-full" />
          <div className="absolute left-0 right-0 h-[2px] bg-[#e5e5e5] shadow-[0_0_14px_2px_rgba(229,229,229,0.8)] z-10 animate-[scanline_2.5s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
          <div className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[rgba(229,229,229,0.12)] z-0 animate-[scanline_2.5s_cubic-bezier(0.4,0,0.2,1)_infinite] origin-top -mt-16" />
        </div>
        <div className="flex flex-col gap-5 w-full md:w-auto mt-4 md:mt-0">
          {taskLabels.map((label, i) => (
            <div key={i} className={`flex items-center gap-3.5 transition-all duration-300 ${tasks[i] === 'pending' ? 'opacity-40' : 'opacity-100'}`}>
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {tasks[i] === 'active' && <Loader2 className="w-4 h-4 text-[#e5e5e5] animate-spin" />}
                {tasks[i] === 'complete' && <CheckCircle2 className="w-5 h-5 text-[#fafafa]" />}
                {tasks[i] === 'pending' && <Circle className="w-5 h-5 text-[#525252]" />}
              </div>
              <span className="text-sm font-medium text-[#e5e5e5] tracking-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Experience Modal ───
function ExperienceModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (exp: Experience) => void }) {
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [current, setCurrent] = useState(false)
  const [description, setDescription] = useState('')

  const handleSave = () => {
    if (!role.trim() || !company.trim()) return
    onSave({ role: role.trim(), company: company.trim(), startDate, endDate, current, description: description.trim() })
    setRole(''); setCompany(''); setStartDate(''); setEndDate(''); setCurrent(false); setDescription('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-50 flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
      <div className="w-full max-w-md bg-[#111] border border-white/[0.12] rounded-2xl p-6 shadow-2xl mx-4 animate-[fadeIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-[#e5e5e5] tracking-tight">Add Experience</h3>
          <button type="button" onClick={onClose} className="text-[#525252] hover:text-[#e5e5e5] transition-colors">
            <XCircle className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Title / Role</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Designer" className={INPUT_CLS} style={INPUT_STYLE_SM} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Company</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Corp" className={INPUT_CLS} style={INPUT_STYLE_SM} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${INPUT_CLS} [color-scheme:dark]`} style={{ ...INPUT_STYLE_SM }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={current}
                  className={`${INPUT_CLS} [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{ ...INPUT_STYLE_SM }}
                />
              </div>
            </div>
            <div className="flex items-center ml-1">
              <input
                type="checkbox"
                checked={current}
                onChange={(e) => { setCurrent(e.target.checked); if (e.target.checked) setEndDate('') }}
                className="w-3.5 h-3.5 rounded border-white/[0.12] bg-white/[0.02] accent-[#e5e5e5] cursor-pointer"
              />
              <span className="ml-2 text-xs font-medium text-[#a3a3a3] cursor-pointer" onClick={() => { setCurrent(!current); if (!current) setEndDate('') }}>
                I currently work here
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Briefly describe your responsibilities..."
              className={`${INPUT_CLS} resize-none`}
              style={INPUT_STYLE_SM}
            />
          </div>
          <div className="flex justify-end mt-2">
            <button type="button" onClick={handleSave} className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#a3a3a3] transition-colors duration-200">
              Add Experience
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Project Modal ───
function ProjectModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (proj: Project) => void }) {
  const [title, setTitle] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [description, setDescription] = useState('')
  const [techStack, setTechStack] = useState('')
  const [link, setLink] = useState('')

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), month, year, description: description.trim(), techStack: techStack.trim(), link: link.trim() })
    setTitle(''); setMonth(''); setYear(''); setDescription(''); setTechStack(''); setLink('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-50 flex items-center justify-center overflow-y-auto py-10 animate-[fadeIn_0.3s_ease-out]">
      <div className="w-full max-w-lg bg-[#111] border border-white/[0.12] rounded-2xl p-6 shadow-2xl mx-4 my-auto animate-[fadeIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-[#e5e5e5] tracking-tight">Add Project</h3>
          <button type="button" onClick={onClose} className="text-[#525252] hover:text-[#e5e5e5] transition-colors">
            <XCircle className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Project Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. E-Commerce Dashboard" className={INPUT_CLS} style={INPUT_STYLE_SM} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative w-full">
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={`${INPUT_CLS} appearance-none cursor-pointer pr-9`}
                style={{ ...INPUT_STYLE_SM, paddingRight: '36px', colorScheme: 'dark' }}
              >
                <option value="" disabled>Select</option>
                {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-[68%] -translate-y-1/2 pointer-events-none w-4 h-4 text-[#525252]" />
            </div>
            <div className="relative w-full">
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={`${INPUT_CLS} appearance-none cursor-pointer pr-9`}
                style={{ ...INPUT_STYLE_SM, paddingRight: '36px', colorScheme: 'dark' }}
              >
                <option value="" disabled>Select</option>
                {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-[68%] -translate-y-1/2 pointer-events-none w-4 h-4 text-[#525252]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What was the project about and your role in it?"
              className={`${INPUT_CLS} resize-none`}
              style={INPUT_STYLE_SM}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Skills & Tech Stack</label>
            <input type="text" value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="e.g. React, Node.js, Stripe" className={INPUT_CLS} style={INPUT_STYLE_SM} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Project Link</label>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://example.com" className={INPUT_CLS} style={INPUT_STYLE_SM} />
          </div>
          <div className="flex justify-end mt-2">
            <button type="button" onClick={handleSave} className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#a3a3a3] transition-colors duration-200">
              Add Project
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Progress Bar ───
function ProgressBar({ step }: { step: number }) {
  const percent = step * 20
  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-white/[0.05] z-50">
      <div
        className="h-full bg-[#e5e5e5] transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(255,255,255,0.3)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

// ─── Step Wrapper ───
function StepView({ icon, typewriterText, ready, onReady, children }: {
  icon: React.ReactNode
  typewriterText: string
  ready: boolean
  onReady: () => void
  children: React.ReactNode
}) {
  return (
    <div className="w-full flex flex-col items-start animate-[fadeIn_0.5s_ease-out]">
      <div className="mb-6 flex items-center justify-start w-full">{icon}</div>
      <Typewriter text={typewriterText} onDone={onReady} />
      <div className={`w-full transition-all duration-[800ms] ease-out ${ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        {children}
      </div>
    </div>
  )
}

// ─── Main Page ───
export default function FreelancerOnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete)
  const userType = useAuthStore((s) => s.userType)
  const [saving, setSaving] = useState(false)

  // Redirect if onboarding already complete
  useEffect(() => {
    if (onboardingComplete && userType) {
      navigate(userType === 'talent' ? '/freelancer/dashboard' : '/chat', { replace: true })
    }
  }, [onboardingComplete, userType, navigate])
  const [view, setView] = useState<View>('setup')
  const [setupReady, setSetupReady] = useState(false)
  const [fileName, setFileName] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [scanError, setScanError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Step readiness (typewriter done)
  const [s1Ready, setS1Ready] = useState(false)
  const [s2Ready, setS2Ready] = useState(false)
  const [s3Ready, setS3Ready] = useState(false)
  const [s4Ready, setS4Ready] = useState(false)
  const [s5Ready, setS5Ready] = useState(false)

  // Step 1: Profile
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [experience, setExperience] = useState('')
  const [country, setCountry] = useState('')
  const [headline, setHeadline] = useState('')
  const [languages, setLanguages] = useState<{ name: string; proficiency: string }[]>([])
  const [education, setEducation] = useState<{ institution: string; degree: string; startYear: string; endYear: string }[]>([])

  // Step 2: Skills
  const [catSearch, setCatSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [skillSearch, setSkillSearch] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [activePlatform, setActivePlatform] = useState('linkedin')
  const [socialUrl, setSocialUrl] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [expModalOpen, setExpModalOpen] = useState(false)

  // Step 3: Bio
  const [bio, setBio] = useState('')

  // Step 4: Projects
  const [projects, setProjects] = useState<Project[]>([])
  const [projModalOpen, setProjModalOpen] = useState(false)

  // Step 5: Rates & Wallet
  const [ratePref, setRatePref] = useState<'hourly' | 'fixed'>('hourly')
  const [rate, setRate] = useState('')
  const [minBudget, setMinBudget] = useState('')
  const [availability, setAvailability] = useState('')
  const [longTerm, setLongTerm] = useState(true)
  const [walletAddress, setWalletAddress] = useState('')
  const [walletError, setWalletError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  // ─── Handlers ───
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setResumeFile(file)
      setScanError('')
    }
  }, [])

  const handleContinueUpload = async () => {
    if (!resumeFile) return
    setView('scanning')
    setScanError('')
    try {
      const data = await api.extractResume(resumeFile)
      console.log('Resume extracted:', data)
      // Pre-fill form fields
      if (data.name) setFullName(data.name)
      if (data.professionalTitle) setRole(data.professionalTitle)
      if (data.experienceYears != null) setExperience(String(data.experienceYears))
      if (data.country) setCountry(data.country)
      if (data.headline) setHeadline(data.headline)
      if (data.categories?.length) setSelectedCategories(data.categories)
      if (data.skills?.length) setSelectedSkills(data.skills)
      if (data.bio) setBio(data.bio)
      if (data.languages?.length) setLanguages(data.languages)
      if (data.education?.length) setEducation(data.education)

      // Social links
      const links: SocialLink[] = []
      if (data.links?.linkedin) links.push({ platform: 'linkedin', url: data.links.linkedin })
      if (data.links?.github) links.push({ platform: 'github', url: data.links.github })
      if (data.links?.x) links.push({ platform: 'x', url: data.links.x })
      if (data.links?.portfolio) links.push({ platform: 'portfolio', url: data.links.portfolio })
      if (links.length) setSocialLinks(links)

      // Work experience
      if (data.workExperience?.length) {
        setExperiences(data.workExperience.map((w) => ({
          role: w.role,
          company: w.company,
          startDate: w.startDate,
          endDate: w.endDate,
          current: !w.endDate || w.endDate.toLowerCase() === 'present',
          description: w.description,
        })))
      }

      // Projects
      if (data.projects?.length) {
        setProjects(data.projects.map((p) => ({
          title: p.title,
          month: p.startMonthYear,
          year: p.endMonthYear,
          description: p.description,
          techStack: p.techStack.join(', '),
          link: '',
        })))
      }

      setView('step1')
      setS1Ready(false)
    } catch (err) {
      console.error('Resume extraction failed:', err)
      setScanError(err instanceof Error ? err.message : 'Failed to extract resume')
      setView('setup')
    }
  }
  const handleManual = () => setView('step1')
  const handleScanComplete = () => setView('step1')

  const goStep2 = () => { setView('step2'); setS2Ready(false) }
  const goStep3 = () => { setView('step3'); setS3Ready(false) }
  const goStep4 = () => { setView('step4'); setS4Ready(false) }
  const goStep5 = () => { setView('step5'); setS5Ready(false) }

  const handleComplete = async () => {
    if (!user) return
    setSaving(true)
    try {
      await api.saveFreelancerProfile({
        userId: user.id,
        fullName,
        title: role,
        experience,
        country,
        headline,
        categories: selectedCategories,
        skills: selectedSkills,
        socialLinks,
        workHistory: experiences,
        bio,
        portfolio: projects,
        languages: languages.filter((l) => l.name.trim()),
        education: education.filter((e) => e.institution.trim() || e.degree.trim()),
        ratePref,
        rate,
        minBudget,
        availability,
        longTerm,
        walletAddress: walletAddress.trim() || undefined,
      })
      useAuthStore.setState({ onboardingComplete: true })
      navigate('/freelancer/dashboard')
    } catch {
      setSaving(false)
    }
  }

  // Skills helpers
  const availableCategories = ALL_CATEGORIES.filter((c) => !selectedCategories.includes(c))
  const availableSkills = ALL_SKILLS.filter((s) => !selectedSkills.includes(s))
  const filteredSkills = skillSearch
    ? availableSkills.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase()))
    : []

  const removeCategory = (cat: string) => {
    setSelectedCategories(selectedCategories.filter((c) => c !== cat))
  }

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill])
      setSkillSearch('')
    }
  }

  const removeSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s !== skill))
  }

  const addSocialLink = () => {
    if (!socialUrl.trim()) return
    setSocialLinks([...socialLinks, { platform: activePlatform, url: socialUrl.trim() }])
    setSocialUrl('')
  }

  const removeSocialLink = (idx: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== idx))
  }

  const currentStep = view === 'step1' ? 1 : view === 'step2' ? 2 : view === 'step3' ? 3 : view === 'step4' ? 4 : view === 'step5' ? 5 : 0

  return (
    <div className="min-h-screen antialiased overflow-x-hidden overflow-y-auto bg-[#0a0a0a] text-[#e5e5e5] pb-24 relative">
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-10px); }
          50% { transform: translateY(220px); }
          100% { transform: translateY(-10px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Progress Bar - only visible during steps */}
      {currentStep > 0 && <ProgressBar step={currentStep} />}

      <main className="flex flex-col w-full max-w-2xl px-6 mx-auto items-start pt-32">

        {/* ─── SETUP VIEW ─── */}
        {view === 'setup' && (
          <div className="w-full flex flex-col items-start animate-[fadeIn_0.5s_ease-out]">
            <div className="mb-6 flex items-center justify-center">
              <Sparkles className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />
            </div>
            <Typewriter text="How do you want to build your profile?" onDone={() => setSetupReady(true)} />
            <div className={`w-full transition-all duration-[800ms] ease-out ${setupReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                <label className="group relative flex flex-col justify-center items-center p-8 rounded-xl cursor-pointer transition-all duration-300 bg-white/[0.02] border border-white/[0.12] hover:border-white/30 hover:bg-white/[0.05]">
                  <input ref={fileRef} type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                  {!fileName ? (
                    <div className="flex flex-col items-center justify-center w-full">
                      <div className="mb-3 transition-transform duration-300 group-hover:-translate-y-1">
                        <FileText className="w-8 h-8 text-[#e5e5e5]" strokeWidth={1.5} />
                      </div>
                      <span className="text-sm font-medium text-[#e5e5e5]">Upload Resume</span>
                      <span className="text-xs text-[#525252] mt-1.5 text-center px-4">PDF up to 10MB</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full">
                      <div className="mb-2"><FileCheck className="w-7 h-7 text-[#fafafa]" strokeWidth={1.5} /></div>
                      <span className="text-xs font-medium text-[#e5e5e5] truncate max-w-[80%]">{fileName}</span>
                      <span className="text-[10px] text-[#a3a3a3] mt-1">Click to replace</span>
                    </div>
                  )}
                </label>
                <div onClick={handleManual} className="group flex flex-col justify-center items-center p-8 rounded-xl cursor-pointer transition-all duration-300 bg-white/[0.02] border border-white/[0.12] hover:border-white/30 hover:bg-white/[0.05]">
                  <div className="mb-3 transition-transform duration-300 group-hover:-translate-y-1">
                    <Pen className="w-8 h-8 text-[#e5e5e5]" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-medium text-[#e5e5e5]">Add Manually</span>
                  <span className="text-xs text-[#525252] mt-1.5 text-center px-4">Fill out forms yourself</span>
                </div>
              </div>
              {scanError && (
                <p className="text-red-400/90 text-sm mt-4 text-center w-full">{scanError}</p>
              )}
              <div className={`flex items-center justify-end w-full mt-6 transition-all duration-500 ${fileName ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <button type="button" onClick={handleContinueUpload} className="flex items-center justify-center rounded-full cursor-pointer transition-colors duration-200 bg-[#e5e5e5] hover:bg-[#a3a3a3] text-[#0a0a0a] font-medium text-sm" style={{ padding: '10px 24px' }}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── SCANNING VIEW ─── */}
        {view === 'scanning' && <ScanningView onComplete={handleScanComplete} />}

        {/* ─── STEP 1: PROFILE FORM ─── */}
        {view === 'step1' && (
          <StepView
            icon={<Sparkles className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />}
            typewriterText="Tell us about yourself"
            ready={s1Ready}
            onReady={() => setS1Ready(true)}
          >
            <form onSubmit={(e) => { e.preventDefault(); goStep2() }} className="flex flex-col w-full gap-5">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
                  Full Name<span className="text-red-500/60 ml-0.5">*</span>
                </label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Jane Doe" className={INPUT_CLS} style={INPUT_STYLE} />
              </div>
              <AutocompleteInput label="Professional Title" required placeholder="e.g. Full Stack Developer" value={role} onChange={setRole} suggestions={ROLES} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
                    Years of Experience<span className="text-red-500/60 ml-0.5">*</span>
                  </label>
                  <input
                    type="number" min={0} max={80} required value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="0"
                    className={`${INPUT_CLS} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    style={INPUT_STYLE}
                  />
                </div>
                <CountrySelectOnboarding value={country} onChange={setCountry} required />
              </div>
              <div>
                <label className="flex justify-between items-center text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
                  <span>Short Headline</span>
                  <span className="text-[#525252] font-normal">Optional</span>
                </label>
                <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Building scalable web applications with modern tech..." className={INPUT_CLS} style={INPUT_STYLE} />
              </div>

              {/* Languages */}
              <div>
                <label className="flex justify-between items-center text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
                  <span>Languages</span>
                  <span className="text-[#525252] font-normal">Optional</span>
                </label>
                <div className="flex flex-col gap-2.5">
                  {languages.map((lang, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={lang.name}
                        onChange={(e) => setLanguages(prev => prev.map((l, j) => j === i ? { ...l, name: e.target.value } : l))}
                        placeholder="e.g. English"
                        className={`flex-1 ${INPUT_CLS}`}
                        style={INPUT_STYLE}
                      />
                      <div className="relative">
                        <select
                          value={lang.proficiency}
                          onChange={(e) => setLanguages(prev => prev.map((l, j) => j === i ? { ...l, proficiency: e.target.value } : l))}
                          className={`${INPUT_CLS} appearance-none cursor-pointer pr-9`}
                          style={{ ...INPUT_STYLE, paddingRight: '36px' }}
                        >
                          {['Native', 'Fluent', 'Conversational', 'Basic'].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-[#525252]" strokeWidth={1.5} />
                      </div>
                      <button type="button" onClick={() => setLanguages(prev => prev.filter((_, j) => j !== i))} className="p-2 text-[#525252] hover:text-[#ef4444] transition-colors cursor-pointer shrink-0">
                        <X className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLanguages([...languages, { name: '', proficiency: 'Conversational' }])}
                    className="flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#e5e5e5] transition-colors cursor-pointer self-start ml-1"
                  >
                    <PlusCircle className="w-4 h-4" strokeWidth={1.5} /> Add language
                  </button>
                </div>
              </div>

              {/* Education */}
              <div>
                <label className="flex justify-between items-center text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
                  <span>Education</span>
                  <span className="text-[#525252] font-normal">Optional</span>
                </label>
                <div className="flex flex-col gap-3">
                  {education.map((edu, i) => (
                    <div key={i} className="relative bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 pr-10">
                      <button type="button" onClick={() => setEducation(prev => prev.filter((_, j) => j !== i))} className="absolute top-3 right-3 p-1 text-[#525252] hover:text-[#ef4444] transition-colors cursor-pointer">
                        <X className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => setEducation(prev => prev.map((ed, j) => j === i ? { ...ed, degree: e.target.value } : ed))}
                          placeholder="Degree / Certificate"
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                        />
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => setEducation(prev => prev.map((ed, j) => j === i ? { ...ed, institution: e.target.value } : ed))}
                          placeholder="Institution"
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={edu.startYear}
                            onChange={(e) => setEducation(prev => prev.map((ed, j) => j === i ? { ...ed, startYear: e.target.value } : ed))}
                            placeholder="Start year"
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                          />
                          <input
                            type="text"
                            value={edu.endYear}
                            onChange={(e) => setEducation(prev => prev.map((ed, j) => j === i ? { ...ed, endYear: e.target.value } : ed))}
                            placeholder="End year"
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEducation([...education, { institution: '', degree: '', startYear: '', endYear: '' }])}
                    className="flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#e5e5e5] transition-colors cursor-pointer self-start ml-1"
                  >
                    <PlusCircle className="w-4 h-4" strokeWidth={1.5} /> Add education
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end w-full mt-4">
                <button type="submit" className="flex items-center justify-center rounded-full cursor-pointer transition-colors duration-200 bg-[#e5e5e5] hover:bg-[#a3a3a3] text-[#0a0a0a] font-medium text-sm" style={{ padding: '10px 24px' }}>
                  Continue<ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.5} />
                </button>
              </div>
            </form>
          </StepView>
        )}

        {/* ─── STEP 2: SKILLS & EXPERTISE ─── */}
        {view === 'step2' && (
          <StepView
            icon={<Star className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />}
            typewriterText="What can you actually do?"
            ready={s2Ready}
            onReady={() => setS2Ready(true)}
          >
            <div className="flex flex-col gap-8">
              {/* Categories */}
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <AutocompleteInput
                    label="Expertise Categories (Up to 5)"
                    placeholder="Search categories..."
                    value={catSearch}
                    onChange={setCatSearch}
                    suggestions={availableCategories}
                    countLabel={`${selectedCategories.length}/5 Selected`}
                  />
                  {/* Override autocomplete's click to use addCategory */}
                </div>
                {selectedCategories.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {selectedCategories.map((cat) => (
                      <div key={cat} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Chip label={cat} onRemove={() => removeCategory(cat)} />
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-1">
                          {CATEGORY_DATA[cat]?.map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => selectedSkills.includes(skill) ? removeSkill(skill) : addSkill(skill)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                                selectedSkills.includes(skill)
                                  ? 'bg-white/[0.15] text-[#e5e5e5] border border-white/30'
                                  : 'bg-white/[0.03] text-[#a3a3a3] border border-white/[0.08] hover:bg-white/[0.08] hover:text-[#e5e5e5]'
                              }`}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Specific Skills</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && skillSearch.trim()) {
                        e.preventDefault()
                        addSkill(skillSearch.trim())
                      }
                    }}
                    placeholder="Search or type a skill and press Enter..."
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                  />
                  {skillSearch && filteredSkills.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 rounded-xl flex-col max-h-48 overflow-y-auto bg-[#111] border border-white/[0.12] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.5)] py-1">
                      {filteredSkills.slice(0, 8).map((item) => (
                        <div
                          key={item}
                          onMouseDown={(e) => { e.preventDefault(); addSkill(item) }}
                          className="px-4 py-2 cursor-pointer text-sm text-[#e5e5e5] hover:bg-white/5 transition-colors"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedSkills.map((skill) => (
                      <Chip key={skill} label={skill} onRemove={() => removeSkill(skill)} />
                    ))}
                  </div>
                )}
              </div>

              {/* Web Presence */}
              <div className="flex flex-col gap-3">
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1 ml-1">Web Presence</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center rounded-xl p-1 gap-1 shrink-0 bg-white/[0.02] border border-white/[0.12]">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setActivePlatform(p.id); setSocialUrl('') }}
                        className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                          activePlatform === p.id ? 'text-[#e5e5e5] bg-white/[0.08]' : 'text-[#525252] hover:text-[#e5e5e5]'
                        }`}
                      >
                        {PLATFORM_ICONS[p.id]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-1 gap-2">
                    <input
                      type="url"
                      value={socialUrl}
                      onChange={(e) => setSocialUrl(e.target.value)}
                      placeholder={PLATFORMS.find((p) => p.id === activePlatform)?.placeholder}
                      className={`flex-1 ${INPUT_CLS}`}
                      style={INPUT_STYLE}
                    />
                    <button
                      type="button"
                      onClick={addSocialLink}
                      className="px-5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#a3a3a3] transition-colors duration-200 shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
                {socialLinks.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    {socialLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                        <span className="text-[#a3a3a3] w-5 shrink-0">{PLATFORM_ICONS[link.platform]}</span>
                        <span className="text-sm text-[#e5e5e5] flex-1 truncate">{link.url}</span>
                        <button type="button" onClick={() => removeSocialLink(i)} className="text-[#525252] hover:text-[#e5e5e5] transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Work Experience */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center mb-1 ml-1 pr-1">
                  <label className="block text-xs font-medium text-[#a3a3a3]">Work Experience</label>
                  <button type="button" onClick={() => setExpModalOpen(true)} className="text-xs font-medium text-[#e5e5e5] flex items-center gap-1 hover:text-white transition-colors">
                    <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
                    Add New
                  </button>
                </div>
                {experiences.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {experiences.map((exp, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[#e5e5e5]">{exp.role}</div>
                          <div className="text-xs text-[#a3a3a3] mt-0.5">{exp.company}</div>
                          {exp.description && <div className="text-xs text-[#525252] mt-1 line-clamp-2">{exp.description}</div>}
                        </div>
                        <button type="button" onClick={() => setExperiences(experiences.filter((_, j) => j !== i))} className="text-[#525252] hover:text-[#e5e5e5] transition-colors mt-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01] text-center">
                    <span className="text-xs text-[#525252]">No work experience added yet.</span>
                  </div>
                )}
              </div>

              <ContinueButton onClick={goStep3} />
            </div>
          </StepView>
        )}

        {/* ─── STEP 3: BIO ─── */}
        {view === 'step3' && (
          <StepView
            icon={<FileText className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />}
            typewriterText="Great. Now write a bio to tell the world about yourself."
            ready={s3Ready}
            onReady={() => setS3Ready(true)}
          >
            <div className="flex flex-col gap-5">
              <div className="relative w-full">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={8}
                  placeholder="I'm a passionate developer with a knack for creating intuitive user experiences. Over the last 5 years, I've specialized in modern frontend architectures..."
                  className={`${INPUT_CLS} resize-y min-h-[160px]`}
                  style={{ padding: '16px' }}
                />
                <div className="flex justify-between items-center mt-2 px-1">
                  {bio.length > 0 && bio.length < 150 && (
                    <span className="text-xs text-red-400 transition-opacity duration-300">
                      Please enter at least 150 characters.
                    </span>
                  )}
                  <span className={`text-xs font-medium ml-auto transition-colors duration-300 ${bio.length >= 150 ? 'text-[#a3a3a3]' : 'text-red-400'}`}>
                    {bio.length} / 150 min
                  </span>
                </div>
              </div>
              <ContinueButton onClick={goStep4} disabled={bio.length < 150} />
            </div>
          </StepView>
        )}

        {/* ─── STEP 4: PAST PROJECTS ─── */}
        {view === 'step4' && (
          <StepView
            icon={<FolderOpen className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />}
            typewriterText="Showcase your past work"
            ready={s4Ready}
            onReady={() => setS4Ready(true)}
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center mb-1 ml-1 pr-1">
                  <label className="block text-xs font-medium text-[#a3a3a3]">Your Portfolio</label>
                  <button type="button" onClick={() => setProjModalOpen(true)} className="text-xs font-medium text-[#e5e5e5] flex items-center gap-1 hover:text-white transition-colors">
                    <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
                    Add Project
                  </button>
                </div>
                {projects.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {projects.map((proj, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[#e5e5e5]">{proj.title}</div>
                          {proj.month && proj.year && (
                            <div className="text-xs text-[#a3a3a3] mt-0.5">
                              {MONTHS[parseInt(proj.month) - 1]} {proj.year}
                            </div>
                          )}
                          {proj.description && <div className="text-xs text-[#525252] mt-1 line-clamp-2">{proj.description}</div>}
                          {proj.techStack && <div className="text-xs text-[#a3a3a3] mt-1">{proj.techStack}</div>}
                        </div>
                        <button type="button" onClick={() => setProjects(projects.filter((_, j) => j !== i))} className="text-[#525252] hover:text-[#e5e5e5] transition-colors mt-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01] text-center">
                    <span className="text-xs text-[#525252]">No projects added yet. Showcase your best work!</span>
                  </div>
                )}
              </div>
              <ContinueButton onClick={goStep5} />
            </div>
          </StepView>
        )}

        {/* ─── STEP 5: AVAILABILITY & RATES ─── */}
        {view === 'step5' && (
          <StepView
            icon={<Wallet2 className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />}
            typewriterText="Your availability & rates"
            ready={s5Ready}
            onReady={() => setS5Ready(true)}
          >
            <div className="flex flex-col gap-6">
              {/* Work Preference */}
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-[#a3a3a3] ml-1">Work Preference</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="cursor-pointer relative group">
                    <input type="radio" name="rate-pref" value="hourly" checked={ratePref === 'hourly'} onChange={() => setRatePref('hourly')} className="peer sr-only" />
                    <div className="rounded-xl border border-white/[0.12] bg-white/[0.02] p-4 group-hover:border-white/20 peer-checked:border-[#e5e5e5] peer-checked:bg-white/[0.05] transition-all duration-200 flex flex-col items-start gap-1">
                      <Clock className="w-[22px] h-[22px] text-[#e5e5e5] mb-1" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-[#e5e5e5]">Hourly Rate</span>
                      <span className="text-xs text-[#525252]">Charge by the hour</span>
                    </div>
                  </label>
                  <label className="cursor-pointer relative group">
                    <input type="radio" name="rate-pref" value="fixed" checked={ratePref === 'fixed'} onChange={() => setRatePref('fixed')} className="peer sr-only" />
                    <div className="rounded-xl border border-white/[0.12] bg-white/[0.02] p-4 group-hover:border-white/20 peer-checked:border-[#e5e5e5] peer-checked:bg-white/[0.05] transition-all duration-200 flex flex-col items-start gap-1">
                      <Package className="w-[22px] h-[22px] text-[#e5e5e5] mb-1" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-[#e5e5e5]">Fixed Project</span>
                      <span className="text-xs text-[#525252]">Charge per milestone</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Rate + Min Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">
                    {ratePref === 'hourly' ? 'Hourly Rate (USD)' : 'Target Project Rate (USD)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#525252] font-medium text-sm">$</span>
                    <input
                      type="number"
                      min={5}
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder={ratePref === 'hourly' ? '50' : '2000'}
                      className={`${INPUT_CLS} pl-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      style={{ ...INPUT_STYLE, paddingLeft: '32px' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Min. Project Budget (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#525252] font-medium text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      value={minBudget}
                      onChange={(e) => setMinBudget(e.target.value)}
                      placeholder="500"
                      className={`${INPUT_CLS} pl-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      style={{ ...INPUT_STYLE, paddingLeft: '32px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Availability + Long-term */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5 ml-1">Availability (hrs/week)</label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    placeholder="e.g. 20"
                    className={`${INPUT_CLS} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    style={INPUT_STYLE}
                  />
                </div>
                <div className="flex items-center justify-between px-4 rounded-xl border border-white/[0.12] bg-white/[0.02] h-[50px] transition-all duration-200 hover:border-white/20">
                  <span className="text-sm font-medium text-[#e5e5e5]">Open to long-term?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={longTerm}
                      onChange={(e) => setLongTerm(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#e5e5e5] after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#e5e5e5] peer-checked:after:bg-[#0a0a0a] peer-checked:after:border-none" />
                  </label>
                </div>
              </div>

              {/* Wallet Address */}
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-[#a3a3a3] ml-1">
                  ETH Wallet Address
                  <span className="text-[#525252] font-normal ml-1">(for escrow payments)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#525252]">
                    <Wallet2 className="w-4 h-4" strokeWidth={1.5} />
                  </span>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => {
                      const v = e.target.value
                      setWalletAddress(v)
                      if (v && !/^0x[a-fA-F0-9]{40}$/.test(v)) {
                        setWalletError('Please enter a valid Ethereum wallet address (0x...)')
                      } else {
                        setWalletError('')
                      }
                    }}
                    placeholder="0x..."
                    className={`${INPUT_CLS} pl-10 font-mono`}
                    style={{ ...INPUT_STYLE, paddingLeft: '40px' }}
                  />
                </div>
                {walletError && (
                  <p className="text-xs text-red-400/80 ml-1">{walletError}</p>
                )}
                <p className="text-[11px] text-[#525252] ml-1 leading-relaxed">
                  We currently only accept Ethereum wallets. This is where you'll receive escrow payments from clients.
                </p>
              </div>

              {/* Terms */}
              <div className="mt-4">
                <label className="relative flex items-start cursor-pointer group w-fit ml-1">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded border border-white/20 bg-white/[0.02] peer-checked:bg-[#e5e5e5] peer-checked:border-[#e5e5e5] flex items-center justify-center transition-all mt-0.5 shrink-0 group-hover:border-white/40">
                    {termsAccepted && <Check className="w-3 h-3 text-[#0a0a0a]" strokeWidth={3} />}
                  </div>
                  <span className="ml-3 text-xs text-[#a3a3a3] select-none leading-relaxed">
                    I agree to the <span className="text-[#e5e5e5] hover:underline underline-offset-2 cursor-pointer">Terms of Service</span> and <span className="text-[#e5e5e5] hover:underline underline-offset-2 cursor-pointer">Privacy Policy</span>. I understand that my profile will be reviewed before approval.
                  </span>
                </label>
              </div>

              <ContinueButton onClick={handleComplete} label={saving ? 'Saving...' : 'Complete Profile'} disabled={!termsAccepted || saving} />
            </div>
          </StepView>
        )}
      </main>

      {/* Modals */}
      <ExperienceModal open={expModalOpen} onClose={() => setExpModalOpen(false)} onSave={(exp) => setExperiences([...experiences, exp])} />
      <ProjectModal open={projModalOpen} onClose={() => setProjModalOpen(false)} onSave={(proj) => setProjects([...projects, proj])} />
    </div>
  )
}
