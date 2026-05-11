import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Pencil, MapPin, Camera,
  PlusCircle, Trash2,
  X, Upload, ChevronDown, Loader2, Clock,
  Share2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
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

const LINK_PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
  { key: 'github', label: 'GitHub', placeholder: 'github.com/username' },
  { key: 'x', label: 'X / Twitter', placeholder: 'x.com/username' },
  { key: 'portfolio', label: 'Portfolio', placeholder: 'yoursite.com' },
]

const PROFICIENCIES = ['Native', 'Fluent', 'Conversational', 'Basic']

/* ─── Helpers ─── */
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

/* ─── Toast ─── */
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`fixed top-20 right-4 lg:top-24 lg:right-8 bg-[#111111] border border-[#ffffff]/10 rounded-xl px-4 py-3 shadow-2xl z-[200] flex items-center gap-3 transition-all duration-300 ease-out ${visible ? 'translate-x-0 opacity-100' : 'translate-x-[150%] opacity-0 pointer-events-none'}`}>
      <span className="text-sm font-medium text-[#fafafa] tracking-tight">{message}</span>
    </div>
  )
}

/* ─── Section Edit Modal Shell ─── */
function SectionModal({ title, description, onClose, onSave, saving, disabled, children }: {
  title: string
  description?: string
  onClose: () => void
  onSave: () => void
  saving: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0e0e0e] border border-[#ffffff]/[0.08] rounded-2xl shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div className="pr-4">
            <h3 className="text-lg font-semibold text-[#e5e5e5] tracking-tight">{title}</h3>
            {description && <p className="text-sm text-[#737373] mt-2 leading-relaxed">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-[#525252] hover:text-[#e5e5e5] transition-colors cursor-pointer p-1 shrink-0 mt-0.5">
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        {/* Body */}
        <div className="p-6">{children}</div>
        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-[#737373] hover:text-[#e5e5e5] transition-colors cursor-pointer">Cancel</button>
          <button type="button" onClick={onSave} disabled={saving || disabled} className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#cccccc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Pencil Edit Button ─── */
function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
      <Pencil className="w-4 h-4" strokeWidth={1.5} />
    </button>
  )
}

/* ─── Country List ─── */
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

/* ─── Country Select (searchable dropdown) ─── */
function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = search
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // scroll to selected on open
  useEffect(() => {
    if (open && value && listRef.current) {
      const idx = COUNTRIES.indexOf(value)
      if (idx >= 0) listRef.current.scrollTop = idx * 36 - 72
    }
  }, [open, value])

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">Country</label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className="w-full rounded-xl text-sm text-left outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 focus:border-[#ffffff]/[0.2] transition-colors cursor-pointer flex items-center justify-between"
      >
        <span className={value ? 'text-[#e5e5e5]' : 'text-[#333]'}>{value || 'Select country'}</span>
        <ChevronDown className={`w-4 h-4 text-[#525252] transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#111111] border border-[#ffffff]/[0.1] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              autoFocus
              className="w-full rounded-lg text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.05] border border-[#ffffff]/[0.08] px-3 py-2 placeholder:text-[#525252] focus:border-[#ffffff]/[0.2] transition-colors"
            />
          </div>
          <div ref={listRef} className="max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((country) => (
              <button
                key={country}
                type="button"
                onClick={() => { onChange(country); setOpen(false) }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${country === value ? 'bg-[#ffffff]/[0.08] text-[#fafafa]' : 'text-[#a6a6a6] hover:bg-[#ffffff]/[0.05] hover:text-[#fafafa]'}`}
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

/* ─── Edit Name & Location Modal ─── */
function EditNameModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const [name, setName] = useState(user.name || '')
  const [location, setLocation] = useState(user.location || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated = await api.updateUser(user.id, { name: name.trim(), location: location || null } as Partial<api.User>)
      useAuthStore.getState().setName(name.trim())
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Edit your name" description="This is how you'll appear to clients on Sifter." onClose={onClose} onSave={handleSave} saving={saving} disabled={!name.trim()}>
      <div className="flex flex-col gap-4">
        <MInput label="Full name *" value={name} onChange={setName} placeholder="Your full name" />
        <CountrySelect value={location} onChange={setLocation} />
      </div>
    </SectionModal>
  )
}

/* ─── Edit Title Modal ─── */
function EditTitleModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const [title, setTitle] = useState(user.title || user.headline || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.updateUser(user.id, { title: title.trim(), headline: title.trim() })
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Edit your title" description="Enter a single sentence description of your professional skills/experience (e.g. Expert Web Designer with Ajax experience)" onClose={onClose} onSave={handleSave} saving={saving}>
      <MInput label="Your title *" value={title} onChange={setTitle} placeholder="e.g. Full Stack Developer | React & Node.js" />
    </SectionModal>
  )
}

/* ─── Edit About / Bio Modal ─── */
function EditAboutModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const [bio, setBio] = useState(user.bio || '')
  const [saving, setSaving] = useState(false)
  const maxChars = 5000

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.updateUser(user.id, { bio: bio.trim() })
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Profile overview" description="Use this space to show clients you have the skills and experience they're looking for." onClose={onClose} onSave={handleSave} saving={saving}>
      <div className="mb-2">
        <ul className="text-xs text-[#525252] space-y-1 list-disc list-inside">
          <li>Describe your strengths and skills</li>
          <li>Highlight projects, accomplishments and education</li>
          <li>Keep it short and make sure it's error-free</li>
        </ul>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">Profile overview</label>
        <textarea rows={8} value={bio} onChange={(e) => setBio(e.target.value.slice(0, maxChars))} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 placeholder:text-[#333] resize-none focus:border-[#ffffff]/[0.2] transition-colors" placeholder="I am a..." />
        <p className="text-xs text-[#525252] text-right mt-1">{maxChars - bio.length} characters left</p>
      </div>
    </SectionModal>
  )
}

/* ─── Edit Skills Modal ─── */
function EditSkillsModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const [skills, setSkills] = useState<string[]>([...user.skills])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const addSkill = () => {
    const s = input.trim()
    if (s && !skills.includes(s)) { setSkills([...skills, s]); setInput('') }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.updateUser(user.id, { skills })
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Edit your skills" description="Add skills that showcase your expertise to clients. Press Enter or click Add." onClose={onClose} onSave={handleSave} saving={saving}>
      <div className="flex gap-2 mb-4">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} className="flex-1 rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 placeholder:text-[#333] focus:border-[#ffffff]/[0.2] transition-colors" placeholder="Type a skill..." />
        <button type="button" onClick={addSkill} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#e5e5e5] bg-[#ffffff]/[0.06] border border-[#ffffff]/[0.1] hover:bg-[#ffffff]/[0.1] transition-colors cursor-pointer">Add</button>
      </div>
      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] text-xs font-medium text-[#a6a6a6]">
            {skill}
            <button type="button" onClick={() => setSkills(skills.filter((s) => s !== skill))} className="text-[#525252] hover:text-[#ef4444] transition-colors cursor-pointer">
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          </span>
        ))}
        {skills.length === 0 && <p className="text-sm text-[#525252]">No skills added yet</p>}
      </div>
    </SectionModal>
  )
}

