import { FileText, Download } from 'lucide-react'
import type { Message } from '@/lib/api'

interface MessageAttachmentProps {
  msg: Message
}

export default function MessageAttachment({ msg }: MessageAttachmentProps) {
  if (!msg.fileUrl || msg.fileUrl === 'pending') return null

  const url = msg.fileUrl.startsWith('http') || msg.fileUrl.startsWith('blob:')
    ? msg.fileUrl
    : `${import.meta.env.VITE_API_URL || ''}${msg.fileUrl}`

  if (msg.fileType === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-2">
        <img src={url} alt={msg.fileName || 'Image'} className="max-w-[240px] max-h-[200px] rounded-lg object-cover" />
      </a>
    )
  }

  const isPdf = msg.fileType === 'pdf'
  const ext = msg.fileName?.split('.').pop()?.toUpperCase() || 'FILE'

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-lg p-3 mb-2 hover:bg-[#ffffff]/10 transition-colors group">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[#ffffff]/10 border border-[#ffffff]/10">
        <FileText className="w-5 h-5 text-[#a6a6a6]" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#fafafa] truncate">{msg.fileName || 'File'}</p>
        <p className="text-xs text-[#737373]">{isPdf ? 'PDF' : ext}</p>
      </div>
      <Download className="w-4 h-4 text-[#737373] group-hover:text-[#fafafa] transition-colors shrink-0" strokeWidth={1.5} />
    </a>
  )
}
