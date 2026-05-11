import { Router } from 'express'
import crypto from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import type { Server, Socket } from 'socket.io'
import prisma from './db'

const router = Router()

// File upload config (same as chat uploads)
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const wsUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// ──── Send Deal Room Invitation (workspace created only when accepted) ────

router.post('/', async (req, res) => {
  const { name, creatorId, dealRoomId, inviteeId } = req.body
  if (!name || !creatorId || !dealRoomId || !inviteeId) {
    res.status(400).json({ error: 'name, creatorId, dealRoomId, and inviteeId are required' })
    return
  }

  // Only send an invitation message — no workspace created yet
  const invitationMessage = await prisma.message.create({
    data: {
      content: `invited you to join the deal room "${name}"`,
      senderId: creatorId,
      dealRoomId,
      messageType: 'workspace_invitation',
      metadata: {
        workspaceName: name,
        creatorId,
        inviteeId,
        dealRoomId,
        status: 'pending',
      },
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  const io = req.app.get('io') as Server
  io.to(dealRoomId).emit('new-message', invitationMessage)

  res.status(201).json({ invitationMessage })
})

// ──── List Workspaces ────

router.get('/', async (req, res) => {
  const { userId, archived } = req.query
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const workspaces = await prisma.workspace.findMany({
    where: {
      members: { some: { userId: userId as string } },
      archived: archived === 'true',
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
      _count: { select: { members: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const result = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    creatorId: w.creatorId,
    archived: w.archived,
    archivedAt: w.archivedAt,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    memberCount: w._count.members,
    lastMessage: w.messages[0] || null,
    members: w.members,
  }))

  res.json(result)
})

// ──── Invite Links (must be before /:id to avoid matching "join" as an id) ────

router.get('/join/:token', async (req, res) => {
  const link = await prisma.workspaceInviteLink.findUnique({
    where: { token: req.params.token },
    include: {
      workspace: {
        include: { _count: { select: { members: true } } },
      },
    },
  })

  if (!link || !link.active) {
    res.json({ valid: false })
    return
  }
  if (link.expiresAt && new Date() > link.expiresAt) {
    res.json({ valid: false, expired: true })
    return
  }
  if (link.maxUses && link.uses >= link.maxUses) {
    res.json({ valid: false, exhausted: true })
    return
  }

  res.json({
    valid: true,
    workspace: {
      id: link.workspace.id,
      name: link.workspace.name,
      description: link.workspace.description,
      memberCount: link.workspace._count.members,
    },
  })
})

router.post('/join/:token', async (req, res) => {
  const { userId } = req.body
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const link = await prisma.workspaceInviteLink.findUnique({
    where: { token: req.params.token },
  })

  if (!link || !link.active) {
    res.status(400).json({ error: 'Invalid invite link' })
    return
  }
  if (link.expiresAt && new Date() > link.expiresAt) {
    res.status(400).json({ error: 'Invite link has expired' })
    return
  }
  if (link.maxUses && link.uses >= link.maxUses) {
    res.status(400).json({ error: 'Invite link has been used up' })
    return
  }

  // Check if already a member
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: link.workspaceId, userId } },
  })

  if (existing) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: link.workspaceId },
      include: { members: { include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } } } },
    })
    res.json({ workspace, member: existing, alreadyMember: true })
    return
  }

  const member = await prisma.workspaceMember.create({
    data: { workspaceId: link.workspaceId, userId, role: 'member' },
    include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } },
  })

  // Increment uses
  await prisma.workspaceInviteLink.update({
    where: { id: link.id },
    data: { uses: { increment: 1 } },
  })

  const io = req.app.get('io') as Server
  io.to(`workspace:${link.workspaceId}`).emit('workspace:member-joined', {
    workspaceId: link.workspaceId,
    member,
  })

  const workspace = await prisma.workspace.findUnique({
    where: { id: link.workspaceId },
    include: { members: { include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } } } },
  })

  res.json({ workspace, member })
})

// ──── Accept Invitation (creates workspace on accept) ────

router.post('/accept-invite', async (req, res) => {
  const { userId, messageId } = req.body

  if (!userId || !messageId) {
    res.status(400).json({ error: 'userId and messageId are required' })
    return
  }

  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message || message.messageType !== 'workspace_invitation') {
    res.status(400).json({ error: 'Invalid invitation' })
    return
  }

  const meta = message.metadata as {
    workspaceName?: string; creatorId?: string; inviteeId?: string;
    dealRoomId?: string; workspaceId?: string; status?: string
  } | null

  if (meta?.status !== 'pending') {
    res.status(400).json({ error: 'Invitation is not pending' })
    return
  }

  // If workspace already exists (e.g. duplicate click), just add the member
  let workspace
  if (meta.workspaceId) {
    workspace = await prisma.workspace.findUnique({
      where: { id: meta.workspaceId },
      include: { members: { include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } } } },
    })
  }

  if (!workspace) {
    // Create workspace now with both members
    workspace = await prisma.workspace.create({
      data: {
        name: meta.workspaceName || 'Deal Room',
        creatorId: meta.creatorId || message.senderId,
        sourceDealRoomId: meta.dealRoomId || message.dealRoomId,
        members: {
          create: [
            { userId: meta.creatorId || message.senderId, role: 'owner' },
            { userId, role: 'member' },
          ],
        },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } } },
      },
    })
  } else {
    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    })
    if (!existing) {
      await prisma.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: 'member' },
      })
      workspace = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: { members: { include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } } } },
      })
    }
  }

  // Update invitation with workspaceId and accepted status
  await prisma.message.update({
    where: { id: messageId },
    data: {
      metadata: { ...meta, workspaceId: workspace!.id, status: 'accepted' },
    },
  })

  const updatedMessage = await prisma.message.findUnique({
    where: { id: messageId },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  const io = req.app.get('io') as Server
  io.to(message.dealRoomId).emit('message-updated', updatedMessage)

  res.json({ workspace })
})

