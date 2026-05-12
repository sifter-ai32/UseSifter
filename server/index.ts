import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import admin from 'firebase-admin'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from './db'
import { generateOtp, sendOtpEmail, getResend } from './email'
import { extractResumeData } from './resume'
import workspacesRouter, { registerWorkspaceSocketHandlers } from './workspaces'
import negotiatorRouter, { registerNegotiatorSocketHandlers } from './negotiator'
import aiChatRouter, { registerAiChatSocketHandlers } from './ai-chat'
import escrowRouter from './escrow'
import adminRouter from './admin'

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (serviceAccountPath) {
    // Use service account file if provided
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Use inline JSON from env variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  } else {
    // Fallback: projectId only (verifyIdToken may fail without credentials)
    console.warn('WARNING: No Firebase service account configured. Google sign-in will not work.')
    console.warn('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT env variable.')
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  }
}

const app = express()
const httpServer = createServer(app)

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://usesifter.vercel.app',
      /\.vercel\.app$/,
    ]

const io = new Server(httpServer, { cors: { origin: ALLOWED_ORIGINS } })
const PORT = process.env.PORT || 3001

const upload = multer({ dest: '/tmp/sifter-uploads/', limits: { fileSize: 10 * 1024 * 1024 } })

// Image uploads storage
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

// Chat attachment uploads (all file types, 10MB limit)
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

app.use(cors({ origin: ALLOWED_ORIGINS }))
app.use(express.json())
app.use('/uploads', express.static(uploadsDir))

// ──── Auth ────

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: 'No account found with this email. Please sign up first.' })
    return
  }
  if (!user.password && user.authProvider === 'google') {
    res.status(401).json({ error: 'This account uses Google sign-in. Please use the "Continue with Google" button to log in.' })
    return
  }
  if (!user.password) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  if (user.userType === 'admin') {
    res.status(403).json({ error: 'Admin accounts cannot log in here' })
    return
  }
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar, userType: user.userType, onboardingComplete: user.onboardingComplete, walletAddress: user.walletAddress || null })
})

app.post('/api/auth/signup/send-otp', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.authProvider === 'google') {
      res.status(400).json({ error: 'This email is already registered via Google. Please use the "Continue with Google" button to sign in.' })
    } else {
      res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' })
    }
    return
  }

  // Rate limit: max 3 pending signups per email in last 10 minutes
  const recentCount = await prisma.pendingSignup.count({
    where: { email, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  })
  if (recentCount >= 3) {
    res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' })
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const otpCode = generateOtp()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await prisma.pendingSignup.deleteMany({ where: { email } })
  await prisma.pendingSignup.create({
    data: { email, hashedPassword, otpCode, expiresAt },
  })

  try {
    await sendOtpEmail(email, otpCode)
  } catch (err) {
    console.error('Failed to send OTP email:', err)
    res.status(500).json({ error: 'Failed to send verification email' })
    return
  }

  res.json({ message: 'OTP sent', email })
})

app.post('/api/auth/signup/verify-otp', async (req, res) => {
  const { email, otp } = req.body

  const pending = await prisma.pendingSignup.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  })

  if (!pending) {
    res.status(400).json({ error: 'No pending signup found. Please start over.' })
    return
  }

  if (new Date() > pending.expiresAt) {
    await prisma.pendingSignup.deleteMany({ where: { email } })
    res.status(400).json({ error: 'Code has expired. Please request a new one.' })
    return
  }

  if (pending.attempts >= 5) {
    await prisma.pendingSignup.deleteMany({ where: { email } })
    res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' })
    return
  }

  if (pending.otpCode !== otp) {
    await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    })
    res.status(400).json({ error: 'Invalid code. Please try again.' })
    return
  }

  const user = await prisma.user.create({
    data: { email: pending.email, password: pending.hashedPassword },
  })

  await prisma.pendingSignup.deleteMany({ where: { email } })

  res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar, userType: user.userType, onboardingComplete: user.onboardingComplete, walletAddress: user.walletAddress || null })
})

