export function ContactSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 bg-[#ffffff]/10 rounded w-24" />
        <div className="h-3 bg-[#ffffff]/[0.06] rounded w-36" />
      </div>
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <>
      <ContactSkeleton />
      <ContactSkeleton />
      <ContactSkeleton />
    </>
  )
}

export function ChatAreaSkeleton() {
  return (
    <div className="flex-1 flex flex-col p-6 gap-6 animate-pulse">
      <div className="flex items-center gap-4 pb-4 border-b border-[#ffffff]/10">
        <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 shrink-0" />
        <div className="h-4 bg-[#ffffff]/10 rounded w-28" />
      </div>
      <div className="flex gap-3 items-end">
        <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
        <div className="h-12 bg-[#ffffff]/[0.06] rounded-2xl rounded-tl-sm w-48" />
      </div>
      <div className="flex gap-3 items-end justify-end">
        <div className="h-10 bg-[#ffffff]/[0.06] rounded-2xl rounded-tr-sm w-36" />
        <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
      </div>
      <div className="flex gap-3 items-end">
        <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
        <div className="h-16 bg-[#ffffff]/[0.06] rounded-2xl rounded-tl-sm w-56" />
      </div>
    </div>
  )
}