// ──── Get Workspace Details ────

router.get('/:id', async (req, res) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatar: true, walletAddress: true, userType: true } } },
        orderBy: { joinedAt: 'asc' },
      },
      _count: { select: { members: true } },
    },
  })
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }
  res.json({ ...workspace, memberCount: workspace._count.members })
})

// ──── Workspace Messages ────

router.get('/:id/messages', async (req, res) => {
  const messages = await prisma.workspaceMessage.findMany({
    where: { workspaceId: req.params.id },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(messages)
})

router.post('/:id/messages', async (req, res) => {
  const { content, senderId, fileUrl, fileType, fileName } = req.body
  const message = await prisma.workspaceMessage.create({
    data: {
      content,
      senderId,
      workspaceId: req.params.id,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  const io = req.app.get('io') as Server
  io.to(`workspace:${req.params.id}`).emit('workspace:new-message', message)

  res.status(201).json(message)
})

// ──── Workspace File Upload ────

router.post('/:id/upload', wsUpload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  const mime = req.file.mimetype
  const fileType = mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'file'
  res.json({ url, fileType, fileName: req.file.originalname })
})

// ──── Invite Links ────

router.post('/:id/invite-links', async (req, res) => {
  const { createdById, expiresInHours, maxUses } = req.body
  const { id: workspaceId } = req.params

  if (!createdById) {
    res.status(400).json({ error: 'createdById is required' })
    return
  }

  // Verify user is a member
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: createdById } },
  })
  if (!membership) {
    res.status(403).json({ error: 'You are not a member of this workspace' })
    return
  }

  const token = crypto.randomBytes(16).toString('hex')
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null

  const link = await prisma.workspaceInviteLink.create({
    data: {
      token,
      workspaceId,
      createdById,
      expiresAt,
      maxUses: maxUses || null,
    },
  })

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173'
  res.status(201).json({
    token: link.token,
    url: `${baseUrl}/join/${link.token}`,
    expiresAt: link.expiresAt,
  })
})

// ──── Archive / Unarchive ────

router.patch('/:id/archive', async (req, res) => {
  const { userId } = req.body
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.id } })
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }
  if (workspace.creatorId !== userId) {
    res.status(403).json({ error: 'Only the creator can archive this workspace' })
    return
  }

  const updated = await prisma.workspace.update({
    where: { id: req.params.id },
    data: { archived: true, archivedAt: new Date() },
  })
  res.json(updated)
})

router.patch('/:id/unarchive', async (req, res) => {
  const { userId } = req.body
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.id } })
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }
  if (workspace.creatorId !== userId) {
    res.status(403).json({ error: 'Only the creator can unarchive this workspace' })
    return
  }

  const updated = await prisma.workspace.update({
    where: { id: req.params.id },
    data: { archived: false, archivedAt: null },
  })
  res.json(updated)
})

export default router

// ──── Socket.IO Handlers ────

export function registerWorkspaceSocketHandlers(io: Server, socket: Socket, userId: string) {
  socket.on('workspace:join', (workspaceId: string) => {
    socket.join(`workspace:${workspaceId}`)
  })

  socket.on('workspace:leave', (workspaceId: string) => {
    socket.leave(`workspace:${workspaceId}`)
  })

  socket.on('workspace:send-message', async (data: {
    workspaceId: string
    content: string
    fileUrl?: string
    fileType?: string
    fileName?: string
  }) => {
    const message = await prisma.workspaceMessage.create({
      data: {
        content: data.content,
        senderId: userId,
        workspaceId: data.workspaceId,
        fileUrl: data.fileUrl || null,
        fileType: data.fileType || null,
        fileName: data.fileName || null,
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    })
    io.to(`workspace:${data.workspaceId}`).emit('workspace:new-message', message)
  })

  socket.on('workspace:request-wallet', async (data: {
    workspaceId: string
    freelancerId: string
    freelancerName: string
  }) => {
    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const message = await prisma.workspaceMessage.create({
      data: {
        content: `${sender?.name || 'Someone'} is requesting ${data.freelancerName} to connect a wallet for escrow creation.`,
        senderId: userId,
        workspaceId: data.workspaceId,
        messageType: 'wallet_request',
        metadata: {
          requestedById: userId,
          requestedByName: sender?.name || '',
          freelancerId: data.freelancerId,
          freelancerName: data.freelancerName,
          status: 'pending',
        },
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    })
    io.to(`workspace:${data.workspaceId}`).emit('workspace:new-message', message)
  })

  socket.on('workspace:wallet-connected', async (data: {
    workspaceId: string
    messageId: string
    walletAddress: string
  }) => {
    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: data.walletAddress.toLowerCase() },
    })

    await prisma.workspaceMessage.update({
      where: { id: data.messageId },
      data: {
        metadata: {
          status: 'connected',
          walletAddress: data.walletAddress.toLowerCase(),
        },
      },
    })

    io.to(`workspace:${data.workspaceId}`).emit('workspace:wallet-updated', {
      messageId: data.messageId,
      userId,
      walletAddress: data.walletAddress.toLowerCase(),
    })
  })

  socket.on('workspace:typing-start', (workspaceId: string) => {
    socket.to(`workspace:${workspaceId}`).emit('workspace:typing-start', { userId })
  })

  socket.on('workspace:typing-stop', (workspaceId: string) => {
    socket.to(`workspace:${workspaceId}`).emit('workspace:typing-stop', { userId })
  })
}