app.post('/api/auth/signup/resend-otp', async (req, res) => {
  const { email } = req.body

  const pending = await prisma.pendingSignup.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  })

  if (!pending) {
    res.status(400).json({ error: 'No pending signup found.' })
    return
  }

  const secondsSinceLast = (Date.now() - pending.createdAt.getTime()) / 1000
  if (secondsSinceLast < 60) {
    res.status(429).json({ error: 'Please wait before requesting another code.' })
    return
  }

  const otpCode = generateOtp()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await prisma.pendingSignup.update({
    where: { id: pending.id },
    data: { otpCode, expiresAt, attempts: 0 },
  })

  try {
    await sendOtpEmail(email, otpCode)
  } catch (err) {
    console.error('Failed to resend OTP:', err)
    res.status(500).json({ error: 'Failed to send verification email' })
    return
  }

  res.json({ message: 'OTP resent' })
})

app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body
  if (!idToken) {
    res.status(400).json({ error: 'Missing idToken' })
    return
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken)
    const { uid, email, name, picture } = decoded

    if (!email) {
      res.status(400).json({ error: 'No email in Google account' })
      return
    }

    // Find existing user by firebaseUid or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ firebaseUid: uid }, { email }] },
    })

    if (user) {
      // Link firebaseUid if not already set
      if (!user.firebaseUid) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: uid, authProvider: 'google', avatar: user.avatar || picture || null },
        })
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: name || '',
          firebaseUid: uid,
          authProvider: 'google',
          avatar: picture || null,
        },
      })
    }

    res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar, userType: user.userType, onboardingComplete: user.onboardingComplete, walletAddress: user.walletAddress || null })
  } catch (err: any) {
    console.error('Google auth error:', err)
    const message = err?.code === 'auth/id-token-expired'
      ? 'Session expired. Please try again.'
      : err?.message?.includes('credential')
        ? 'Google sign-in is not configured on the server. Please contact the administrator.'
        : 'Google sign-in failed. Please try again.'
    res.status(401).json({ error: message })
  }
})

// ──── Forgot Password ────

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) {
    res.status(400).json({ error: 'Email is required' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Don't reveal whether email exists — always return success
    res.json({ message: 'If an account exists, a reset code has been sent.' })
    return
  }
  if (user.authProvider === 'google') {
    res.status(400).json({ error: 'This account uses Google sign-in. Passwords cannot be reset for Google accounts.' })
    return
  }

  // Rate limit
  const recentCount = await prisma.pendingSignup.count({
    where: { email, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  })
  if (recentCount >= 3) {
    res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' })
    return
  }

  const otpCode = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.pendingSignup.deleteMany({ where: { email } })
  await prisma.pendingSignup.create({
    data: { email, hashedPassword: '', otpCode, expiresAt },
  })

  try {
    await getResend().emails.send({
      from: 'Sifter <noreply@usesifter.com>',
      to: email,
      subject: 'Reset your Sifter password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111;">Reset your password</h2>
          <p style="margin: 0 0 24px; font-size: 14px; color: #666;">Enter this code to reset your Sifter password:</p>
          <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111;">${otpCode}</span>
          </div>
          <p style="margin: 0; font-size: 13px; color: #999;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Failed to send reset email:', err)
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' })
    return
  }

  res.json({ message: 'If an account exists, a reset code has been sent.' })
})

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body
  if (!email || !otp || !newPassword) {
    res.status(400).json({ error: 'All fields are required' })
    return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const pending = await prisma.pendingSignup.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  })

  if (!pending) {
    res.status(400).json({ error: 'No reset request found. Please start over.' })
    return
  }
  if (new Date() > pending.expiresAt) {
    await prisma.pendingSignup.deleteMany({ where: { email } })
    res.status(400).json({ error: 'Reset code has expired. Please request a new one.' })
    return
  }
  if (pending.otpCode !== otp) {
    res.status(400).json({ error: 'Incorrect code. Please try again.' })
    return
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { email }, data: { password: hashedPassword } })
  await prisma.pendingSignup.deleteMany({ where: { email } })

  res.json({ message: 'Password reset successfully. You can now sign in.' })
})

// ──── Change Password ────

app.post('/api/auth/change-password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body
  if (!userId || !currentPassword || !newPassword) {
    res.status(400).json({ error: 'All fields are required' })
    return
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.password) {
    res.status(400).json({ error: 'Account uses Google sign-in. Password cannot be changed.' })
    return
  }

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' })
    return
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  res.json({ message: 'Password updated successfully' })
})

// ──── Backup Email Verification ────