/* ─── Edit Rate & Availability Modal ─── */
function EditRateModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const [hourlyRate, setHourlyRate] = useState(user.hourlyRate != null ? String(user.hourlyRate) : '')
  const [availability, setAvailability] = useState(user.availability != null ? String(user.availability) : '30')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates: Partial<api.User> = {}
      const rate = parseFloat(hourlyRate)
      if (!isNaN(rate) && rate >= 0) updates.hourlyRate = rate
      else if (hourlyRate.trim() === '') updates.hourlyRate = null as unknown as number
      const avail = parseInt(availability)
      if (!isNaN(avail) && avail >= 0) updates.availability = avail
      const updated = await api.updateUser(user.id, updates)
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Edit rate & availability" description="Set your hourly rate and weekly availability so clients know what to expect." onClose={onClose} onSave={handleSave} saving={saving}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">Hourly rate (USD)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#525252]">$</span>
            <input type="number" min="0" step="1" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] pl-7 pr-14 py-3 placeholder:text-[#333] focus:border-[#ffffff]/[0.2] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="25" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#525252]">/hr</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">Availability (hours/week)</label>
          <input type="number" min="0" max="60" value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 placeholder:text-[#333] focus:border-[#ffffff]/[0.2] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="30" />
        </div>
      </div>
    </SectionModal>
  )
}

