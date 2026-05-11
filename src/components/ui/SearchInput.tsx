import { Search } from 'lucide-react'

interface SearchInputProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

export default function SearchInput({ placeholder = 'Search...', value, onChange }: SearchInputProps) {
  return (
    <div className="relative flex items-center w-full">
      <Search className="absolute left-3 text-[#737373] w-4 h-4" strokeWidth={1.5} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full bg-[#ffffff]/5 border border-[#ffffff]/10 text-[#fafafa] placeholder:text-[#737373] text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#737373] transition-colors font-light"
      />
    </div>
  )
}