app.post('/api/auth/send-backup-otp', async (req, res) => {
  const { userId, backupEmail } = req.body
  if (!userId || !backupEmail) {
    res.status(400).json({ error: 'userId and backupEmail are required' })
    return
  }

  // Check it's not same as primary email
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (user.email.toLowerCase() === backupEmail.toLowerCase()) {
    res.status(400).json({ error: 'Backup email must be different from your primary email' })
    return
  }

  const otpCode = generateOtp()
  // Store OTP temporarily in PendingSignup (reusing the table)
  await prisma.pendingSignup.deleteMany({ where: { email: `backup:${userId}` } })
  await prisma.pendingSignup.create({
    data: {
      email: `backup:${userId}`,
      hashedPassword: backupEmail, // Store the backup email here temporarily
      otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  try {
    await sendOtpEmail(backupEmail, otpCode)
  } catch (err) {
    console.error('Failed to send backup email OTP:', err)
    res.status(500).json({ error: 'Failed to send verification email' })
    return
  }

  res.json({ message: 'Verification code sent to backup email' })
})

app.post('/api/auth/verify-backup-email', async (req, res) => {
  const { userId, otp } = req.body
  if (!userId || !otp) {
    res.status(400).json({ error: 'userId and otp are required' })
    return
  }

  const pending = await prisma.pendingSignup.findFirst({
    where: { email: `backup:${userId}` },
    orderBy: { createdAt: 'desc' },
  })

  if (!pending) {
    res.status(400).json({ error: 'No pending verification found. Please request a new code.' })
    return
  }

  if (new Date() > pending.expiresAt) {
    await prisma.pendingSignup.deleteMany({ where: { email: `backup:${userId}` } })
    res.status(400).json({ error: 'Code has expired. Please request a new one.' })
    return
  }

  if (pending.attempts >= 5) {
    await prisma.pendingSignup.deleteMany({ where: { email: `backup:${userId}` } })
    res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' })
    return
  }

  if (pending.otpCode !== otp) {
    await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    })
    res.status(400).json({ error: 'Invalid code. Please try again.' })
    return
  }

  // OTP verified — save the backup email
  const backupEmail = pending.hashedPassword // We stored the email here
  await prisma.user.update({
    where: { id: userId },
    data: { backupEmail },
  })
  await prisma.pendingSignup.deleteMany({ where: { email: `backup:${userId}` } })

  res.json({ message: 'Backup email verified and saved', backupEmail })
})

// ──── 2FA (TOTP) ────
import { Secret, TOTP } from 'otpauth'
import QRCode from 'qrcode'

app.post('/api/auth/2fa/setup', async (req, res) => {
  const { userId } = req.body
  if (!userId) { res.status(400).json({ error: 'userId is required' }); return }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  // Generate a new secret
  const secret = new Secret({ size: 20 })
  const totp = new TOTP({
    issuer: 'Sifter',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })

  // Store secret temporarily (not enabled yet until verified)
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret.base32, twoFactorEnabled: false },
  })

  const uri = totp.toString()
  const qrDataUrl = await QRCode.toDataURL(uri)

  res.json({ secret: secret.base32, qrDataUrl, uri })
})

app.post('/api/auth/2fa/verify', async (req, res) => {
  const { userId, token } = req.body
  if (!userId || !token) { res.status(400).json({ error: 'userId and token are required' }); return }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.twoFactorSecret) { res.status(400).json({ error: '2FA setup not initiated' }); return }

  const totp = new TOTP({
    issuer: 'Sifter',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(user.twoFactorSecret),
  })

  const delta = totp.validate({ token, window: 1 })
  if (delta === null) {
    res.status(400).json({ error: 'Invalid code. Please try again.' })
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  })

  res.json({ message: '2FA enabled successfully' })
})

app.post('/api/auth/2fa/disable', async (req, res) => {
  const { userId, token } = req.body
  if (!userId || !token) { res.status(400).json({ error: 'userId and token are required' }); return }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
    res.status(400).json({ error: '2FA is not enabled' })
    return
  }

  const totp = new TOTP({
    issuer: 'Sifter',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(user.twoFactorSecret),
  })

  const delta = totp.validate({ token, window: 1 })
  if (delta === null) {
    res.status(400).json({ error: 'Invalid code. Please try again.' })
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: null, twoFactorEnabled: false },
  })

  res.json({ message: '2FA disabled successfully' })
})

// ──── Freelancer Onboarding ────