/* ─── Edit Languages Modal ─── */
function EditLanguagesModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const [languages, setLanguages] = useState<api.LanguageItem[]>([...((user.languages ?? []) as api.LanguageItem[])])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const filtered = languages.filter((l) => l.name.trim())
      const updated = await api.updateUser(user.id, { languages: filtered as unknown as api.User['languages'] })
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Edit languages" description="Add the languages you speak so clients can find the right match." onClose={onClose} onSave={handleSave} saving={saving}>
      <div className="flex flex-col gap-3">
        {languages.map((lang, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="text" value={lang.name} onChange={(e) => setLanguages(prev => prev.map((l, j) => j === i ? { ...l, name: e.target.value } : l))} className="flex-1 rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 placeholder:text-[#333] focus:border-[#ffffff]/[0.2] transition-colors" placeholder="Language" />
            <div className="relative">
              <select value={lang.proficiency} onChange={(e) => setLanguages(prev => prev.map((l, j) => j === i ? { ...l, proficiency: e.target.value } : l))} className="rounded-xl text-sm text-[#e5e5e5] outline-none appearance-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 pr-8 cursor-pointer focus:border-[#ffffff]/[0.2] transition-colors">
                {PROFICIENCIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-[#525252]" strokeWidth={1.5} />
            </div>
            <button type="button" onClick={() => setLanguages(prev => prev.filter((_, j) => j !== i))} className="p-2 text-[#525252] hover:text-[#ef4444] transition-colors cursor-pointer shrink-0">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setLanguages([...languages, { name: '', proficiency: 'Conversational' }])} className="flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#e5e5e5] transition-colors cursor-pointer self-start">
          <PlusCircle className="w-4 h-4" strokeWidth={1.5} /> Add language
        </button>
      </div>
    </SectionModal>
  )
}

/* ─── Edit Education Modal ─── */
function EditEducationModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const [education, setEducation] = useState<api.EducationItem[]>([...((user.education ?? []) as api.EducationItem[])])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const filtered = education.filter((e) => e.institution.trim() || e.degree.trim())
      const updated = await api.updateUser(user.id, { education: filtered as unknown as api.User['education'] })
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Edit education" description="Add your educational background to build credibility with clients." onClose={onClose} onSave={handleSave} saving={saving}>
      <div className="flex flex-col gap-4">
        {education.map((edu, i) => (
          <div key={i} className="bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06] rounded-xl p-4 relative">
            <button type="button" onClick={() => setEducation(prev => prev.filter((_, j) => j !== i))} className="absolute top-3 right-3 p-1 text-[#525252] hover:text-[#ef4444] transition-colors cursor-pointer">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
            <div className="flex flex-col gap-3 pr-6">
              <MInput label="Degree / Certificate" value={edu.degree} onChange={(v) => setEducation(prev => prev.map((e, j) => j === i ? { ...e, degree: v } : e))} placeholder="e.g. B.Tech Computer Science" />
              <MInput label="Institution" value={edu.institution} onChange={(v) => setEducation(prev => prev.map((e, j) => j === i ? { ...e, institution: v } : e))} placeholder="e.g. MIT" />
              <div className="grid grid-cols-2 gap-3">
                <MInput label="Start Year" value={edu.startYear} onChange={(v) => setEducation(prev => prev.map((e, j) => j === i ? { ...e, startYear: v } : e))} placeholder="2020" />
                <MInput label="End Year" value={edu.endYear} onChange={(v) => setEducation(prev => prev.map((e, j) => j === i ? { ...e, endYear: v } : e))} placeholder="2024" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setEducation([...education, { institution: '', degree: '', startYear: '', endYear: '' }])} className="flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#e5e5e5] transition-colors cursor-pointer self-start">
          <PlusCircle className="w-4 h-4" strokeWidth={1.5} /> Add education
        </button>
      </div>
    </SectionModal>
  )
}

/* ─── Edit Links Modal ─── */
function EditLinksModal({ user, onSave, onClose }: { user: api.User; onSave: (u: api.User) => void; onClose: () => void }) {
  const existing = (user.socialLinks ?? []) as api.SocialLink[]
  const getUrl = (platform: string) => existing.find((l) => l.platform === platform)?.url || ''
  const [links, setLinks] = useState<Record<string, string>>(
    Object.fromEntries(LINK_PLATFORMS.map((p) => [p.key, getUrl(p.key)]))
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const socialLinks: api.SocialLink[] = LINK_PLATFORMS
        .filter((p) => links[p.key]?.trim())
        .map((p) => ({ platform: p.key, url: links[p.key].trim() }))
      const updated = await api.updateUser(user.id, { socialLinks: socialLinks as unknown as api.User['socialLinks'] })
      onSave(updated)
    } catch { setSaving(false) }
  }

  return (
    <SectionModal title="Edit links" description="Add your professional links so clients can learn more about you." onClose={onClose} onSave={handleSave} saving={saving}>
      <div className="flex flex-col gap-4">
        {LINK_PLATFORMS.map((p) => (
          <div key={p.key} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] flex items-center justify-center shrink-0 text-[#737373]">
              {SOCIAL_ICON_MAP[p.key] || <GlobeIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <MInput label={p.label} value={links[p.key] || ''} onChange={(v) => setLinks({ ...links, [p.key]: v })} placeholder={p.placeholder} />
            </div>
          </div>
        ))}
      </div>
    </SectionModal>
  )
}

/* ─── Main Component ─── */
export default function FreelancerMyProfilePage() {
  const authUser = useAuthStore((s) => s.user)
  const [user, setUser] = useState<api.User | null>(null)
  const [platformProjects, setPlatformProjects] = useState<api.Project[]>([])
  const [loading, setLoading] = useState(true)
  const [, setSaving] = useState(false)
  const [editModal, setEditModal] = useState<'name' | 'title' | 'about' | 'skills' | 'rate' | 'languages' | 'education' | 'links' | null>(null)
  const [editingEmployment, setEditingEmployment] = useState(false)
  const [editingPortfolio, setEditingPortfolio] = useState(false)
  const [aboutExpanded, setAboutExpanded] = useState(false)
  const [showExpModal, setShowExpModal] = useState(false)
  const [showPortfolioModal, setShowPortfolioModal] = useState(false)
  const [toast, setToast] = useState({ message: '', visible: false })
  const [workHistoryTab, setWorkHistoryTab] = useState<'all' | 'in_progress' | 'completed'>('all')
  const [extracting, setExtracting] = useState(false)
  const [viewingProject, setViewingProject] = useState<api.PortfolioItem | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const portfolioScrollRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string) => {
    clearTimeout(toastTimer.current)
    setToast({ message, visible: true })
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000)
  }, [])

  useEffect(() => {
    if (!authUser?.id) return
    Promise.all([
      api.getUser(authUser.id),
      api.listProjects({ memberId: authUser.id }),
    ]).then(([u, projects]) => {
      setUser(u)
      setPlatformProjects(projects)
      if (u.avatar) useAuthStore.getState().setAvatar(u.avatar)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [authUser?.id])

  const handleSectionSave = (updated: api.User) => {
    setUser(prev => prev ? { ...prev, ...updated } : prev)
    if (updated.name) useAuthStore.getState().setName(updated.name)
    showToast('Changes saved successfully')
    setEditModal(null)
  }

  const handleResumeUpload = async (file: File) => {
    if (!user) return
    setExtracting(true)
    try {
      const data = await api.extractResume(file)
      const updates: Partial<api.User> = {}
      if (data.name) updates.name = data.name
      if (data.professionalTitle) { updates.title = data.professionalTitle; updates.headline = data.professionalTitle }
      if (data.headline) updates.headline = data.headline
      if (data.bio) updates.bio = data.bio
      if (data.country) updates.location = data.country
      if (data.experienceYears != null) updates.experience = data.experienceYears
      if (data.skills?.length) updates.skills = data.skills
      if (data.categories?.length) updates.categories = data.categories
      if (data.languages?.length) updates.languages = data.languages as unknown as api.User['languages']
      if (data.education?.length) updates.education = data.education as unknown as api.User['education']

      // Social links
      const socialLinks: api.SocialLink[] = []
      if (data.links?.linkedin) socialLinks.push({ platform: 'linkedin', url: data.links.linkedin })
      if (data.links?.github) socialLinks.push({ platform: 'github', url: data.links.github })
      if (data.links?.x) socialLinks.push({ platform: 'x', url: data.links.x })
      if (data.links?.portfolio) socialLinks.push({ platform: 'portfolio', url: data.links.portfolio })
      if (socialLinks.length) updates.socialLinks = socialLinks as unknown as api.User['socialLinks']

      // Work experience
      if (data.workExperience?.length) {
        updates.workHistory = data.workExperience.map((w) => ({
          role: w.role, company: w.company, startDate: w.startDate, endDate: w.endDate,
          current: !w.endDate || w.endDate.toLowerCase() === 'present', description: w.description,
        })) as unknown as api.User['workHistory']
      }

      // Projects
      if (data.projects?.length) {
        updates.portfolio = data.projects.map((p) => ({
          title: p.title, month: p.startMonthYear, year: p.endMonthYear,
          description: p.description, techStack: p.techStack.join(', '), link: '',
        })) as unknown as api.User['portfolio']
      }

      if (Object.keys(updates).length) {
        const updated = await api.updateUser(user.id, updates)
        setUser(prev => prev ? { ...prev, ...updated } : prev)
        if (updates.name) useAuthStore.getState().setName(updates.name)
      }
      showToast('Resume data extracted & saved')
    } catch {
      showToast('Resume extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  const persistField = async (field: string, value: unknown) => {
    if (!user) return
    setSaving(true)
    try {
      const updated = await api.updateUser(user.id, { [field]: value } as Partial<api.User>)
      setUser((prev) => prev ? { ...prev, ...updated } : prev)
    } catch {
      showToast('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const deleteExperience = async (index: number) => {
    if (!user) return
    const wh = [...((user.workHistory ?? []) as api.WorkHistoryItem[])]
    wh.splice(index, 1)
    await persistField('workHistory', wh)
    showToast('Removed from employment history')
  }

  const addExperience = async (exp: api.WorkHistoryItem) => {
    if (!user) return
    const wh = [...((user.workHistory ?? []) as api.WorkHistoryItem[]), exp]
    await persistField('workHistory', wh)
    showToast('Added to employment history')
  }

  const deletePortfolioItem = async (index: number) => {
    if (!user) return
    const pf = [...((user.portfolio ?? []) as api.PortfolioItem[])]
    pf.splice(index, 1)
    await persistField('portfolio', pf)
    showToast('Portfolio item removed')
  }

  const addPortfolioItem = async (proj: api.PortfolioItem) => {
    if (!user) return
    const pf = [...((user.portfolio ?? []) as api.PortfolioItem[]), proj]
    await persistField('portfolio', pf)
    showToast('Portfolio item added')
  }

  const setAuthAvatar = useAuthStore((s) => s.setAvatar)

  const handleAvatarUpload = async (file: File) => {
    if (!user) return
    setSaving(true)
    try {
      const { url } = await api.uploadFile(file)
      const updated = await api.updateUser(user.id, { avatar: url } as Partial<api.User>)
      setUser((prev) => prev ? { ...prev, ...updated, avatar: url } : prev)
      setAuthAvatar(url)
      showToast('Profile photo updated')
    } catch {
      showToast('Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const scrollPortfolio = (dir: 'left' | 'right') => {
    const el = portfolioScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] antialiased">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 h-full min-h-0 flex flex-col w-full overflow-y-auto hide-scrollbar animate-pulse">

          {/* Profile Header Skeleton */}
          <section className="flex items-center justify-between gap-4 mb-0 px-2 sm:px-4 py-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1a1a1a]" />
              <div>
                <div className="h-7 w-48 bg-[#1a1a1a] rounded-lg" />
                <div className="h-4 w-28 bg-[#141414] rounded-md mt-2" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1a1a1a]" />
              <div className="w-36 h-10 rounded-xl bg-[#1a1a1a]" />
            </div>
          </section>

          <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

          {/* Two Column Skeleton */}
          <div className="flex flex-col lg:flex-row gap-0 px-2 sm:px-4 py-8">

            {/* Left Sidebar Skeleton */}
            <aside className="w-full lg:w-[260px] shrink-0 flex flex-col gap-10 lg:pr-8 lg:border-r lg:border-[#ffffff]/10 pb-8 lg:pb-0">
              {/* Availability */}
              <div>
                <div className="h-3 w-24 bg-[#1a1a1a] rounded mb-3" />
                <div className="h-4 w-44 bg-[#141414] rounded-md" />
                <div className="h-4 w-20 bg-[#141414] rounded-md mt-2" />
              </div>
              {/* Languages */}
              <div>
                <div className="h-3 w-20 bg-[#1a1a1a] rounded mb-3" />
                <div className="space-y-2">
                  <div className="flex justify-between"><div className="h-4 w-20 bg-[#141414] rounded-md" /><div className="h-3 w-16 bg-[#111] rounded-md" /></div>
                  <div className="flex justify-between"><div className="h-4 w-16 bg-[#141414] rounded-md" /><div className="h-3 w-20 bg-[#111] rounded-md" /></div>
                </div>
              </div>
              {/* Education */}
              <div>
                <div className="h-3 w-20 bg-[#1a1a1a] rounded mb-3" />
                <div className="h-4 w-40 bg-[#141414] rounded-md" />
                <div className="h-3 w-32 bg-[#111] rounded-md mt-1.5" />
                <div className="h-3 w-24 bg-[#111] rounded-md mt-1.5" />
              </div>
              {/* Links */}
              <div>
                <div className="h-3 w-12 bg-[#1a1a1a] rounded mb-3" />
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#141414]" />
                      <div className="h-4 w-20 bg-[#141414] rounded-md" />
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Right Main Skeleton */}
            <div className="flex-1 min-w-0 lg:pl-8">
              {/* Title + Rate */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="h-6 w-64 bg-[#1a1a1a] rounded-lg" />
                <div className="h-6 w-20 bg-[#1a1a1a] rounded-lg" />
              </div>
              {/* About */}
              <div className="mb-6">
                <div className="h-3 w-12 bg-[#1a1a1a] rounded mb-3" />
                <div className="space-y-2.5">
                  <div className="h-4 w-full bg-[#141414] rounded-md" />
                  <div className="h-4 w-full bg-[#141414] rounded-md" />
                  <div className="h-4 w-3/4 bg-[#141414] rounded-md" />
                  <div className="h-4 w-5/6 bg-[#141414] rounded-md" />
                </div>
              </div>
              <div className="border-t border-[#ffffff]/10 my-6" />
              {/* Skills */}
              <div>
                <div className="h-3 w-12 bg-[#1a1a1a] rounded mb-4" />
                <div className="flex flex-wrap gap-2">
                  {[20, 16, 24, 14, 18, 22, 12, 20].map((w, i) => (
                    <div key={i} className="h-7 rounded-full bg-[#141414]" style={{ width: `${w * 4}px` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

          {/* Employment History Skeleton */}
          <section className="px-2 sm:px-4 py-8">
            <div className="h-3 w-40 bg-[#1a1a1a] rounded mb-6" />
            <div className="space-y-0">
              {[1, 2].map((i) => (
                <div key={i} className="py-5 border-b border-[#ffffff]/[0.05] last:border-b-0">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-36 bg-[#1a1a1a] rounded-md" />
                    <div className="h-4 w-28 bg-[#141414] rounded-md" />
                  </div>
                  <div className="h-3 w-40 bg-[#111] rounded-md mt-2" />
                  <div className="h-4 w-full bg-[#141414] rounded-md mt-3" />
                  <div className="h-4 w-2/3 bg-[#141414] rounded-md mt-1.5" />
                </div>
              ))}
            </div>
          </section>

          <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

          {/* Portfolio Skeleton */}
          <section className="px-2 sm:px-4 py-8">
            <div className="h-3 w-20 bg-[#1a1a1a] rounded mb-6" />
            <div className="flex gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-[320px] shrink-0 bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06] rounded-xl overflow-hidden">
                  <div className="w-full h-[180px] bg-[#0e0e0e]" />
                  <div className="p-4">
                    <div className="h-4 w-40 bg-[#1a1a1a] rounded-md" />
                    <div className="h-3 w-full bg-[#141414] rounded-md mt-3" />
                    <div className="h-3 w-2/3 bg-[#141414] rounded-md mt-1.5" />
                    <div className="flex gap-1.5 mt-3">
                      <div className="h-5 w-14 rounded-full bg-[#141414]" />
                      <div className="h-5 w-12 rounded-full bg-[#141414]" />
                      <div className="h-5 w-16 rounded-full bg-[#141414]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

          {/* Work History Skeleton */}
          <section className="px-2 sm:px-4 py-8 pb-16">
            <div className="flex items-center justify-between mb-6">
              <div className="h-3 w-28 bg-[#1a1a1a] rounded" />
              <div className="flex gap-1 bg-[#ffffff]/[0.03] rounded-lg p-0.5">
                <div className="h-7 w-12 rounded-md bg-[#ffffff]/[0.08]" />
                <div className="h-7 w-20 rounded-md bg-[#141414]" />
                <div className="h-7 w-20 rounded-md bg-[#141414]" />
              </div>
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="py-5 border-b border-[#ffffff]/[0.05] last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-[#1a1a1a] rounded-md" />
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-5 w-20 rounded-full bg-[#141414]" />
                      <div className="h-3 w-32 bg-[#111] rounded-md" />
                    </div>
                    <div className="h-3 w-full bg-[#141414] rounded-md mt-3" />
                    <div className="h-3 w-24 bg-[#111] rounded-md mt-2" />
                  </div>
                  <div className="h-4 w-16 bg-[#1a1a1a] rounded-md" />
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] antialiased">
        <Header />
        <div className="flex items-center justify-center pt-40"><p className="text-[#a6a6a6]">Profile not found</p></div>
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
      <Toast message={toast.message} visible={toast.visible} />

      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = '' }} />
      <input ref={resumeInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); e.target.value = '' }} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 h-full min-h-0 flex flex-col w-full overflow-y-auto hide-scrollbar">

        {/* ── Profile Header ── */}
        <section className="flex items-center justify-between gap-4 mb-0 px-2 sm:px-4 py-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full ring-2 ring-[#ffffff]/[0.08]" alt="Profile" />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-2 ring-[#ffffff]/[0.08] bg-[#1a1a1a] flex items-center justify-center text-xl sm:text-2xl font-semibold text-[#e5e5e5] tracking-tight">
                  {getInitials(user.name || 'U')}
                </div>
              )}
              <button type="button" onClick={() => avatarInputRef.current?.click()} className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="w-5 h-5 text-white/80" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#fafafa]">{user.name || 'Unnamed'}</h1>
                <EditBtn onClick={() => setEditModal('name')} />
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
            <button type="button" onClick={() => resumeInputRef.current?.click()} disabled={extracting} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#ffffff]/[0.12] bg-[#ffffff]/[0.02] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer disabled:opacity-50 text-sm text-[#a6a6a6]">
              {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" strokeWidth={1.5} />}
              {extracting ? 'Extracting...' : 'Import Resume'}
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Availability</h3>
                <EditBtn onClick={() => setEditModal('rate')} />
              </div>
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Languages</h3>
                <EditBtn onClick={() => setEditModal('languages')} />
              </div>
              {languages.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {languages.map((lang, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-[#e5e5e5]">{lang.name}</span>
                      <span className="text-xs text-[#525252]">{lang.proficiency}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-[#525252]">Not specified</p>}
            </div>

            {/* Education */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Education</h3>
                <EditBtn onClick={() => setEditModal('education')} />
              </div>
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
              ) : <p className="text-sm text-[#525252]">Not specified</p>}
            </div>

            {/* Links */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Links</h3>
                <EditBtn onClick={() => setEditModal('links')} />
              </div>
              {socialLinks.length > 0 ? (
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
              ) : <p className="text-sm text-[#525252]">Not specified</p>}
            </div>
          </aside>

          {/* ── Right Main Content ── */}
          <div className="flex-1 min-w-0 lg:pl-8">

            {/* Title + Rate */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-[#fafafa] tracking-tight">{user.title || user.headline || 'Freelancer'}</h2>
                <EditBtn onClick={() => setEditModal('title')} />
              </div>
              {user.hourlyRate != null && (
                <span className="text-xl font-semibold text-[#fafafa] shrink-0">${user.hourlyRate.toFixed(2)}<span className="text-sm text-[#737373] font-normal">/hr</span></span>
              )}
            </div>

            {/* About */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">About</h3>
                <EditBtn onClick={() => setEditModal('about')} />
              </div>
              {aboutParagraphs.length > 0 ? (
                <>
                  <div className={`text-sm text-[#a6a6a6] font-light leading-[1.8] space-y-3 ${aboutExpanded ? '' : 'line-clamp-4'} transition-all duration-300`}>
                    {aboutParagraphs.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                  {(user.bio?.length ?? 0) > 200 && (
                    <button type="button" onClick={() => setAboutExpanded((v) => !v)} className="text-xs text-[#fafafa] mt-3 font-medium hover:text-[#a6a6a6] transition-colors cursor-pointer">
                      {aboutExpanded ? 'less' : 'more'}
                    </button>
                  )}
                </>
              ) : <p className="text-sm text-[#525252]">No bio added yet</p>}
            </div>

            <div className="border-t border-[#ffffff]/10 my-6" />

            {/* Skills */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Skills</h3>
                <EditBtn onClick={() => setEditModal('skills')} />
              </div>
              {user.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <span key={skill} className="px-4 py-1.5 rounded-full bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] text-xs font-medium text-[#a6a6a6]">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-[#525252]">No skills added</p>}
            </div>
          </div>
        </div>

        <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

        {/* ── Employment History ── */}
        <section className="px-2 sm:px-4 py-8 hover:bg-[#ffffff]/[0.02] rounded-2xl transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Employment History</h3>
            <div className="flex items-center gap-2">
              {editingEmployment && (
                <button type="button" onClick={() => setShowExpModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff]/[0.06] border border-[#ffffff]/[0.1] text-xs font-medium text-[#e5e5e5] hover:bg-[#ffffff]/[0.1] transition-all cursor-pointer">
                  <PlusCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> Add
                </button>
              )}
              <button type="button" onClick={() => setEditingEmployment(!editingEmployment)} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                <Pencil className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {workHistory.length > 0 ? (
            <div className="space-y-0">
              {workHistory.map((exp, i) => (
                <div key={i} className={`relative flex gap-4 py-5 ${i < workHistory.length - 1 ? 'border-b border-[#ffffff]/[0.05]' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-[#fafafa] tracking-tight">{exp.role}</h4>
                      <span className="text-[#525252]">|</span>
                      <span className="text-sm text-[#737373]">{exp.company}</span>
                    </div>
                    <p className="text-xs text-[#525252] mt-1">{exp.startDate} – {exp.current ? 'Present' : exp.endDate}</p>
                    {exp.description && <p className="text-sm text-[#a6a6a6] mt-2 font-light leading-relaxed">{exp.description}</p>}
                  </div>
                  {editingEmployment && (
                    <button type="button" onClick={() => deleteExperience(i)} className="absolute top-5 right-0 p-1.5 text-[#525252] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-all cursor-pointer">
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none"><rect x="16" y="28" width="48" height="32" rx="4" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1.5"/><rect x="30" y="20" width="20" height="12" rx="3" fill="none" stroke="#2a2a2a" strokeWidth="1.5"/><rect x="24" y="40" width="32" height="2" rx="1" fill="#252525"/><rect x="28" y="46" width="24" height="2" rx="1" fill="#1f1f1f"/><circle cx="40" cy="34" r="3" fill="#252525"/></svg>
              <p className="text-sm text-[#525252] mt-3">No employment history yet</p>
              <p className="text-xs text-[#3a3a3a] mt-1">Add your work experience to build credibility</p>
            </div>
          )}
        </section>

        <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

        {/* ── Portfolio ── */}
        <section className="px-2 sm:px-4 py-8 hover:bg-[#ffffff]/[0.02] rounded-2xl transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Portfolio</h3>
            <div className="flex items-center gap-2">
              {portfolio.length > 2 && (
                <>
                  <button type="button" onClick={() => scrollPortfolio('left')} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer"><ChevronLeft className="w-4 h-4" strokeWidth={1.5} /></button>
                  <button type="button" onClick={() => scrollPortfolio('right')} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer"><ChevronRight className="w-4 h-4" strokeWidth={1.5} /></button>
                </>
              )}
              {editingPortfolio && (
                <button type="button" onClick={() => setShowPortfolioModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff]/[0.06] border border-[#ffffff]/[0.1] text-xs font-medium text-[#e5e5e5] hover:bg-[#ffffff]/[0.1] transition-all cursor-pointer">
                  <PlusCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> Add
                </button>
              )}
              <button type="button" onClick={() => setEditingPortfolio(!editingPortfolio)} className="p-1.5 rounded-lg text-[#525252] hover:text-[#e5e5e5] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer">
                <Pencil className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {portfolio.length > 0 ? (
            <div ref={portfolioScrollRef} className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none' }}>
              {portfolio.map((proj, i) => (
                <div key={i} onClick={() => !editingPortfolio && setViewingProject(proj)} className="relative w-[320px] shrink-0 snap-start bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06] rounded-xl overflow-hidden hover:border-[#ffffff]/[0.12] transition-all group cursor-pointer">
                  <div className="w-full h-[180px] bg-[#0a0a0a]" />
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-[#fafafa] tracking-tight pr-8">{proj.title}</h4>
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
                        View Project <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                      </a>
                    )}
                  </div>
                  {editingPortfolio && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); deletePortfolioItem(i) }} className="absolute top-3 right-3 p-1.5 bg-black/70 text-[#525252] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none"><rect x="12" y="22" width="36" height="44" rx="3" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1.5"/><rect x="18" y="30" width="24" height="3" rx="1.5" fill="#252525"/><rect x="18" y="37" width="18" height="2" rx="1" fill="#1f1f1f"/><rect x="32" y="26" width="36" height="44" rx="3" fill="#151515" stroke="#2a2a2a" strokeWidth="1.5"/><rect x="38" y="34" width="24" height="3" rx="1.5" fill="#252525"/></svg>
              <p className="text-sm text-[#525252] mt-3">Showcase your best work</p>
              <p className="text-xs text-[#3a3a3a] mt-1">Add projects to stand out to potential clients</p>
            </div>
          )}
        </section>

        <div className="border-t border-[#ffffff]/10 mx-2 sm:mx-4" />

        {/* ── Work History (Platform Projects) ── */}
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
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{project.status}
                          </span>
                          {project.dueDate && (
                            <span className="text-xs text-[#525252]">{new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                          )}
                        </div>
                        {project.description && <p className="text-xs text-[#737373] mt-2 font-light leading-relaxed line-clamp-2">{project.description}</p>}
                        <p className="text-xs text-[#525252] mt-2">Client: {project.owner.name || 'Unknown'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {project.budget != null && <p className="text-sm font-medium text-[#fafafa]">${project.budget.toLocaleString()}</p>}
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
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none"><rect x="14" y="24" width="52" height="36" rx="4" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1.5"/><rect x="22" y="32" width="16" height="2" rx="1" fill="#252525"/><rect x="22" y="38" width="28" height="2" rx="1" fill="#1f1f1f"/></svg>
              <p className="text-sm text-[#525252] mt-3">{workHistoryTab === 'all' ? 'No platform projects yet' : `No ${workHistoryTab === 'in_progress' ? 'in-progress' : 'completed'} projects`}</p>
              <p className="text-xs text-[#3a3a3a] mt-1 text-center leading-relaxed">Projects you complete on Sifter<br/>will automatically appear here</p>
            </div>
          )}
        </section>

      </main>

      {/* ── Per-Section Edit Modals ── */}
      {editModal === 'name' && <EditNameModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}
      {editModal === 'title' && <EditTitleModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}
      {editModal === 'about' && <EditAboutModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}
      {editModal === 'skills' && <EditSkillsModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}
      {editModal === 'rate' && <EditRateModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}
      {editModal === 'languages' && <EditLanguagesModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}
      {editModal === 'education' && <EditEducationModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}
      {editModal === 'links' && <EditLinksModal user={user} onSave={handleSectionSave} onClose={() => setEditModal(null)} />}

      {/* ── Add Employment & Portfolio Modals ── */}
      {showExpModal && (
        <ExperienceModal
          onClose={() => setShowExpModal(false)}
          onSave={(exp) => { addExperience(exp); setShowExpModal(false) }}
        />
      )}
      {showPortfolioModal && (
        <PortfolioModal
          onClose={() => setShowPortfolioModal(false)}
          onSave={(proj) => { addPortfolioItem(proj); setShowPortfolioModal(false) }}
        />
      )}

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

/* ─── Experience Modal ─── */
function ExperienceModal({ onClose, onSave }: { onClose: () => void; onSave: (exp: api.WorkHistoryItem) => void }) {
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [description, setDescription] = useState('')

  const handleSave = () => {
    if (!role.trim() || !company.trim()) return
    onSave({ role: role.trim(), company: company.trim(), startDate: startDate || '', endDate: isCurrent ? '' : endDate || '', current: isCurrent, description: description.trim() })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0e0e0e] border border-[#ffffff]/[0.08] rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-[#e5e5e5] tracking-tight">Add Employment</h3>
          <button type="button" onClick={onClose} className="text-[#525252] hover:text-[#e5e5e5] transition-colors cursor-pointer p-1"><X className="w-5 h-5" strokeWidth={1.5} /></button>
        </div>
        <div className="flex flex-col gap-4">
          <MInput label="Title / Role" value={role} onChange={setRole} placeholder="e.g. Senior Designer" />
          <MInput label="Company" value={company} onChange={setCompany} placeholder="e.g. Acme Corp" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 [color-scheme:dark] focus:border-[#ffffff]/[0.2] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isCurrent} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 disabled:opacity-40 [color-scheme:dark] focus:border-[#ffffff]/[0.2] transition-colors" />
            </div>
          </div>
          <div className="flex items-center ml-0.5">
            <input type="checkbox" id="exp-current" checked={isCurrent} onChange={(e) => { setIsCurrent(e.target.checked); if (e.target.checked) setEndDate('') }} className="w-3.5 h-3.5 rounded accent-[#e5e5e5] cursor-pointer" />
            <label htmlFor="exp-current" className="ml-2 text-xs text-[#737373] cursor-pointer">I currently work here</label>
          </div>
          <MTextarea label="Description" value={description} onChange={setDescription} placeholder="Briefly describe your role..." />
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-[#737373] hover:text-[#e5e5e5] transition-colors cursor-pointer">Cancel</button>
            <button type="button" onClick={handleSave} disabled={!role.trim() || !company.trim()} className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#cccccc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Add</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Portfolio Modal ─── */
function PortfolioModal({ onClose, onSave }: { onClose: () => void; onSave: (proj: api.PortfolioItem) => void }) {
  const [title, setTitle] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [description, setDescription] = useState('')
  const [tech, setTech] = useState('')
  const [url, setUrl] = useState('')

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), month, year, description: description.trim(), techStack: tech.trim(), link: url.trim() })
  }

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center overflow-y-auto py-10 px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0e0e0e] border border-[#ffffff]/[0.08] rounded-2xl p-6 shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-[#e5e5e5] tracking-tight">Add Portfolio Item</h3>
          <button type="button" onClick={onClose} className="text-[#525252] hover:text-[#e5e5e5] transition-colors cursor-pointer p-1"><X className="w-5 h-5" strokeWidth={1.5} /></button>
        </div>
        <div className="flex flex-col gap-4">
          <MInput label="Project Title" value={title} onChange={setTitle} placeholder="e.g. E-Commerce Dashboard" />
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none appearance-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 pr-10 cursor-pointer [color-scheme:dark] focus:border-[#ffffff]/[0.2] transition-colors">
                <option value="" disabled>Select</option>
                {months.map((m, i) => (<option key={i} value={String(i + 1)}>{m}</option>))}
              </select>
              <ChevronDown className="absolute right-3.5 bottom-3.5 pointer-events-none w-4 h-4 text-[#525252]" strokeWidth={1.5} />
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none appearance-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 pr-10 cursor-pointer [color-scheme:dark] focus:border-[#ffffff]/[0.2] transition-colors">
                <option value="" disabled>Select</option>
                {['2026', '2025', '2024', '2023', '2022', '2021', '2020'].map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
              <ChevronDown className="absolute right-3.5 bottom-3.5 pointer-events-none w-4 h-4 text-[#525252]" strokeWidth={1.5} />
            </div>
          </div>
          <MTextarea label="Description" value={description} onChange={setDescription} placeholder="What was the project about?" />
          <MInput label="Skills & Tech Stack" value={tech} onChange={setTech} placeholder="e.g. React, Node.js, Stripe" />
          <MInput label="Project Link" value={url} onChange={setUrl} placeholder="https://example.com" type="url" />
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-20 border border-[#ffffff]/[0.08] border-dashed rounded-xl cursor-pointer bg-[#ffffff]/[0.01] hover:bg-[#ffffff]/[0.03] transition-colors">
              <div className="flex flex-col items-center justify-center py-4">
                <Upload className="w-5 h-5 mb-1.5 text-[#525252]" strokeWidth={1.5} />
                <p className="text-xs text-[#525252]">Upload screenshot</p>
              </div>
              <input type="file" className="hidden" accept="image/*" />
            </label>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-[#737373] hover:text-[#e5e5e5] transition-colors cursor-pointer">Cancel</button>
            <button type="button" onClick={handleSave} disabled={!title.trim()} className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0a0a0a] bg-[#e5e5e5] hover:bg-[#cccccc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Add</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Shared Modal Components ─── */
function MInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 placeholder:text-[#333] focus:border-[#ffffff]/[0.2] transition-colors" placeholder={placeholder} />
    </div>
  )
}

function MTextarea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#737373] mb-1.5 ml-0.5">{label}</label>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl text-sm text-[#e5e5e5] outline-none bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.08] px-3.5 py-3 placeholder:text-[#333] resize-none focus:border-[#ffffff]/[0.2] transition-colors" placeholder={placeholder} />
    </div>
  )
}
