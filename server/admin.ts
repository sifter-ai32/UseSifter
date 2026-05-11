import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from './db'
import { addToFreelancerWorkHistory } from './escrow'

const router = Router()

const userSelect = { id: true, name: true, email: true, walletAddress: true }
const raisedBySelect = { id: true, name: true, email: true }

const disputeInclude = {
  escrow: {
    include: {
      client: { select: userSelect },
      freelancer: { select: userSelect },
      phases: true,
    },
  },
  raisedBy: { select: raisedBySelect },
}

// ──── Auth ────

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email: 'admin@greesh' } })
  if (!user || !user.password || email !== 'admin@greesh') {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  if (user.userType !== 'admin') {
    res.status(403).json({ error: 'Not an admin account' })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    userType: user.userType,
    avatar: user.avatar,
  })
})

router.post('/logout', async (_req, res) => {
  res.json({ success: true })
})

// ──── Disputes ────

router.get('/disputes', async (_req, res) => {
  const disputes = await prisma.escrowDispute.findMany({
    include: disputeInclude,
    orderBy: { createdAt: 'desc' },
  })
  res.json(disputes)
})

router.get('/disputes/:id', async (req, res) => {
  const dispute = await prisma.escrowDispute.findUnique({
    where: { id: req.params.id },
    include: disputeInclude,
  })
  if (!dispute) {
    res.status(404).json({ error: 'Dispute not found' })
    return
  }
  res.json(dispute)
})

router.put('/disputes/:id/resolve', async (req, res) => {
  const { freelancerShareBps, txHash } = req.body
  if (freelancerShareBps === undefined || freelancerShareBps === null) {
    res.status(400).json({ error: 'freelancerShareBps is required' })
    return
  }

  const dispute = await prisma.escrowDispute.findUnique({
    where: { id: req.params.id },
    include: { escrow: { include: { phases: true } } },
  })
  if (!dispute) {
    res.status(404).json({ error: 'Dispute not found' })
    return
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Update dispute
    const resolved = await tx.escrowDispute.update({
      where: { id: req.params.id },
      data: {
        status: 'resolved',
        freelancerShareBps,
        resolvedAt: new Date(),
      },
      include: disputeInclude,
    })

    // Update the corresponding phase status
    await tx.escrowPhase.updateMany({
      where: {
        escrowId: dispute.escrowId,
        phaseIndex: dispute.phaseIndex,
      },
      data: {
        status: 'Approved',
        txHash: txHash || undefined,
      },
    })

    // If 0% to freelancer, cancel all remaining phases and escrow
    // Otherwise, set escrow to Active (or Completed if last phase)
    if (freelancerShareBps === 0) {
      // Cancel remaining pending phases
      await tx.escrowPhase.updateMany({
        where: {
          escrowId: dispute.escrowId,
          status: 'Pending',
        },
        data: { status: 'Cancelled' },
      })
      await tx.escrow.update({
        where: { id: dispute.escrowId },
        data: { status: 'Cancelled' },
      })
    } else {
      // Check if this was the last phase
      const remainingPhases = await tx.escrowPhase.count({
        where: {
          escrowId: dispute.escrowId,
          status: { in: ['Pending', 'Submitted', 'Disputed'] },
          phaseIndex: { not: dispute.phaseIndex },
        },
      })
      const newStatus = remainingPhases > 0 ? 'Active' : 'Completed'
      await tx.escrow.update({
        where: { id: dispute.escrowId },
        data: { status: newStatus },
      })
      // Add to freelancer's work history if completed
      if (newStatus === 'Completed') {
        addToFreelancerWorkHistory(dispute.escrowId).catch(console.error)
      }
    }

    return resolved
  })

  res.json(updated)
})

// ──── Stats (full platform overview) ────

router.get('/stats', async (_req, res) => {
  const [
    openDisputes, resolvedDisputes, totalDisputes,
    totalUsers, totalClients, totalFreelancers,
    totalEscrows, activeEscrows, fundedEscrows, completedEscrows,
    totalProjects,
  ] = await Promise.all([
    prisma.escrowDispute.count({ where: { status: 'open' } }),
    prisma.escrowDispute.count({ where: { status: 'resolved' } }),
    prisma.escrowDispute.count(),
    prisma.user.count({ where: { userType: { not: 'admin' } } }),
    prisma.user.count({ where: { userType: 'client' } }),
    prisma.user.count({ where: { userType: 'talent' } }),
    prisma.escrow.count(),
    prisma.escrow.count({ where: { status: 'Active' } }),
    prisma.escrow.count({ where: { status: 'Funded' } }),
    prisma.escrow.count({ where: { status: 'Completed' } }),
    prisma.project.count(),
  ])

  // Total escrow value
  const escrows = await prisma.escrow.findMany({ select: { totalAmount: true } })
  const totalEscrowValue = escrows.reduce((sum, e) => sum + Number(e.totalAmount) / 1e6, 0)

  res.json({
    openCount: openDisputes, resolvedCount: resolvedDisputes, totalCount: totalDisputes,
    totalUsers, totalClients, totalFreelancers,
    totalEscrows, activeEscrows, fundedEscrows, completedEscrows,
    totalProjects, totalEscrowValue,
  })
})

// ──── Escrows ────

router.get('/escrows', async (_req, res) => {
  const escrows = await prisma.escrow.findMany({
    include: {
      client: { select: userSelect },
      freelancer: { select: userSelect },
      phases: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(escrows)
})

// ──── Users ────

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { userType: { not: 'admin' } },
    select: {
      id: true, name: true, email: true, userType: true, avatar: true,
      walletAddress: true, onboardingComplete: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(users)
})

// ──── Recent Activity ────

router.get('/activity', async (_req, res) => {
  const [recentEscrows, recentDisputes, recentUsers] = await Promise.all([
    prisma.escrow.findMany({
      include: { client: { select: userSelect }, freelancer: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.escrowDispute.findMany({
      include: { escrow: { select: { projectTitle: true } }, raisedBy: { select: raisedBySelect } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.user.findMany({
      where: { userType: { not: 'admin' } },
      select: { id: true, name: true, email: true, userType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])
  res.json({ recentEscrows, recentDisputes, recentUsers })
})

export default router
