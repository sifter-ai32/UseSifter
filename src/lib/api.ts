const API_URL = import.meta.env.VITE_API_URL || ''
const BASE = `${API_URL}/api`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ──── Auth ────

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar: string | null
  userType: string | null
  onboardingComplete: boolean
}

export function login(email: string, password: string) {
  return request<AuthUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function sendSignupOtp(email: string, password: string) {
  return request<{ message: string; email: string }>('/auth/signup/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function verifySignupOtp(email: string, otp: string) {
  return request<AuthUser>('/auth/signup/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  })
}

export function resendSignupOtp(email: string) {
  return request<{ message: string }>('/auth/signup/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function googleLogin(idToken: string) {
  return request<AuthUser>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
}

export function forgotPassword(email: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(email: string, otp: string, newPassword: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  })
}

// ──── Users ────

export interface SocialLink {
  platform: string
  url: string
}

export interface WorkHistoryItem {
  role: string
  company: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

export interface PortfolioItem {
  title: string
  month: string
  year: string
  description: string
  techStack: string
  link: string
}

export interface LanguageItem {
  name: string
  proficiency: string
}

export interface EducationItem {
  institution: string
  degree: string
  startYear: string
  endYear: string
}

export interface User {
  id: string
  email: string
  name: string
  userType: string | null
  avatar: string | null
  banner: string | null
  bio: string | null
  walletAddress: string | null
  headline: string | null
  title: string | null
  location: string | null
  experience: number | null
  skills: string[]
  categories: string[]
  socialLinks: SocialLink[] | null
  workHistory: WorkHistoryItem[] | null
  portfolio: PortfolioItem[] | null
  languages: LanguageItem[] | null
  education: EducationItem[] | null
  hourlyRate: number | null
  minBudget: number | null
  ratePref: string | null
  availability: number | null
  longTerm: boolean
}

export function getUser(id: string) {
  return request<User>(`/users/${id}`)
}

export function updateUser(id: string, data: Partial<User>) {
  return request<User>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function listFreelancers() {
  return request<User[]>('/users?userType=talent')
}

// ──── Password & Backup Email ────

export function changePassword(userId: string, currentPassword: string, newPassword: string) {
  return request<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ userId, currentPassword, newPassword }),
  })
}

export function sendBackupEmailOtp(userId: string, backupEmail: string) {
  return request<{ message: string }>('/auth/send-backup-otp', {
    method: 'POST',
    body: JSON.stringify({ userId, backupEmail }),
  })
}

export function verifyBackupEmail(userId: string, otp: string) {
  return request<{ message: string; backupEmail: string }>('/auth/verify-backup-email', {
    method: 'POST',
    body: JSON.stringify({ userId, otp }),
  })
}

export function setup2FA(userId: string) {
  return request<{ secret: string; qrDataUrl: string; uri: string }>('/auth/2fa/setup', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export function verify2FA(userId: string, token: string) {
  return request<{ message: string }>('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ userId, token }),
  })
}

export function disable2FA(userId: string, token: string) {
  return request<{ message: string }>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ userId, token }),
  })
}

