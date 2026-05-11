const BASE = '/api/admin'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function adminLogin(email: string, password: string) {
  return request<AdminUser>(`${BASE}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function adminLogout() {
  return request<{ success: boolean }>(`${BASE}/logout`, { method: 'POST' })
}

export function getDisputes() {
  return request<DisputeRecord[]>(`${BASE}/disputes`)
}

export function getDispute(id: string) {
  return request<DisputeRecord>(`${BASE}/disputes/${id}`)
}

export function resolveDispute(id: string, freelancerShareBps: number, txHash: string) {
  return request<DisputeRecord>(`${BASE}/disputes/${id}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ freelancerShareBps, txHash }),
  })
}

export function getAdminStats() {
  return request<AdminStats>(`${BASE}/stats`)
}

// ──── Types matching actual Prisma response ────

export interface AdminUser {
  id: string
  email: string
  name: string
  userType: string
  avatar: string | null
}

export interface AdminStats {
  openCount: number
  resolvedCount: number
  totalCount: number
}

export interface DisputeRecord {
  id: string
  escrowId: string
  phaseIndex: number
  raisedById: string
  reason: string | null
  status: string
  freelancerShareBps: number | null
  resolvedAt: string | null
  createdAt: string
  escrow: {
    id: string
    chainEscrowId: number
    clientId: string
    freelancerId: string
    projectTitle: string
    projectDescription: string | null
    tokenAddress: string
    totalAmount: string
    totalDeposit: string
    status: string
    txHashCreate: string | null
    txHashFund: string | null
    createdAt: string
    fundedAt: string | null
    client: { id: string; name: string; email: string; walletAddress: string | null }
    freelancer: { id: string; name: string; email: string; walletAddress: string | null }
    phases: PhaseRecord[]
  }
  raisedBy: { id: string; name: string; email: string }
}

export interface PhaseRecord {
  id: string
  escrowId: string
  phaseIndex: number
  description: string | null
  percentageBps: number
  amount: string
  deadline: string
  status: string
  revisionCount: number
  submittedAt: string | null
  workLink: string | null
  workLinks: Array<{ url: string; submittedAt: string }> | null
  revisionNotes: string | null
  txHash: string | null
}