app.post('/api/freelancer/onboarding', async (req, res) => {
  const { userId, fullName, title, experience, country, headline, categories, skills, socialLinks, workHistory, bio, portfolio, languages, education, ratePref, rate, minBudget, availability, longTerm, walletAddress } = req.body

  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: fullName || undefined,
      title: title || undefined,
      experience: experience ? parseInt(experience) : undefined,
      location: country || undefined,
      headline: headline || undefined,
      categories: categories || [],
      skills: skills || [],
      socialLinks: socialLinks || undefined,
      workHistory: workHistory || undefined,
      bio: bio || undefined,
      portfolio: portfolio || undefined,
      languages: languages || undefined,
      education: education || undefined,
      ratePref: ratePref || undefined,
      hourlyRate: rate ? parseFloat(rate) : undefined,
      minBudget: minBudget ? parseFloat(minBudget) : undefined,
      availability: availability ? parseInt(availability) : undefined,
      longTerm: longTerm ?? true,
      walletAddress: walletAddress ? walletAddress.toLowerCase() : undefined,
      onboardingComplete: true,
    },
  })

  res.json({ id: user.id, email: user.email, name: user.name, userType: user.userType, onboardingComplete: user.onboardingComplete, walletAddress: user.walletAddress || null })
})

// ──── Resume Extraction ────

app.post('/api/resume/extract', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  if (req.file.mimetype !== 'application/pdf') {
    fs.unlink(req.file.path, () => {})
    res.status(400).json({ error: 'Only PDF files are supported' })
    return
  }

  try {
    const data = await extractResumeData(req.file.path, req.file.originalname)
    res.json(data)
  } catch (err) {
    console.error('Resume extraction error:', err)
    res.status(500).json({ error: 'Failed to extract resume data' })
  } finally {
    // Clean up temp file
    fs.unlink(req.file!.path, () => {})
  }
})

// ──── Users ────

app.get('/api/users', async (req, res) => {
  const { userType } = req.query
  const where: Record<string, unknown> = {}
  if (userType) where.userType = userType
  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, userType: true, avatar: true, banner: true, bio: true, location: true, skills: true, hourlyRate: true, walletAddress: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(users)
})

app.get('/api/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, email: true, name: true, userType: true, avatar: true, banner: true, bio: true,
      headline: true, title: true, location: true, experience: true,
      skills: true, categories: true, socialLinks: true, workHistory: true,
      portfolio: true, languages: true, education: true,
      hourlyRate: true, minBudget: true, ratePref: true,
      availability: true, longTerm: true, walletAddress: true,
      phone: true, phoneCode: true, backupEmail: true, backupEmailVerified: true, timezone: true, twoFactorEnabled: true,
    },
  })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json(user)
})

app.patch('/api/users/:id', async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
    select: {
      id: true, email: true, name: true, userType: true, avatar: true, banner: true, bio: true,
      headline: true, title: true, location: true, experience: true,
      skills: true, categories: true, socialLinks: true, workHistory: true,
      portfolio: true, languages: true, education: true,
      hourlyRate: true, minBudget: true, ratePref: true,
      availability: true, longTerm: true, walletAddress: true,
      phone: true, phoneCode: true, backupEmail: true, backupEmailVerified: true, timezone: true, twoFactorEnabled: true,
    },
  })
  res.json(user)
})

// ──── Projects ────

app.get('/api/projects', async (req, res) => {
  const { ownerId, status, memberId } = req.query
  const where: Record<string, unknown> = {}
  if (ownerId) where.ownerId = ownerId
  if (status) where.status = status
  if (memberId) where.members = { some: { userId: memberId } }

  const projects = await prisma.project.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true } }, members: { include: { user: { select: { id: true, name: true, avatar: true } } } }, phases: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(projects)
})

app.post('/api/projects', async (req, res) => {
  const { title, description, budget, dueDate, ownerId, phases } = req.body
  const project = await prisma.project.create({
    data: {
      title,
      description,
      budget,
      dueDate: dueDate ? new Date(dueDate) : null,
      ownerId,
      phases: phases ? { create: phases } : undefined,
    },
    include: { phases: true },
  })
  res.json(project)
})

app.get('/api/projects/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      phases: { orderBy: { order: 'asc' } },
      proposals: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }
  res.json(project)
})

app.patch('/api/projects/:id', async (req, res) => {
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json(project)
})

// ──── Deal Rooms ────

