import { useEffect, useCallback, type ReactNode } from 'react'
import { XCircle } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

export default function Modal({ open, onClose, children, maxWidth = 'max-w-md' }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#000000]/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`bg-[#0a0a0a] border border-[#ffffff]/15 rounded-2xl w-full ${maxWidth} shadow-2xl flex flex-col relative overflow-hidden`}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-[#737373] hover:text-[#fafafa] transition-colors z-10 cursor-pointer"
        >
          <XCircle className="w-6 h-6" strokeWidth={1.5} />
        </button>
        {children}
      </div>
    </div>
  )
}
