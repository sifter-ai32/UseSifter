// server/escrow.ts
// Express routes for blockchain escrow CRUD operations
// The blockchain is the source of truth — DB is a mirror for display/querying

import { Router } from 'express'
import prisma from './db'

const router = Router()

// ──── Helper: Add completed project to freelancer work history ────

export async function addToFreelancerWorkHistory(escrowId: string) {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      client: { select: { name: true } },
      freelancer: { select: { id: true, title: true, workHistory: true } },
      phases: { select: { description: true }, orderBy: { phaseIndex: 'asc' } },
    },
  })
  if (!escrow) return

  const existing = Array.isArray(escrow.freelancer.workHistory)
    ? (escrow.freelancer.workHistory as Array<Record<string, unknown>>)
    : []

  // Don't add duplicates (check by matching company + role + startDate)
  const startDate = escrow.createdAt.toISOString().slice(0, 7) // YYYY-MM
  const isDuplicate = existing.some(
    (w) => w.company === `${escrow.client.name} (via Sifter)` && w.startDate === startDate
  )
  if (isDuplicate) return

  const phaseDescriptions = escrow.phases
    .map((p) => p.description)
    .filter(Boolean)
    .join(', ')

  const entry = {
    role: escrow.freelancer.title || 'Freelancer',
    company: `${escrow.client.name} (via Sifter)`,
    startDate,
    endDate: new Date().toISOString().slice(0, 7),
    current: false,
    description: escrow.projectDescription
      || `${escrow.projectTitle}${phaseDescriptions ? ` — ${phaseDescriptions}` : ''}`,
  }

  await prisma.user.update({
    where: { id: escrow.freelancer.id },
    data: { workHistory: [...existing, entry] },
  })
}

// ──── Escrow CRUD ────

// GET / — List escrows for a user
router.get('/', async (req, res) => {
  const { userId, role, workspaceId } = req.query
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const where: Record<string, unknown> = role === 'client'
    ? { clientId: userId as string }
    : role === 'freelancer'
    ? { freelancerId: userId as string }
    : { OR: [{ clientId: userId as string }, { freelancerId: userId as string }] }

  if (workspaceId) where.workspaceId = workspaceId as string

  const escrows = await prisma.escrow.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, email: true, walletAddress: true, avatar: true } },
      freelancer: { select: { id: true, name: true, email: true, walletAddress: true, avatar: true } },
      phases: { orderBy: { phaseIndex: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Enrich with workspace name if linked
  const enriched = await Promise.all(escrows.map(async (e) => {
    if (e.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: e.workspaceId }, select: { name: true } })
      if (ws?.name) return { ...e, projectTitle: ws.name }
    }
    return e
  }))

  res.json(enriched)
})

