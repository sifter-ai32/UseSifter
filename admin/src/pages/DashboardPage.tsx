import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, AlertTriangle, CheckCircle2, BarChart3,
  ChevronDown, ChevronRight, ArrowRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../App'
import { getDisputes, getAdminStats } from '../lib/api'
import type { DisputeRecord } from '../lib/api'
import { fromRawAmount, tokenLabel } from '../lib/contracts'

const POLL_INTERVAL = 5000 // 5 seconds

const card: React.CSSProperties = { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20 }
const btnSec: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#a6a6a6', cursor: 'pointer', transition: 'all 0.2s' }

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [openExpanded, setOpenExpanded] = useState(true)
  const [resolvedExpanded, setResolvedExpanded] = useState(false)

  const { data: stats = { openCount: 0, resolvedCount: 0, totalCount: 0 } } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
    refetchInterval: POLL_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const { data: disputes = [], isLoading: loading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: getDisputes,
    refetchInterval: POLL_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const openDisputes = disputes.filter(d => d.status === 'open')
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved')

  if (loading) {
    return (
      <div style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid rgba(250,250,250,0.2)', borderTopColor: '#fafafa', borderRadius: '50%' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fafafa' }} className="antialiased">
      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 24px' }} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/sifter-logo.png" alt="Sifter" style={{ width: 32, height: 32 }} />
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 200, color: '#fafafa' }}>Admin Dashboard</h1>
              <p style={{ fontSize: 12, fontWeight: 300, color: '#525252' }}>{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/rescue')} style={btnSec} className="flex items-center gap-1.5" onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fafafa'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#a6a6a6'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}>
              <AlertTriangle style={{ width: 14, height: 14 }} strokeWidth={1.5} />
              Rescue
            </button>
            <button onClick={() => { logout(); navigate('/admin/login', { replace: true }) }} style={btnSec} className="flex items-center gap-1.5" onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fafafa'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#a6a6a6'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}>
              <LogOut style={{ width: 14, height: 14 }} strokeWidth={1.5} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 40 }}>
          <StatCard icon={<AlertTriangle style={{ width: 16, height: 16, color: '#f59e0b' }} strokeWidth={1.5} />} label="Open Disputes" value={stats.openCount} accent="#f59e0b" />
          <StatCard icon={<CheckCircle2 style={{ width: 16, height: 16, color: '#10b981' }} strokeWidth={1.5} />} label="Resolved" value={stats.resolvedCount} accent="#10b981" />
          <StatCard icon={<BarChart3 style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />} label="Total Cases" value={stats.totalCount} accent="#a6a6a6" />
        </div>

        {/* Open */}
        <Section title="Open Disputes" count={openDisputes.length} expanded={openExpanded} onToggle={() => setOpenExpanded(!openExpanded)} accent="#f59e0b">
          {openDisputes.length === 0 ? (
            <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
              <CheckCircle2 style={{ width: 32, height: 32, color: '#525252', margin: '0 auto 12px' }} strokeWidth={1} />
              <p style={{ fontSize: 14, fontWeight: 300, color: '#525252' }}>No open disputes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openDisputes.map(d => <DisputeCard key={d.id} dispute={d} onClick={() => navigate(`/admin/disputes/${d.id}`)} />)}
            </div>
          )}
        </Section>

        {/* Resolved */}
        <Section title="Resolved Disputes" count={resolvedDisputes.length} expanded={resolvedExpanded} onToggle={() => setResolvedExpanded(!resolvedExpanded)} accent="#10b981">
          {resolvedDisputes.length === 0 ? (
            <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 300, color: '#525252' }}>No resolved disputes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resolvedDisputes.map(d => <DisputeCard key={d.id} dispute={d} onClick={() => navigate(`/admin/disputes/${d.id}`)} />)}
            </div>
          )}
        </Section>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div style={{ ...card, padding: 24 }}>
      <div className="flex items-center gap-2.5" style={{ marginBottom: 16 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 500, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <p style={{ fontSize: 30, fontWeight: 200, color: accent, letterSpacing: '-0.025em' }}>{value}</p>
    </div>
  )
}

function Section({ title, count, expanded, onToggle, accent, children }: {
  title: string; count: number; expanded: boolean; onToggle: () => void; accent: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <button onClick={onToggle} className="flex items-center gap-3 cursor-pointer" style={{ marginBottom: 20, background: 'none', border: 'none', color: 'inherit' }}>
        {expanded
          ? <ChevronDown style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
          : <ChevronRight style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
        }
        <h2 style={{ fontSize: 16, fontWeight: 200, color: '#fafafa' }}>{title}</h2>
        <span style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>
          {count}
        </span>
      </button>
      {expanded && children}
    </div>
  )
}

function DisputeCard({ dispute, onClick }: { dispute: DisputeRecord; onClick: () => void }) {
  const disputedPhase = dispute.escrow.phases.find(p => p.phaseIndex === dispute.phaseIndex)
  const amount = disputedPhase ? fromRawAmount(disputedPhase.amount) : 0
  const token = tokenLabel(dispute.escrow.tokenAddress)
  const isOpen = dispute.status === 'open'

  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
      style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '20px 24px', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = '#0f0f0f' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.background = '#0a0a0a' }}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', marginBottom: 4 }}>{dispute.escrow.projectTitle}</h3>
          <p style={{ fontSize: 12, fontWeight: 300, color: '#525252' }}>
            Phase {dispute.phaseIndex + 1}{disputedPhase?.description ? ` — ${disputedPhase.description}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span style={{ borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500, border: '1px solid', ...(isOpen ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.2)' } : { background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.2)' }) }}>
            {isOpen ? 'Open' : 'Resolved'}
          </span>
          <ArrowRight style={{ width: 16, height: 16, color: '#525252' }} strokeWidth={1.5} />
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />
      <div className="flex items-center gap-5" style={{ fontSize: 12, fontWeight: 300 }}>
        <span style={{ color: '#a6a6a6' }}>{dispute.escrow.client.name} <span style={{ color: '#525252' }}>vs</span> {dispute.escrow.freelancer.name}</span>
        <span style={{ color: '#fafafa', fontWeight: 500 }}>{amount.toFixed(2)} {token}</span>
        <span style={{ color: '#525252', marginLeft: 'auto' }}>{new Date(dispute.createdAt).toLocaleDateString()}</span>
      </div>
    </button>
  )
}