app.get('/api/dealrooms', async (req, res) => {
  const { userId } = req.query
  let where: Record<string, unknown> = {}
  if (userId) {
    where = {
      OR: [
        { project: { OR: [{ ownerId: userId }, { members: { some: { userId: userId as string } } }] } },
        { clientId: userId },
        { freelancerId: userId },
      ],
    }
  }
  const rooms = await prisma.dealRoom.findMany({
    where,
    include: {
      project: { select: { id: true, title: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true } } } },
    },
  })

  // For direct rooms, attach the other user's info
  const enriched = await Promise.all(
    rooms.map(async (room) => {
      if (room.clientId || room.freelancerId) {
        const otherId = room.clientId === userId ? room.freelancerId : room.clientId
        const otherUser = otherId ? await prisma.user.findUnique({ where: { id: otherId }, select: { id: true, name: true, avatar: true } }) : null
        return { ...room, otherUser }
      }
      return { ...room, otherUser: null }
    }),
  )
  res.json(enriched)
})

app.get('/api/dealrooms/:id/messages', async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { dealRoomId: req.params.id },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(messages)
})

app.post('/api/dealrooms/:id/messages', async (req, res) => {
  const { content, senderId, fileUrl, fileType, fileName } = req.body
  const message = await prisma.message.create({
    data: { content, senderId, dealRoomId: req.params.id, fileUrl: fileUrl || null, fileType: fileType || null, fileName: fileName || null },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })
  io.to(req.params.id).emit('new-message', message)
  res.json(message)
})

// Chat attachment upload
app.post('/api/dealrooms/:id/upload', chatUpload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  const mime = req.file.mimetype
  const fileType = mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'file'
  res.json({ url, fileType, fileName: req.file.originalname })
})

// ──── Deal Room Creation ────

app.post('/api/dealrooms', async (req, res) => {
  const { projectId } = req.body
  const existing = await prisma.dealRoom.findUnique({ where: { projectId } })
  if (existing) {
    res.json(existing)
    return
  }
  const room = await prisma.dealRoom.create({
    data: { projectId },
    include: { project: { select: { id: true, title: true } }, messages: true },
  })
  res.json(room)
})

app.post('/api/dealrooms/direct', async (req, res) => {
  const { clientId, freelancerId } = req.body
  if (!clientId || !freelancerId) {
    res.status(400).json({ error: 'clientId and freelancerId are required' })
    return
  }
  const existing = await prisma.dealRoom.findUnique({
    where: { clientId_freelancerId: { clientId, freelancerId } },
  })
  if (existing) {
    res.json(existing)
    return
  }
  const room = await prisma.dealRoom.create({
    data: { clientId, freelancerId },
  })
  res.json(room)
})

// ──── Proposals ────

