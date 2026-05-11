import { useState } from 'react'
import { Link2, Check, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  inviteUrl?: string | null
  isGenerating?: boolean
  onGenerate?: () => void
}

export default function ShareModal({ open, onClose, inviteUrl, isGenerating, onGenerate }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-8">
        <div className="w-12 h-12 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center mb-6">
          <Link2 className="w-6 h-6 text-[#fafafa]" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl tracking-tight text-[#fafafa] font-normal mb-2">Share Deal Room</h2>
        <p className="text-sm text-[#a6a6a6] leading-relaxed mb-6">Invite team members or freelancers to collaborate by sharing this unique link.</p>

        {isGenerating ? (
          <div className="flex items-center justify-center gap-2 py-4 mb-6">
            <Loader2 className="w-4 h-4 animate-spin text-[#a6a6a6]" strokeWidth={1.5} />
            <span className="text-sm text-[#a6a6a6]">Generating link...</span>
          </div>
        ) : inviteUrl ? (
          <div className="relative flex items-center w-full bg-[#ffffff]/5 border border-[#ffffff]/15 rounded-lg pr-2 transition-colors focus-within:border-[#737373] mb-6">
            <input type="text" value={inviteUrl} readOnly className="flex-1 bg-transparent border-none text-[#fafafa] text-sm px-4 py-3 focus:outline-none focus:ring-0 font-light w-full" />
            <button type="button" onClick={handleCopy} className="bg-[#ffffff]/10 hover:bg-[#ffffff]/20 text-[#fafafa] transition-colors rounded px-3 py-1.5 text-xs font-normal flex items-center gap-2 cursor-pointer">
              {copied ? <><Check className="w-3.5 h-3.5" strokeWidth={1.5} /> Copied</> : <><Link2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Copy</>}
            </button>
          </div>
        ) : (
          <button type="button" onClick={onGenerate} className="w-full border border-[#ffffff]/15 bg-[#ffffff]/5 text-[#fafafa] hover:bg-[#ffffff]/10 transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer mb-6">
            Generate Invite Link
          </button>
        )}

        <button type="button" onClick={onClose} className="w-full bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">
          Done
        </button>
      </div>
    </Modal>
  )
}