// POST / — Create escrow record in DB (after blockchain tx confirms)
router.post('/', async (req, res) => {
  const {
    chainEscrowId, clientId, freelancerId, projectTitle, projectDescription,
    tokenAddress, totalAmount, totalDeposit, autoReleaseTimeout, txHashCreate,
    phases, workspaceId,
  } = req.body

  if (!chainEscrowId || typeof chainEscrowId !== 'string') {
    res.status(400).json({ error: 'chainEscrowId is required' })
    return
  }
  if (!clientId || !freelancerId || !tokenAddress || !totalAmount || !totalDeposit) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  try {
    const escrow = await prisma.escrow.create({
      data: {
        chainEscrowId: String(chainEscrowId),
        clientId,
        freelancerId,
        projectTitle: projectTitle || 'Untitled Project',
        projectDescription: projectDescription || null,
        tokenAddress,
        totalAmount: String(totalAmount),
        totalDeposit: String(totalDeposit),
        autoReleaseTimeout: Number(autoReleaseTimeout),
        txHashCreate: txHashCreate || null,
        workspaceId: workspaceId || null,
        phases: phases ? {
          create: phases.map((p: { phaseIndex: number; description?: string; percentageBps: number; amount: string; deadline: string; streamId?: string }) => ({
            phaseIndex: p.phaseIndex,
            description: p.description || null,
            percentageBps: p.percentageBps,
            amount: String(p.amount),
            deadline: new Date(p.deadline),
            streamId: p.streamId || null,
          })),
        } : undefined,
      },
      include: {
        phases: { orderBy: { phaseIndex: 'asc' } },
      },
    })
    res.status(201).json(escrow)
  } catch (err: any) {
    console.error('Create escrow error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ──── Static paths MUST come before /:id param routes ────

// GET /by-chain/:chainId — Get escrow by on-chain ID (Streamflow metadataId)
router.get('/by-chain/:chainId', async (req, res) => {
  const escrow = await prisma.escrow.findUnique({
    where: { chainEscrowId: req.params.chainId },
    include: {
      client: { select: { id: true, name: true, walletAddress: true } },
      freelancer: { select: { id: true, name: true, walletAddress: true } },
      phases: { orderBy: { phaseIndex: 'asc' } },
    },
  })
  if (!escrow) {
    res.status(404).json({ error: 'Escrow not found' })
    return
  }
  res.json(escrow)
})

// GET /disputes/all — List all disputes (for admin)
router.get('/disputes/all', async (req, res) => {
  const { status } = req.query
  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const disputes = await prisma.escrowDispute.findMany({
    where,
    include: {
      escrow: {
        include: {
          client: { select: { id: true, name: true, walletAddress: true } },
          freelancer: { select: { id: true, name: true, walletAddress: true } },
        },
      },
      raisedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(disputes)
})

// PATCH /disputes/:disputeId — Resolve a dispute (after blockchain tx confirms)
router.patch('/disputes/:disputeId', async (req, res) => {
  const { status, freelancerShareBps } = req.body

  try {
    const dispute = await prisma.escrowDispute.update({
      where: { id: req.params.disputeId },
      data: {
        status: status || 'resolved',
        freelancerShareBps: freelancerShareBps !== undefined ? Number(freelancerShareBps) : undefined,
        resolvedAt: new Date(),
      },
    })

    // Update escrow and phase status based on resolution
    if (status === 'resolved') {
      const escrow = await prisma.escrow.findUnique({
        where: { id: dispute.escrowId },
        include: { phases: { orderBy: { phaseIndex: 'asc' } } },
      })

      if (escrow) {
        const phaseStatus = freelancerShareBps === 10000 ? 'Approved' : 'Cancelled'
        await prisma.escrowPhase.update({
          where: {
            escrowId_phaseIndex: {
              escrowId: dispute.escrowId,
              phaseIndex: dispute.phaseIndex,
            },
          },
          data: { status: phaseStatus },
        })

        const isLastPhase = dispute.phaseIndex === escrow.phases.length - 1
        const newEscrowStatus = isLastPhase ? 'Completed' : 'Active'
        await prisma.escrow.update({
          where: { id: dispute.escrowId },
          data: { status: newEscrowStatus },
        })
        if (newEscrowStatus === 'Completed') {
          addToFreelancerWorkHistory(dispute.escrowId).catch(console.error)
        }
      }
    }

    res.json(dispute)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /users/search — Search users with wallet for escrow creation
router.get('/users/search', async (req, res) => {
  const { q, role } = req.query
  if (!q) {
    res.json([])
    return
  }

  const users = await prisma.user.findMany({
    where: {
      name: { contains: q as string, mode: 'insensitive' },
      ...(role ? { userType: role as string } : {}),
      walletAddress: { not: null },
    },
    select: { id: true, name: true, email: true, walletAddress: true, avatar: true },
    take: 10,
  })
  res.json(users)
})

// ──── Param routes (must come after static paths) ────

// GET /:id — Get escrow detail with phases and disputes
router.get('/:id', async (req, res) => {
  const escrow = await prisma.escrow.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { id: true, name: true, email: true, walletAddress: true, avatar: true } },
      freelancer: { select: { id: true, name: true, email: true, walletAddress: true, avatar: true } },
      phases: { orderBy: { phaseIndex: 'asc' } },
      disputes: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!escrow) {
    res.status(404).json({ error: 'Escrow not found' })
    return
  }
  res.json(escrow)
})

// PATCH /:id — Update escrow (status, txHashFund, fundedAt, etc.)
router.patch('/:id', async (req, res) => {
  const { status, txHashFund, fundedAt } = req.body
  const data: Record<string, unknown> = {}
  if (status) data.status = status
  if (txHashFund) data.txHashFund = txHashFund
  if (fundedAt) data.fundedAt = new Date(fundedAt)

  try {
    const escrow = await prisma.escrow.update({
      where: { id: req.params.id },
      data,
      include: {
        phases: { orderBy: { phaseIndex: 'asc' } },
      },
    })
    res.json(escrow)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ──── Phase Updates ────

// PATCH /:id/phases/:phaseIndex — Update a phase (after blockchain tx confirms)
router.patch('/:id/phases/:phaseIndex', async (req, res) => {
  const { status, workLink, revisionNotes, submittedAt, revisionCount, txHash } = req.body
  const data: Record<string, unknown> = {}
  if (status) data.status = status
  if (workLink !== undefined) data.workLink = workLink
  if (revisionNotes !== undefined) data.revisionNotes = revisionNotes
  if (submittedAt) data.submittedAt = new Date(submittedAt)
  if (revisionCount !== undefined) data.revisionCount = revisionCount
  if (txHash !== undefined) data.txHash = txHash

  try {
    // If a new workLink is submitted, append to workLinks history
    if (workLink) {
      const existing = await prisma.escrowPhase.findUnique({
        where: {
          escrowId_phaseIndex: {
            escrowId: req.params.id,
            phaseIndex: Number(req.params.phaseIndex),
          },
        },
        select: { workLinks: true },
      })
      const history = Array.isArray(existing?.workLinks) ? (existing.workLinks as Array<{url: string; submittedAt: string}>) : []
      history.push({ url: workLink, submittedAt: new Date().toISOString() })
      data.workLinks = history
    }

    const phase = await prisma.escrowPhase.update({
      where: {
        escrowId_phaseIndex: {
          escrowId: req.params.id,
          phaseIndex: Number(req.params.phaseIndex),
        },
      },
      data,
    })

    // If phase was approved, check if all phases are now done → mark escrow Completed
    if (status === 'Approved' || status === 'AutoReleased') {
      const remaining = await prisma.escrowPhase.count({
        where: {
          escrowId: req.params.id,
          status: { notIn: ['Approved', 'AutoReleased', 'Cancelled'] },
        },
      })
      if (remaining === 0) {
        await prisma.escrow.update({
          where: { id: req.params.id },
          data: { status: 'Completed' },
        })
        // Add to freelancer's work history
        addToFreelancerWorkHistory(req.params.id).catch(console.error)
      }
    }

    res.json(phase)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ──── Disputes (param routes) ────

// POST /:id/disputes — Create a dispute record
router.post('/:id/disputes', async (req, res) => {
  const { phaseIndex, raisedById, reason } = req.body
  if (phaseIndex === undefined || !raisedById) {
    res.status(400).json({ error: 'phaseIndex and raisedById are required' })
    return
  }

  try {
    await prisma.escrow.update({
      where: { id: req.params.id },
      data: { status: 'Disputed' },
    })

    await prisma.escrowPhase.update({
      where: {
        escrowId_phaseIndex: {
          escrowId: req.params.id,
          phaseIndex: Number(phaseIndex),
        },
      },
      data: { status: 'Disputed' },
    })

    const dispute = await prisma.escrowDispute.create({
      data: {
        escrowId: req.params.id,
        phaseIndex: Number(phaseIndex),
        raisedById,
        reason: reason || null,
      },
    })
    res.status(201).json(dispute)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