app.get('/api/proposals', async (req, res) => {
  const { userId, projectId } = req.query
  const where: Record<string, unknown> = {}
  if (userId) where.userId = userId
  if (projectId) where.projectId = projectId
  const proposals = await prisma.proposal.findMany({
    where,
    include: {
      project: { select: { id: true, title: true, budget: true, status: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(proposals)
})

app.post('/api/proposals', async (req, res) => {
  const { projectId, userId, coverLetter, bidAmount } = req.body
  const proposal = await prisma.proposal.create({
    data: { projectId, userId, coverLetter, bidAmount },
  })
  res.json(proposal)
})

// ──── Client Dashboard ────

app.get('/api/dashboard/client/:userId', async (req, res) => {
  const { userId } = req.params

  const escrows = await prisma.escrow.findMany({
    where: { clientId: userId },
    include: {
      client: { select: { id: true, name: true, walletAddress: true } },
      freelancer: { select: { id: true, name: true, avatar: true, walletAddress: true, title: true } },
      phases: { orderBy: { phaseIndex: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Amounts are stored as human-readable (e.g. "100" = $100), not raw blockchain units
  const escrowBalance = escrows
    .filter(e => ['Funded', 'Active'].includes(e.status))
    .reduce((sum, e) => sum + Number(e.totalAmount), 0)

  // Build transaction list from escrow phases (paid to freelancer)
  const transactions: { purpose: string; amount: string; hash: string }[] = []

  escrows.forEach(e => {
    e.phases
      .filter(p => ['Approved', 'AutoReleased'].includes(p.status))
      .forEach(p => {
        const amt = Number(p.amount)
        const phaseName = p.description || `Phase ${p.phaseIndex + 1}`
        transactions.push({
          purpose: `${phaseName} — Paid to @${e.freelancer.name?.split(' ')[0]?.toLowerCase() || 'freelancer'}`,
          amount: `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          hash: p.txHash || '',
        })
      })

    if (e.txHashFund) {
      transactions.push({
        purpose: 'Deposited to escrow',
        amount: `$${Number(e.totalDeposit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        hash: e.txHashFund,
      })
    }
  })

  // Freelancers working on client's escrows
  const freelancerMap = new Map<string, { id: string; name: string; avatar: string | null; title: string | null }>()
  escrows.forEach(e => {
    if (['Funded', 'Active'].includes(e.status) && e.freelancer) {
      freelancerMap.set(e.freelancer.id, {
        id: e.freelancer.id,
        name: e.freelancer.name,
        avatar: e.freelancer.avatar,
        title: e.freelancer.title ?? null,
      })
    }
  })
  const freelancers = Array.from(freelancerMap.values())

  // Only show escrow-backed projects (created & funded on-chain)
  const enrichedProjects = escrows.map(e => {
    const totalPhases = e.phases.length
    const completedPhases = e.phases.filter(ph => ['Approved', 'AutoReleased'].includes(ph.status)).length
    const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
    const escrowStatus = e.status
    const projectStatus = escrowStatus === 'Completed' ? 'Completed'
      : ['Funded', 'Active', 'Disputed'].includes(escrowStatus) ? 'Processing'
      : 'Beginning'

    return {
      id: e.id,
      name: e.projectTitle,
      status: projectStatus,
      budget: Number(e.totalAmount) || null,
      description: e.projectDescription,
      dueDate: null,
      createdAt: e.createdAt,
      memberCount: 2,
      phaseCount: totalPhases,
      completedPhases,
      progress,
      proposalCount: 0,
      negotiationCount: 0,
      escrowStatus,
      freelancerName: e.freelancer.name,
      members: [
        { id: e.freelancer.id, name: e.freelancer.name, avatar: e.freelancer.avatar },
      ],
      phases: e.phases.map(p => ({
        index: p.phaseIndex,
        description: p.description || `Phase ${p.phaseIndex + 1}`,
        status: p.status,
        amount: Number(p.amount),
        deadline: p.deadline.toISOString(),
      })),
    }
  })

  res.json({
    escrowBalance,
    transactions,
    freelancers,
    projects: enrichedProjects,
  })
})

// ──── Freelancer Dashboard ────

app.get('/api/dashboard/freelancer/:userId', async (req, res) => {
  const { userId } = req.params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { title: true, experience: true, avatar: true, name: true, onboardingComplete: true,
      skills: true, categories: true, bio: true, portfolio: true, socialLinks: true,
      workHistory: true, languages: true, education: true, hourlyRate: true,
    },
  })

  const [escrows, negotiations, dealRooms] = await Promise.all([
    prisma.escrow.findMany({
      where: { freelancerId: userId },
      include: {
        client: { select: { id: true, name: true, avatar: true } },
        phases: { orderBy: { phaseIndex: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.negotiation.findMany({
      where: { freelancerId: userId },
      include: {
        project: { select: { id: true, title: true, description: true, budget: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.dealRoom.findMany({
      where: { OR: [{ freelancerId: userId }, { project: { members: { some: { userId } } } }] },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true, avatar: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Collect all paid phases
  const paidPhases: { amount: number; date: Date; txHash: string | null; projectTitle: string; phaseId: string; description: string | null }[] = []
  escrows.forEach(e => {
    e.phases
      .filter(p => ['Approved', 'AutoReleased'].includes(p.status))
      .forEach(p => {
        const date = p.submittedAt || e.createdAt
        paidPhases.push({ amount: Number(p.amount), date, txHash: p.txHash, projectTitle: e.projectTitle, phaseId: p.id, description: p.description })
      })
  })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const totalEarnings = paidPhases.reduce((sum, p) => sum + p.amount, 0)
  const monthEarnings = paidPhases.filter(p => p.date >= thisMonthStart).reduce((s, p) => s + p.amount, 0)
  const lastMonthEarnings = paidPhases.filter(p => p.date >= lastMonthStart && p.date < thisMonthStart).reduce((s, p) => s + p.amount, 0)

  // Pending clearance: submitted phases awaiting client approval
  const pendingClearance = escrows.reduce((sum, e) => {
    return sum + e.phases.filter(p => p.status === 'Submitted').reduce((s, p) => s + Number(p.amount), 0)
  }, 0)

  // Active project count
  const activeProjects = escrows.filter(e => ['Funded', 'Active'].includes(e.status))

  // Agenda items
  const agenda: { id: string; type: string; title: string; subtitle: string; escrowId: string; phaseIndex: number; priority: number }[] = []
  escrows.forEach(e => {
    if (['Completed', 'Cancelled'].includes(e.status)) return
    e.phases.forEach(p => {
      // Overdue: pending phase past deadline
      if (p.status === 'Pending' && p.deadline < now) {
        const daysOverdue = Math.ceil((now.getTime() - p.deadline.getTime()) / 86400000)
        agenda.push({ id: p.id, type: 'overdue', title: p.description || `Phase ${p.phaseIndex + 1} — ${e.projectTitle}`, subtitle: `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`, escrowId: e.id, phaseIndex: p.phaseIndex, priority: 0 })
      }
      // Due today
      else if (p.status === 'Pending' && p.deadline >= todayStart && p.deadline < todayEnd) {
        agenda.push({ id: p.id, type: 'due_today', title: p.description || `Phase ${p.phaseIndex + 1} — ${e.projectTitle}`, subtitle: 'Due today', escrowId: e.id, phaseIndex: p.phaseIndex, priority: 1 })
      }
      // Revision requested
      else if (p.status === 'Pending' && p.revisionCount > 0 && p.revisionNotes) {
        agenda.push({ id: p.id, type: 'revision', title: p.description || `Phase ${p.phaseIndex + 1} — ${e.projectTitle}`, subtitle: `Revision requested: ${p.revisionNotes.slice(0, 60)}`, escrowId: e.id, phaseIndex: p.phaseIndex, priority: 2 })
      }
    })
  })
  // Add unread negotiations
  negotiations.filter(n => ['outreach_sent', 'outreach_pending'].includes(n.status)).forEach(n => {
    agenda.push({ id: n.id, type: 'negotiation', title: n.project.title, subtitle: 'New project opportunity — respond to offer', escrowId: '', phaseIndex: 0, priority: 3 })
  })
  agenda.sort((a, b) => a.priority - b.priority)

  // Projects with progress
  const projects = activeProjects.map(e => {
    const totalPhases = e.phases.length
    const completedPhases = e.phases.filter(p => ['Approved', 'AutoReleased'].includes(p.status)).length
    const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
    const currentPhase = e.phases.find(p => ['Pending', 'Submitted'].includes(p.status))
    // Find nearest deadline
    const pendingPhases = e.phases.filter(p => p.status === 'Pending' && p.deadline)
    const nearestDeadline = pendingPhases.length > 0 ? pendingPhases.reduce((min, p) => p.deadline < min ? p.deadline : min, pendingPhases[0].deadline) : null

    return {
      id: e.id,
      title: e.projectTitle,
      description: e.projectDescription,
      clientName: e.client.name,
      clientAvatar: e.client.avatar,
      progress,
      currentPhaseName: currentPhase?.description || `Phase ${(currentPhase?.phaseIndex ?? 0) + 1}`,
      dueDate: nearestDeadline?.toISOString() ?? null,
      totalPhases,
      completedPhases,
      status: e.status,
      totalAmount: Number(e.totalAmount),
      createdAt: e.createdAt.toISOString(),
      phases: e.phases.map(p => ({
        index: p.phaseIndex,
        description: p.description || `Phase ${p.phaseIndex + 1}`,
        status: p.status,
        amount: Number(p.amount),
        deadline: p.deadline.toISOString(),
      })),
    }
  })

  // Recent messages from deal rooms
  const recentMessages = dealRooms
    .filter(dr => dr.messages.length > 0)
    .map(dr => {
      const msg = dr.messages[0]
      return {
        id: msg.id,
        dealRoomId: dr.id,
        senderName: msg.sender.name,
        senderAvatar: msg.sender.avatar,
        senderInitials: msg.sender.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        isMe: msg.sender.id === userId,
      }
    })
    .filter(m => !m.isMe)
    .slice(0, 4)

  // Proposals (negotiations)
  const proposals = negotiations.map(n => ({
    id: n.id,
    title: n.project.title,
    status: n.status === 'agreed' ? 'Accepted' : n.status === 'declined' ? 'Rejected' : ['outreach_sent', 'outreach_pending', 'interested', 'in_qa', 'negotiating'].includes(n.status) ? 'Pending' : n.status,
    amount: n.finalRate || n.currentOffer || n.project.budget,
    rateType: n.rateType,
  }))

  // Profile completeness
  const fields = [user?.name, user?.title, user?.bio, user?.avatar,
    (user?.skills || []).length > 0, (user?.categories || []).length > 0,
    user?.hourlyRate, user?.experience, user?.portfolio, user?.workHistory,
    user?.languages, user?.education, user?.socialLinks]
  const filled = fields.filter(Boolean).length
  const profileCompleteness = Math.round((filled / fields.length) * 100)

  // Transactions
  const transactions = paidPhases
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(p => ({ id: p.phaseId, date: p.date.toISOString(), project: p.projectTitle, amount: p.amount, txHash: p.txHash || '' }))

  res.json({
    totalEarnings,
    monthEarnings,
    pendingClearance,
    activeProjectCount: activeProjects.length,
    profileCompleteness,
    transactions,
    projects,
    agenda,
    recentMessages,
    proposals,
    userTitle: user?.title ?? null,
  })
})

// ──── File Upload ────

app.post('/api/upload', imageUpload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  res.json({ url })
})

// ──── Workspaces (Group Deal Rooms) ────

app.set('io', io)
app.use('/api/workspaces', workspacesRouter)
app.use('/api/negotiations', negotiatorRouter)
app.use('/api/ai-chat', aiChatRouter)
app.use('/api/escrows', escrowRouter)
app.use('/api/admin', adminRouter)

// ──── Health Check ────

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected' })
  } catch (e) {
    console.error('Health check DB error:', e)
    res.json({ status: 'degraded', database: 'disconnected' })
  }
})

// ──── Serve Frontend in Production ────

const rootDir = process.cwd()

// Serve admin dashboard at /admin (before main SPA catch-all)
const adminDistPath = path.join(rootDir, 'admin', 'dist')
console.log('Admin dist path:', adminDistPath, 'exists:', fs.existsSync(adminDistPath))
if (fs.existsSync(adminDistPath)) {
  app.use('/admin', express.static(adminDistPath))
  app.get('/admin/{*path}', (_req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'))
  })
}

// Serve main SPA (catch-all — must be after all /api routes)
const frontendDistPath = path.join(rootDir, 'dist')
console.log('Frontend dist path:', frontendDistPath, 'exists:', fs.existsSync(frontendDistPath))
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath))
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'))
  })
}

// ──── Socket.IO ────

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<string, Set<string>>()

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId as string
  if (!userId) {
    socket.disconnect()
    return
  }

  // Mark user online
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set())
  }
  onlineUsers.get(userId)!.add(socket.id)
  io.emit('user-online', { userId })

  // Send current online users list to the newly connected client
  const onlineIds = Array.from(onlineUsers.keys())
  socket.emit('online-users', onlineIds)

  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId)
    if (sockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) {
        onlineUsers.delete(userId)
        io.emit('user-offline', { userId })
      }
    }
  })

  socket.on('join-room', (dealRoomId: string) => {
    socket.join(dealRoomId)
  })

  socket.on('leave-room', (dealRoomId: string) => {
    socket.leave(dealRoomId)
  })

  socket.on('send-message', async (data: { dealRoomId: string; content: string; fileUrl?: string; fileType?: string; fileName?: string }) => {
    const message = await prisma.message.create({
      data: { content: data.content, senderId: userId, dealRoomId: data.dealRoomId, fileUrl: data.fileUrl || null, fileType: data.fileType || null, fileName: data.fileName || null },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    })
    io.to(data.dealRoomId).emit('new-message', message)
  })

  socket.on('typing-start', (dealRoomId: string) => {
    socket.to(dealRoomId).emit('typing-start', { userId })
  })

  socket.on('typing-stop', (dealRoomId: string) => {
    socket.to(dealRoomId).emit('typing-stop', { userId })
  })

  // Workspace (Group Deal Room) socket handlers
  registerWorkspaceSocketHandlers(io, socket, userId)

  // Negotiator bot socket handlers
  registerNegotiatorSocketHandlers(io, socket, userId)
    registerAiChatSocketHandlers(io, socket, userId)
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`)
})