export async function uploadFile(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Upload failed: ${res.status}`)
  }
  return res.json()
}

// ──── Freelancer Onboarding ────

export interface FreelancerProfileData {
  userId: string
  fullName: string
  title: string
  experience: string
  country: string
  headline: string
  categories: string[]
  skills: string[]
  socialLinks: { platform: string; url: string }[]
  workHistory: { role: string; company: string; startDate: string; endDate: string; current: boolean; description: string }[]
  bio: string
  portfolio: { title: string; month: string; year: string; description: string; techStack: string; link: string }[]
  languages: { name: string; proficiency: string }[]
  education: { institution: string; degree: string; startYear: string; endYear: string }[]
  ratePref: string
  rate: string
  minBudget: string
  availability: string
  longTerm: boolean
  walletAddress?: string
}

export function saveFreelancerProfile(data: FreelancerProfileData) {
  return request<AuthUser>('/freelancer/onboarding', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ──── Resume Extraction ────

export interface ResumeData {
  name: string | null
  professionalTitle: string | null
  experienceYears: number | null
  country: string | null
  headline: string | null
  categories: string[]
  skills: string[]
  links: { github: string | null; linkedin: string | null; portfolio: string | null; x: string | null }
  workExperience: { company: string; role: string; startDate: string; endDate: string; description: string }[] | null
  bio: string | null
  projects: { title: string; startMonthYear: string; endMonthYear: string; description: string; techStack: string[] }[] | null
  languages: { name: string; proficiency: string }[] | null
  education: { institution: string; degree: string; startYear: string; endYear: string }[] | null
}

export async function extractResume(file: File): Promise<ResumeData> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/resume/extract`, { method: 'POST', body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ──── Projects ────

export interface Phase {
  id: string
  name: string
  status: string
  order: number
}

export interface ProjectMember {
  id: string
  role: string
  user: { id: string; name: string; avatar?: string | null }
}

export interface Proposal {
  id: string
  coverLetter: string | null
  bidAmount: number | null
  status: string
  createdAt: string
  user: { id: string; name: string }
}

export interface Project {
  id: string
  title: string
  description: string | null
  budget: number | null
  status: string
  progress: number
  dueDate: string | null
  createdAt: string
  owner: { id: string; name: string; email: string }
  members: ProjectMember[]
  phases: Phase[]
  proposals?: Proposal[]
}

export function listProjects(params?: { ownerId?: string; status?: string; memberId?: string }) {
  const query = new URLSearchParams()
  if (params?.ownerId) query.set('ownerId', params.ownerId)
  if (params?.status) query.set('status', params.status)
  if (params?.memberId) query.set('memberId', params.memberId)
  const qs = query.toString()
  return request<Project[]>(`/projects${qs ? `?${qs}` : ''}`)
}

export function getProject(id: string) {
  return request<Project>(`/projects/${id}`)
}

export function createProject(data: {
  title: string
  description?: string
  budget?: number
  dueDate?: string
  ownerId: string
  phases?: { name: string; status?: string; order: number }[]
}) {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateProject(id: string, data: Partial<Project>) {
  return request<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ──── Deal Rooms ────

export interface DealRoom {
  id: string
  createdAt: string
  project?: { id: string; title: string } | null
  clientId?: string | null
  freelancerId?: string | null
  otherUser?: { id: string; name: string; avatar?: string | null } | null
  messages: Message[]
}

export interface Message {
  id: string
  content: string
  fileUrl?: string | null
  fileType?: string | null
  fileName?: string | null
  messageType?: string // 'text' | 'workspace_invitation'
  metadata?: {
    workspaceId?: string
    workspaceName?: string
    status?: string // 'pending' | 'accepted' | 'declined'
  } | null
  createdAt: string
  sender: { id: string; name: string; avatar?: string | null }
}

export function listDealRooms(userId?: string) {
  const qs = userId ? `?userId=${userId}` : ''
  return request<DealRoom[]>(`/dealrooms${qs}`)
}

export function getDealRoomMessages(dealRoomId: string) {
  return request<Message[]>(`/dealrooms/${dealRoomId}/messages`)
}

export function sendMessage(dealRoomId: string, content: string, senderId: string, attachment?: { fileUrl: string; fileType: string; fileName: string }) {
  return request<Message>(`/dealrooms/${dealRoomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, senderId, ...attachment }),
  })
}

export async function uploadChatFile(dealRoomId: string, file: File): Promise<{ url: string; fileType: string; fileName: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/dealrooms/${dealRoomId}/upload`, { method: 'POST', body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export function createDirectDealRoom(clientId: string, freelancerId: string) {
  return request<{ id: string }>('/dealrooms/direct', {
    method: 'POST',
    body: JSON.stringify({ clientId, freelancerId }),
  })
}

// ──── Proposals ────

export function createProposal(data: {
  projectId: string
  userId: string
  coverLetter?: string
  bidAmount?: number
}) {
  return request<Proposal>('/proposals', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ──── Workspaces (Group Deal Rooms) ────

export interface WorkspaceMemberInfo {
  id: string
  userId: string
  role: string
  joinedAt: string
  user: { id: string; name: string; avatar: string | null; walletAddress: string | null; userType: string | null }
}

export interface WorkspaceMessageInfo {
  id: string
  content: string
  fileUrl: string | null
  fileType: string | null
  fileName: string | null
  messageType?: string // 'text' | 'wallet_request'
  metadata?: Record<string, unknown> | null
  createdAt: string
  sender: { id: string; name: string; avatar: string | null }
}

export interface Workspace {
  id: string
  name: string
  description: string | null
  creatorId: string
  archived: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  memberCount: number
  lastMessage: { id: string; content: string; sender: { id: string; name: string }; createdAt: string } | null
  members: WorkspaceMemberInfo[]
}

export function createWorkspace(data: {
  name: string
  description?: string
  creatorId: string
  dealRoomId: string
  inviteeId: string
}) {
  return request<{ invitationMessage: Message }>('/workspaces', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function listWorkspaces(userId: string, archived = false) {
  return request<Workspace[]>(`/workspaces?userId=${userId}&archived=${archived}`)
}

export function archiveWorkspace(id: string, userId: string) {
  return request<Workspace>(`/workspaces/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ userId }),
  })
}

export function unarchiveWorkspace(id: string, userId: string) {
  return request<Workspace>(`/workspaces/${id}/unarchive`, {
    method: 'PATCH',
    body: JSON.stringify({ userId }),
  })
}

export function getWorkspace(id: string) {
  return request<Workspace>(`/workspaces/${id}`)
}

export function getWorkspaceMessages(workspaceId: string) {
  return request<WorkspaceMessageInfo[]>(`/workspaces/${workspaceId}/messages`)
}

export function sendWorkspaceMessage(
  workspaceId: string,
  content: string,
  senderId: string,
  attachment?: { fileUrl: string; fileType: string; fileName: string }
) {
  return request<WorkspaceMessageInfo>(`/workspaces/${workspaceId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, senderId, ...attachment }),
  })
}

export async function uploadWorkspaceFile(workspaceId: string, file: File): Promise<{ url: string; fileType: string; fileName: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/workspaces/${workspaceId}/upload`, { method: 'POST', body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export function acceptWorkspaceInvite(userId: string, messageId: string) {
  return request<{ workspace: Workspace }>('/workspaces/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ userId, messageId }),
  })
}

export function createInviteLink(workspaceId: string, createdById: string, expiresInHours?: number, maxUses?: number) {
  return request<{ token: string; url: string; expiresAt: string | null }>(`/workspaces/${workspaceId}/invite-links`, {
    method: 'POST',
    body: JSON.stringify({ createdById, expiresInHours, maxUses }),
  })
}

export function validateInviteLink(token: string) {
  return request<{
    valid: boolean
    workspace?: { id: string; name: string; description: string | null; memberCount: number }
    expired?: boolean
    exhausted?: boolean
  }>(`/workspaces/join/${token}`)
}

export function joinViaInviteLink(token: string, userId: string) {
  return request<{ workspace: Workspace; member: WorkspaceMemberInfo; alreadyMember?: boolean }>(`/workspaces/join/${token}`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

// ──── Negotiations (AI Negotiator Bot) ────

export interface NegotiationMessageInfo {
  id: string
  role: 'bot' | 'freelancer' | 'system'
  content: string
  toolCall: string | null
  toolData: Record<string, unknown> | null
  createdAt: string
}

export interface NegotiationInfo {
  id: string
  status: string
  currentRound: number
  currentOffer: number | null
  freelancerCounter: number | null
  finalRate: number | null
  rateType: string
  currency: string
  freelancerSentiment: string
  createdAt: string
  updatedAt: string
  project: { id: string; title: string; description: string | null; budget: number | null }
  lastMessage: NegotiationMessageInfo | null
}

export function listNegotiations(freelancerId: string) {
  return request<NegotiationInfo[]>(`/negotiations?freelancerId=${freelancerId}`)
}

export function getNegotiation(negotiationId: string) {
  return request<NegotiationInfo & { freelancer: { id: string; name: string; avatar: string | null } }>(`/negotiations/${negotiationId}`)
}

export function getNegotiationMessages(negotiationId: string) {
  return request<NegotiationMessageInfo[]>(`/negotiations/${negotiationId}/messages`)
}

export function sendNegotiationMessage(negotiationId: string, content: string) {
  return request<{
    text: string
    functionCalled: string | null
    functionArgs: Record<string, unknown> | null
    negotiation: NegotiationInfo
    botMessage: NegotiationMessageInfo
  }>(`/negotiations/${negotiationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function triggerNegotiations(projectId: string, freelancerIds: string[], budgetMin?: number, budgetMax?: number, projectData?: Record<string, unknown>) {
  return request<{ started: number; results: { freelancerId: string; status: string; negotiationId?: string; error?: string }[] }>('/negotiations/trigger', {
    method: 'POST',
    body: JSON.stringify({ projectId, freelancerIds, budgetMin, budgetMax, projectData }),
  })
}

export function acceptNegotiation(negotiationId: string) {
  return request<NegotiationInfo & { dealRoomId?: string }>(`/negotiations/${negotiationId}/accept`, {
    method: 'POST',
  })
}

// ──── AI Chat (Project Intake) ────

export interface MatchedFreelancerInfo {
  userId: string
  name: string
  title: string | null
  avatar: string | null
  skills: string[]
  hourlyRate: number | null
  experience: number | null
  score: number
  rationale: string
}

export interface AiChatSessionInfo {
  id: string
  status: 'collecting' | 'matching' | 'completed'
  projectId: string | null
  collectedFields: {
    scope: boolean
    skills: boolean
    budget: boolean
    timeline: boolean
    preferences: boolean
    confirmed: boolean
    matching_started: boolean
    matching_complete: boolean
  }
  matchedFreelancers: MatchedFreelancerInfo[] | null
  chatMessages?: { role: 'user' | 'assistant'; content: string }[]
}

export interface AiChatResponse {
  sessionId: string
  text: string
  toolsCalled: string[]
  session: AiChatSessionInfo
}

export function sendAiChatMessage(message: string, userId: string, sessionId?: string) {
  return request<AiChatResponse>('/ai-chat', {
    method: 'POST',
    body: JSON.stringify({ message, userId, sessionId }),
  })
}

export function getAiChatSession(sessionId: string) {
  return request<AiChatSessionInfo>(`/ai-chat/${sessionId}`)
}

export interface AiChatSessionListItem {
  id: string
  status: 'collecting' | 'matching' | 'completed'
  projectId: string | null
  title: string | null
  collectedFields: AiChatSessionInfo['collectedFields']
  matchedFreelancers: MatchedFreelancerInfo[] | null
  createdAt: string
  updatedAt: string
  project: { id: string; title: string; description: string | null } | null
}

export function listAiChatSessions(userId: string) {
  return request<AiChatSessionListItem[]>(`/ai-chat/sessions?userId=${userId}`)
}

// ──── Client Dashboard ────

export interface ClientDashboardProject {
  id: string; name: string; status: string; budget: number | null
  description: string | null; dueDate: string | null; createdAt: string
  memberCount: number; phaseCount: number; completedPhases: number
  progress: number; proposalCount: number; negotiationCount: number
  escrowStatus: string | null
  freelancerName?: string
  members: { id: string; name: string; avatar: string | null }[]
  phases?: { index: number; description: string; status: string; amount: number; deadline: string }[]
}

export interface ClientDashboardData {
  escrowBalance: number
  transactions: { purpose: string; amount: string; hash: string }[]
  freelancers: { id: string; name: string; avatar: string | null; title: string | null }[]
  projects: ClientDashboardProject[]
}

export function getClientDashboard(userId: string) {
  return request<ClientDashboardData>(`/dashboard/client/${userId}`)
}

// ──── Freelancer Dashboard ────

export interface FreelancerDashboardTransaction {
  id: string
  date: string
  project: string
  amount: number
  txHash: string
}

export interface FreelancerProjectPhase {
  index: number
  description: string
  status: string
  amount: number
  deadline: string
}

export interface FreelancerDashboardProject {
  id: string
  title: string
  description: string | null
  clientName: string
  clientAvatar: string | null
  progress: number
  currentPhaseName: string
  dueDate: string | null
  totalPhases: number
  completedPhases: number
  status: string
  totalAmount: number
  createdAt: string
  phases: FreelancerProjectPhase[]
}

export interface FreelancerAgendaItem {
  id: string
  type: 'overdue' | 'due_today' | 'revision' | 'negotiation'
  title: string
  subtitle: string
  escrowId: string
  phaseIndex: number
  priority: number
}

export interface FreelancerRecentMessage {
  id: string
  dealRoomId: string
  senderName: string
  senderAvatar: string | null
  senderInitials: string
  content: string
  createdAt: string
  isMe: boolean
}

export interface FreelancerProposal {
  id: string
  title: string
  status: string
  amount: number | null
  rateType: string
}

export interface FreelancerDashboardData {
  totalEarnings: number
  monthEarnings: number
  pendingClearance: number
  activeProjectCount: number
  profileCompleteness: number
  transactions: FreelancerDashboardTransaction[]
  projects: FreelancerDashboardProject[]
  agenda: FreelancerAgendaItem[]
  recentMessages: FreelancerRecentMessage[]
  proposals: FreelancerProposal[]
  userTitle: string | null
}

export function getFreelancerDashboard(userId: string) {
  return request<FreelancerDashboardData>(`/dashboard/freelancer/${userId}`)
}

// ──── Blockchain Escrow ────

export interface EscrowPhaseInfo {
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
  streamId: string | null
}

export interface EscrowDisputeInfo {
  id: string
  escrowId: string
  phaseIndex: number
  raisedById: string
  reason: string | null
  status: string
  freelancerShareBps: number | null
  resolvedAt: string | null
  createdAt: string
  raisedBy?: { id: string; name: string }
  escrow?: EscrowInfo
}

export interface EscrowUserInfo {
  id: string
  name: string
  email?: string
  walletAddress: string | null
  avatar?: string | null
}

export interface EscrowInfo {
  id: string
  chainEscrowId: string
  clientId: string
  freelancerId: string
  projectTitle: string
  projectDescription: string | null
  tokenAddress: string
  totalAmount: string
  totalDeposit: string
  status: string
  autoReleaseTimeout: number
  txHashCreate: string | null
  txHashFund: string | null
  createdAt: string
  fundedAt: string | null
  client: EscrowUserInfo
  freelancer: EscrowUserInfo
  phases: EscrowPhaseInfo[]
  disputes?: EscrowDisputeInfo[]
}

export function listEscrows(userId: string, role?: 'client' | 'freelancer', workspaceId?: string) {
  const params = new URLSearchParams({ userId })
  if (role) params.set('role', role)
  if (workspaceId) params.set('workspaceId', workspaceId)
  return request<EscrowInfo[]>(`/escrows?${params}`)
}

export function getEscrow(escrowId: string) {
  return request<EscrowInfo>(`/escrows/${escrowId}`)
}

export function getEscrowByChainId(chainEscrowId: string) {
  return request<EscrowInfo>(`/escrows/by-chain/${chainEscrowId}`)
}

export function createEscrowRecord(data: {
  chainEscrowId: string
  clientId: string
  freelancerId: string
  projectTitle: string
  projectDescription?: string
  tokenAddress: string
  totalAmount: string
  totalDeposit: string
  autoReleaseTimeout: number
  txHashCreate?: string
  workspaceId?: string
  phases: {
    phaseIndex: number
    description?: string
    percentageBps: number
    amount: string
    deadline: string
    streamId?: string
  }[]
}) {
  return request<EscrowInfo>('/escrows', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateEscrow(escrowId: string, data: {
  status?: string
  txHashFund?: string
  fundedAt?: string
}) {
  return request<EscrowInfo>(`/escrows/${escrowId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function updateEscrowPhase(escrowId: string, phaseIndex: number, data: {
  status?: string
  workLink?: string
  revisionNotes?: string
  submittedAt?: string
  revisionCount?: number
  txHash?: string
}) {
  return request<EscrowPhaseInfo>(`/escrows/${escrowId}/phases/${phaseIndex}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function createEscrowDispute(escrowId: string, data: {
  phaseIndex: number
  raisedById: string
  reason?: string
}) {
  return request<EscrowDisputeInfo>(`/escrows/${escrowId}/disputes`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function listAllDisputes(status?: string) {
  const qs = status ? `?status=${status}` : ''
  return request<EscrowDisputeInfo[]>(`/escrows/disputes/all${qs}`)
}

export function resolveEscrowDispute(disputeId: string, data: {
  status: string
  freelancerShareBps: number
}) {
  return request<EscrowDisputeInfo>(`/escrows/disputes/${disputeId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function searchUsersForEscrow(query: string, role?: string) {
  const params = new URLSearchParams({ q: query })
  if (role) params.set('role', role)
  return request<EscrowUserInfo[]>(`/escrows/users/search?${params}`)
}
