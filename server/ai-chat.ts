// server/ai-chat.ts
// Client-side AI Chat — collects project requirements and matches freelancers
// Uses OpenAI Responses API (same pattern as negotiator.ts)

import { Router } from 'express'
import type { Server, Socket } from 'socket.io'
import OpenAI from 'openai'
import prisma from './db'

const router = Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

interface MatchedFreelancer {
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

interface ProgressFields {
  scope: boolean
  skills: boolean
  budget: boolean
  timeline: boolean
  preferences: boolean
  confirmed: boolean
  matching_started: boolean
  matching_complete: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Sifter's project intake assistant. Your job is to have a natural conversation with the client to understand their project needs, then save the requirements and find matching freelancers.

## What to Collect
1. **Project scope** — Title and description of what needs to be built
2. **Skills needed** — Specific technologies, tools, or expertise required
3. **Budget** — Range (min/max) and type (hourly rate vs fixed project price vs milestone)
4. **Timeline** — When it starts, when it's due (can be approximate)
5. **Experience level** — Junior, mid, senior, or any
6. **Deliverables** — What the client expects to receive
7. **Preferences** — Communication style, timezone, language, any other preferences

## How to Behave
- Be conversational and concise — 2-4 sentences per message
- Ask about one or two topics at a time, not everything at once
- If the client gives partial info, infer what you can and ask about what's missing
- Once you have enough info for ALL required fields, summarize the requirements back to the client and ask them to confirm
- After the client confirms, call save_project_requirements
- After saving, immediately call search_and_match_freelancers
- When presenting matches, give a brief summary of the top matches and ask if the client wants to proceed with outreach
- If the client says yes to outreach, call start_outreach with the freelancer user IDs from the matched results
- If the client wants to select specific freelancers, only include those in the outreach

## Important Rules
- Always call update_progress after collecting new information to track what you've gathered
- Do NOT fabricate requirements — only use what the client tells you
- If budget is unclear, suggest common ranges for context but don't assume
- Be professional and efficient — don't waste the client's time
- When the client's first message already contains a lot of info (e.g. "I need a React dev for $50-80/hr"), extract everything you can and only ask about what's still missing
`

// ────────────────────────────────────────────────────────────────────────────
// TOOLS
// ────────────────────────────────────────────────────────────────────────────

const tools: any[] = [
  {
    type: 'function',
    name: 'update_progress',
    description: 'Update the progress tracker to reflect what information has been collected so far. Call this after every exchange where new information is gathered.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'boolean', description: 'Whether project title and description have been collected' },
        skills: { type: 'boolean', description: 'Whether required skills/technologies have been identified' },
        budget: { type: 'boolean', description: 'Whether budget range and type are known' },
        timeline: { type: 'boolean', description: 'Whether timeline/deadline info is collected' },
        preferences: { type: 'boolean', description: 'Whether experience level and other preferences are known' },
        confirmed: { type: 'boolean', description: 'Whether all requirements have been confirmed by the client' },
      },
      required: ['scope', 'skills', 'budget', 'timeline', 'preferences', 'confirmed'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'save_project_requirements',
    description: 'Save the collected project requirements to the database. Call this ONLY after all fields are gathered and the client has confirmed.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        project_title: { type: 'string' },
        description: { type: 'string' },
        skills_required: { type: 'array', items: { type: 'string' } },
        deliverables: { type: 'array', items: { type: 'string' } },
        budget_min: { type: 'number' },
        budget_max: { type: 'number' },
        budget_type: { type: 'string', enum: ['hourly', 'fixed', 'milestone'] },
        timeline_start: { type: 'string' },
        timeline_deadline: { type: 'string' },
        experience_level: { type: 'string', enum: ['junior', 'mid', 'senior', 'any'] },
        preferences: { type: ['string', 'null'] },
      },
      required: ['project_title', 'description', 'skills_required', 'deliverables', 'budget_min', 'budget_max', 'budget_type', 'timeline_start', 'timeline_deadline', 'experience_level', 'preferences'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'search_and_match_freelancers',
    description: 'Search the platform for freelancers matching the project requirements and rank the top 5. Call this immediately after save_project_requirements.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        skills_required: { type: 'array', items: { type: 'string' } },
        budget_max: { type: 'number' },
        experience_level: { type: 'string', enum: ['junior', 'mid', 'senior', 'any'] },
      },
      required: ['skills_required', 'budget_max', 'experience_level'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'start_outreach',
    description: 'Start outreach/negotiations with selected freelancers. Call this when the client confirms they want to proceed with outreach to matched freelancers.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        freelancer_ids: { type: 'array', items: { type: 'string' }, description: 'Array of freelancer user IDs to reach out to' },
      },
      required: ['freelancer_ids'],
      additionalProperties: false,
    },
  },
]

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function extractText(item: any): string {
  return (item.content || [])
    .filter((c: any) => c.type === 'output_text')
    .map((c: any) => c.text)
    .join('')
}

// ────────────────────────────────────────────────────────────────────────────
// TOOL HANDLERS
// ────────────────────────────────────────────────────────────────────────────

async function handleToolCall(
  name: string,
  args: any,
  sessionId: string,
  userId: string,
  io?: Server
): Promise<string> {
  switch (name) {
    case 'update_progress': {
      const session = await prisma.aiChatSession.findUnique({ where: { id: sessionId } })
      const existing = (session?.collectedFields as any) || {}
      const updated = { ...existing, ...args }
      await prisma.aiChatSession.update({
        where: { id: sessionId },
        data: { collectedFields: updated },
      })
      if (io) {
        io.to(`ai-chat:${sessionId}`).emit('ai-chat:progress', { sessionId, progress: updated })
      }
      return JSON.stringify({ status: 'ok' })
    }

    case 'save_project_requirements': {
      // Safely parse date — AI may return "ASAP" or "2 weeks" instead of a real date
      let dueDate: Date | null = null
      if (args.timeline_deadline) {
        const parsed = new Date(args.timeline_deadline)
        if (!isNaN(parsed.getTime())) dueDate = parsed
      }

      const project = await prisma.project.create({
        data: {
          title: args.project_title,
          description: args.description,
          budget: args.budget_max,
          dueDate,
          ownerId: userId,
          requirements: args,
        },
      })

      await prisma.aiChatSession.update({
        where: { id: sessionId },
        data: { projectId: project.id },
      })

      if (io) {
        io.to(`ai-chat:${sessionId}`).emit('ai-chat:project-created', {
          sessionId,
          projectId: project.id,
        })
      }

      return JSON.stringify({ status: 'project_saved', projectId: project.id })
    }

    case 'search_and_match_freelancers': {
      const session = await prisma.aiChatSession.findUnique({ where: { id: sessionId } })
      if (!session?.projectId) {
        return JSON.stringify({ status: 'error', message: 'No project linked to session' })
      }

      // Update status to matching
      const currentFields = (session.collectedFields as any) || {}
      await prisma.aiChatSession.update({
        where: { id: sessionId },
        data: {
          status: 'matching',
          collectedFields: { ...currentFields, matching_started: true },
        },
      })
      if (io) {
        io.to(`ai-chat:${sessionId}`).emit('ai-chat:progress', {
          sessionId,
          progress: { ...currentFields, matching_started: true },
        })
      }

      // Phase 1: DB filter
      const candidates = await findCandidates(args.skills_required, args.budget_max, args.experience_level)

      // Phase 2: AI ranking
      const ranked = await rankCandidatesWithAI(candidates, args, session.projectId)

      // Store results and update title based on project context
      const matchProject = await prisma.project.findUnique({ where: { id: session.projectId }, select: { title: true, description: true } })
      let matchTitle: string | undefined
      try {
        const titleResp = await openai.responses.create({
          model: 'gpt-4.1-mini',
          input: [{ role: 'user', content: `Generate a very short title (3-5 words max) for a freelancer matching session. The project is: "${matchProject?.title || ''}". ${matchProject?.description ? `Description: "${matchProject.description.slice(0, 100)}"` : ''}. ${ranked.length} freelancers were matched. Return ONLY the title, no quotes or punctuation at the end.` }],
          store: false,
          temperature: 0.3,
        })
        matchTitle = extractText(titleResp.output[0]).trim()
      } catch { /* non-critical */ }

      await prisma.aiChatSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          matchedFreelancers: ranked as any,
          collectedFields: { ...currentFields, matching_started: true, matching_complete: true },
          ...(matchTitle ? { title: matchTitle } : {}),
        },
      })

      if (io) {
        io.to(`ai-chat:${sessionId}`).emit('ai-chat:matches-found', { sessionId, freelancers: ranked })
        io.to(`ai-chat:${sessionId}`).emit('ai-chat:progress', {
          sessionId,
          progress: { ...currentFields, matching_started: true, matching_complete: true },
        })
      }

      return JSON.stringify({
        status: 'matches_found',
        count: ranked.length,
        top_matches: ranked.map((f) => ({
          userId: f.userId,
          name: f.name,
          title: f.title,
          skills: f.skills.slice(0, 5),
          score: f.score,
          rationale: f.rationale,
        })),
        instruction: 'Present these matches to the client. For each, mention their name, title, key skills, and why they are a good fit. Ask if the client wants to proceed with outreach. When calling start_outreach, use the userId values from these matches.',
      })
    }

    case 'start_outreach': {
      const session = await prisma.aiChatSession.findUnique({ where: { id: sessionId } })
      if (!session?.projectId) {
        return JSON.stringify({ status: 'error', message: 'No project linked to session' })
      }

      const project = await prisma.project.findUnique({ where: { id: session.projectId } })
      if (!project) {
        return JSON.stringify({ status: 'error', message: 'Project not found' })
      }

      // Call the negotiations trigger endpoint internally
      const port = process.env.PORT || 3001
      const baseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`
      try {
        const triggerRes = await fetch(`${baseUrl}/api/negotiations/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: session.projectId,
            freelancerIds: args.freelancer_ids,
          }),
        })
        const triggerData = await triggerRes.json()

        // Emit outreach status to frontend
        if (io) {
          io.to(`ai-chat:${sessionId}`).emit('ai-chat:outreach-started', {
            sessionId,
            results: triggerData.results || [],
          })
        }

        const startedCount = triggerData.started || 0
        const alreadyExists = (triggerData.results || []).filter((r: any) => r.status === 'already_exists').length

        return JSON.stringify({
          status: 'success',
          started: startedCount,
          already_existed: alreadyExists,
          total: startedCount + alreadyExists,
          instruction: startedCount > 0
            ? `SUCCESS: Outreach has been sent to ${startedCount} freelancer(s). Tell the client that outreach is underway and freelancers will respond in the Opportunities section.`
            : alreadyExists > 0
            ? `Outreach was already sent to these freelancer(s) previously. Tell the client the outreach is already in progress.`
            : 'No freelancers were reached. Ask the client to try different selections.',
        })
      } catch (err: any) {
        return JSON.stringify({ status: 'error', message: err.message || 'Failed to trigger outreach' })
      }
    }

    default:
      return JSON.stringify({ status: 'unknown_tool' })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// MATCHING ENGINE
// ────────────────────────────────────────────────────────────────────────────

// Phase 1: Database filtering
async function findCandidates(
  skillsRequired: string[],
  budgetMax: number,
  experienceLevel: string
): Promise<any[]> {
  const allTalent = await prisma.user.findMany({
    where: {
      userType: 'talent',
      onboardingComplete: true,
    },
    select: {
      id: true, name: true, title: true, avatar: true, headline: true,
      skills: true, categories: true, hourlyRate: true, minBudget: true,
      experience: true, availability: true, location: true, bio: true,
      portfolio: true, languages: true,
    },
  })

  const skillsLower = skillsRequired.map(s => s.toLowerCase())

  const filtered = allTalent.filter(user => {
    // Skill overlap: at least 1 matching skill (substring match)
    const userSkillsLower = (user.skills || []).map((s: string) => s.toLowerCase())
    const overlap = skillsLower.filter(s =>
      userSkillsLower.some(us => us.includes(s) || s.includes(us))
    )
    if (overlap.length === 0) return false

    // Budget: freelancer's rate should be within reason (allow 30% above max for negotiation room)
    if (user.hourlyRate && user.hourlyRate > budgetMax * 1.3) return false

    // Experience level filter
    if (experienceLevel !== 'any' && user.experience) {
      if (experienceLevel === 'senior' && user.experience < 5) return false
      if (experienceLevel === 'mid' && user.experience < 2) return false
    }

    return true
  })

  // Cap at 20 candidates for AI ranking
  return filtered.slice(0, 20)
}

// Phase 2: AI ranking
async function rankCandidatesWithAI(
  candidates: any[],
  requirements: { skills_required: string[]; budget_max: number; experience_level: string },
  projectId: string
): Promise<MatchedFreelancer[]> {
  if (candidates.length === 0) return []

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  const reqs = (project?.requirements as any) || {}

  const candidateDescriptions = candidates.map((c, i) => (
    `${i + 1}. ${c.name} — ${c.title || 'Freelancer'} | Skills: ${(c.skills || []).join(', ')} | Rate: $${c.hourlyRate || 'N/A'}/hr | Experience: ${c.experience || 'N/A'} years | Location: ${c.location || 'N/A'} | Bio: ${(c.bio || '').slice(0, 200)}`
  )).join('\n')

  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [{
      role: 'user',
      content: `You are a freelancer matching engine. Given project requirements and candidate profiles, rank the top 5 best matches.

PROJECT REQUIREMENTS:
- Title: ${reqs.project_title || project?.title}
- Description: ${reqs.description || project?.description}
- Skills needed: ${(reqs.skills_required || []).join(', ')}
- Budget max: $${reqs.budget_max || project?.budget}
- Experience level: ${reqs.experience_level || 'any'}
- Deliverables: ${(reqs.deliverables || []).join(', ')}

CANDIDATES:
${candidateDescriptions}

Return a JSON array of the top 5 (or fewer if less available). Each object must have:
{ "index": <1-based candidate index>, "score": <0-100>, "rationale": "<1-2 sentences why they're a good fit>" }

Return ONLY the JSON array, no markdown fences or extra text.`,
    }],
    store: false,
    temperature: 0.3,
  })

  const text = extractText(response.output[0])
  let rankings: { index: number; score: number; rationale: string }[] = []
  try {
    rankings = JSON.parse(text)
  } catch {
    // Fallback: return first 5 with default scores
    rankings = candidates.slice(0, 5).map((_, i) => ({
      index: i + 1,
      score: 80 - i * 5,
      rationale: 'Skills match project requirements',
    }))
  }

  return rankings.slice(0, 5).map(r => {
    const candidate = candidates[r.index - 1]
    if (!candidate) return null
    return {
      userId: candidate.id,
      name: candidate.name,
      title: candidate.title,
      avatar: candidate.avatar,
      skills: candidate.skills || [],
      hourlyRate: candidate.hourlyRate,
      experience: candidate.experience,
      score: r.score,
      rationale: r.rationale,
    }
  }).filter(Boolean) as MatchedFreelancer[]
}

// ────────────────────────────────────────────────────────────────────────────
// CORE: Process client message
// ────────────────────────────────────────────────────────────────────────────

async function processClientMessage(
  sessionId: string,
  message: string,
  userId: string,
  io?: Server
): Promise<{ text: string; toolsCalled: string[] }> {
  const session = await prisma.aiChatSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Session not found')

  let nextInput: any[] = [{ role: 'user', content: message }]
  let previousId: string | undefined = session.openaiResponseId || undefined
  let latestResponseId = ''
  let text = ''
  const toolsCalled: string[] = []

  // Tool call loop — same pattern as negotiator.ts
  while (true) {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions: SYSTEM_PROMPT,
      input: nextInput,
      tools,
      previous_response_id: previousId,
      store: true,
      temperature: 0.7,
      truncation: 'auto',
    })

    latestResponseId = response.id
    previousId = response.id
    const functionOutputs: any[] = []

    for (const item of response.output) {
      if (item.type === 'message') text = extractText(item)
      if (item.type === 'function_call') {
        const fc = item as any
        const args = JSON.parse(fc.arguments)
        const result = await handleToolCall(fc.name, args, sessionId, userId, io)
        toolsCalled.push(fc.name)
        functionOutputs.push({
          type: 'function_call_output',
          call_id: fc.call_id,
          output: result,
        })
      }
    }

    if (functionOutputs.length > 0) {
      nextInput = functionOutputs
      continue
    }
    break
  }

  // Update session with latest response ID
  await prisma.aiChatSession.update({
    where: { id: sessionId },
    data: { openaiResponseId: latestResponseId },
  })

  return { text, toolsCalled }
}

// ────────────────────────────────────────────────────────────────────────────
// ROUTES
// ────────────────────────────────────────────────────────────────────────────

// POST / — Send message (creates session if no sessionId provided)
router.post('/', async (req, res) => {
  const { sessionId, message, userId } = req.body
  if (!userId || !message) {
    res.status(400).json({ error: 'userId and message are required' })
    return
  }

  try {
    let session: any

    if (sessionId) {
      session = await prisma.aiChatSession.findUnique({ where: { id: sessionId } })
      if (!session) {
        res.status(404).json({ error: 'Session not found' })
        return
      }
    } else {
      session = await prisma.aiChatSession.create({
        data: {
          userId,
          collectedFields: {
            scope: false, skills: false, budget: false,
            timeline: false, preferences: false, confirmed: false,
            matching_started: false, matching_complete: false,
          },
        },
      })
    }

    const io = req.app.get('io') as Server
    const isFirstMessage = !sessionId
    const result = await processClientMessage(session.id, message, userId, io)

    // Generate a title for new sessions based on the first message
    if (isFirstMessage) {
      try {
        const titleResponse = await openai.responses.create({
          model: 'gpt-4.1-mini',
          input: [{ role: 'user', content: `Generate a very short title (3-5 words max) for a chat that starts with this message: "${message}". Return ONLY the title, no quotes or punctuation at the end.` }],
          store: false,
          temperature: 0.3,
        })
        const title = extractText(titleResponse.output[0]).trim()
        if (title) {
          await prisma.aiChatSession.update({
            where: { id: session.id },
            data: { title },
          })
        }
      } catch {
        // Non-critical — fallback title will be used on frontend
      }
    }

    // Append user + assistant messages to chatMessages
    const existing = await prisma.aiChatSession.findUnique({
      where: { id: session.id },
      select: { chatMessages: true },
    })
    const msgs = (existing?.chatMessages as any[]) || []
    msgs.push({ role: 'user', content: message })
    if (result.text) msgs.push({ role: 'assistant', content: result.text })
    await prisma.aiChatSession.update({
      where: { id: session.id },
      data: { chatMessages: msgs },
    })

    const updated = await prisma.aiChatSession.findUnique({
      where: { id: session.id },
      select: {
        id: true, status: true, projectId: true,
        collectedFields: true, matchedFreelancers: true,
      },
    })

    res.json({
      sessionId: session.id,
      text: result.text,
      toolsCalled: result.toolsCalled,
      session: updated,
    })
  } catch (err: any) {
    console.error('AI chat error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /sessions — List all sessions for a user
router.get('/sessions', async (req, res) => {
  const userId = req.query.userId as string
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }
  const sessions = await prisma.aiChatSession.findMany({
    where: {
      userId,
      // Only show sessions that had at least one AI response
      openaiResponseId: { not: null },
    },
    select: {
      id: true, status: true, projectId: true, title: true,
      collectedFields: true, matchedFreelancers: true,
      createdAt: true, updatedAt: true,
      project: { select: { id: true, title: true, description: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(sessions)
})

// GET /:sessionId — Get session state
router.get('/:sessionId', async (req, res) => {
  const session = await prisma.aiChatSession.findUnique({
    where: { id: req.params.sessionId },
    select: {
      id: true, status: true, projectId: true, userId: true,
      collectedFields: true, matchedFreelancers: true,
      chatMessages: true, createdAt: true, updatedAt: true,
    },
  })
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(session)
})

export default router

// ────────────────────────────────────────────────────────────────────────────
// SOCKET HANDLERS
// ────────────────────────────────────────────────────────────────────────────

export function registerAiChatSocketHandlers(_io: Server, socket: Socket, _userId: string) {
  socket.on('ai-chat:join', (sessionId: string) => {
    socket.join(`ai-chat:${sessionId}`)
  })

  socket.on('ai-chat:leave', (sessionId: string) => {
    socket.leave(`ai-chat:${sessionId}`)
  })
}
