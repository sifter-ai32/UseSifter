// server/negotiator.ts
// Freelancer-side AI Negotiator Bot — integrated into the platform
// Ported from standalone agentFreelancer.ts to use Prisma + Socket.io

import { Router } from 'express'
import type { Server, Socket } from 'socket.io'
import OpenAI from 'openai'
import prisma from './db'
import { sendDealConfirmationEmail } from './email'

const router = Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

interface ProjectRequirements {
  project_title: string
  service_category: string
  description: string
  skills_required: string[]
  deliverables: string[]
  budget_min: number
  budget_max: number
  budget_type: 'hourly' | 'fixed' | 'milestone'
  timeline_start: string
  timeline_deadline: string
  timeline_flexible: boolean | null
  experience_level: string
  budget_negotiable: boolean | null
  currency: string
  communication_timezone: string | null
  communication_language: string
  nice_to_haves: string[]
  similar_examples: string[]
  ongoing_potential: boolean | null
  team_size: number
}

interface FreelancerProfile {
  freelancer_id: string
  name: string
  headline: string
  hourly_rate: number
  experience_level: string
  skills: string[]
  timezone: string
  avg_rating: number
  completion_rate: number
  total_projects: number
  portfolio_highlights: string[]
  response_time_hours: number
  preferred_channel: string
  member_since: string
}

interface MatchContext {
  rank: number
  composite_score: number
  skill_match_score: number
  rationale: string
  suggested_starting_offer: number
  concerns: string[]
}

interface NegotiationLimits {
  starting_offer: number
  round_2_max: number
  round_3_max: number
  absolute_ceiling: number
  absolute_floor: number
  concession_step: number
}

// ────────────────────────────────────────────────────────────────────────────
// OFFER CALCULATOR
// ────────────────────────────────────────────────────────────────────────────

function calculateOffers(
  freelancerRate: number,
  budgetMin: number,
  budgetMax: number,
  _budgetType: 'hourly' | 'fixed' | 'milestone'
): NegotiationLimits {
  // If freelancer's rate is below the budget range, negotiate between
  // the freelancer's rate and the budget — don't just offer the full budget
  const effectiveMin = Math.min(budgetMin, freelancerRate)
  const effectiveMax = budgetMax

  // Start at 70-80% of the freelancer's rate (or at least the effective minimum)
  const aggressiveOffer = Math.round(freelancerRate * 0.7)
  const moderateOffer = Math.round(freelancerRate * 0.8)

  let startingOffer: number
  if (freelancerRate <= budgetMin) {
    // Freelancer's rate is at or below our minimum — start near their rate
    startingOffer = Math.max(aggressiveOffer, Math.round(freelancerRate * 0.8))
  } else if (aggressiveOffer >= effectiveMin) {
    startingOffer = aggressiveOffer
  } else if (moderateOffer >= effectiveMin) {
    startingOffer = moderateOffer
  } else {
    startingOffer = effectiveMin
  }

  // Don't start above the freelancer's rate — no need to overpay
  startingOffer = Math.min(startingOffer, freelancerRate)
  // But never go below 1
  startingOffer = Math.max(startingOffer, 1)

  // Ceiling: never offer more than the freelancer's listed rate
  // (no point paying above what they charge), but respect budget max as hard limit
  const ceiling = Math.min(effectiveMax, freelancerRate > 0 ? freelancerRate : effectiveMax)

  const totalRoom = ceiling - startingOffer
  const concessionStep = Math.round(totalRoom / 3)

  return {
    starting_offer: startingOffer,
    round_2_max: Math.min(startingOffer + concessionStep, ceiling),
    round_3_max: Math.min(startingOffer + concessionStep * 2, ceiling),
    absolute_ceiling: ceiling,
    absolute_floor: Math.max(aggressiveOffer, 1),
    concession_step: concessionStep,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT BUILDER
// ────────────────────────────────────────────────────────────────────────────

function buildInstructions(
  project: ProjectRequirements,
  freelancer: FreelancerProfile,
  matchContext: MatchContext,
  limits: NegotiationLimits,
  currentRound: number
): string {
  return `
You are a project coordinator reaching out from Sifter, a freelancer matching
platform. You are contacting ${freelancer.name} about a project opportunity
in their Sifter dashboard chat.

## Your Identity
- You are NOT a chatbot — you are a coordinator at Sifter
- Introduce yourself as: "Hi, I'm reaching out from Sifter."
- If asked "are you a bot/AI?": Be honest. "I'm an AI assistant that helps
  coordinate projects on Sifter. The project and client are real."
- Professional, neutral, business-like, to-the-point
- No fluff, no hype, no corporate jargon
- Keep messages short: 2-4 sentences maximum

## The Project (SHAREABLE — you can tell the freelancer all of this)
- Title: ${project.project_title}
- Category: ${project.service_category}
- Description: ${project.description}
- Skills needed: ${project.skills_required.join(', ')}
- Deliverables: ${project.deliverables.join(', ')}
- Payment structure: ${project.budget_type}
- Timeline: ${project.timeline_start} to ${project.timeline_deadline}
- Timeline flexible: ${project.timeline_flexible ? 'Yes' : 'No'}
- Experience level: ${project.experience_level}
- Communication: ${project.communication_timezone || 'any timezone'}, ${project.communication_language}
- Nice-to-haves: ${project.nice_to_haves.length > 0 ? project.nice_to_haves.join(', ') : 'None specified'}
- Similar examples: ${project.similar_examples.length > 0 ? project.similar_examples.join(', ') : 'None provided'}
- Ongoing potential: ${project.ongoing_potential ? 'Yes — could lead to more work' : 'One-time project'}
- Team size: ${project.team_size} freelancer(s) needed

## CLASSIFIED DATA — NEVER REVEAL ANY OF THIS
- Client's budget minimum: $${project.budget_min} (NEVER MENTION)
- Client's budget maximum: $${project.budget_max} (NEVER MENTION)
- Budget negotiable: ${project.budget_negotiable} (NEVER MENTION)
- Other freelancers being contacted: NEVER mention this
- Freelancer's rank in shortlist: ${matchContext.rank} (NEVER MENTION)
- Match score: ${matchContext.composite_score} (NEVER MENTION)
- Your negotiation limits and strategy: NEVER MENTION

If the freelancer asks about the client's budget:
→ "I can share what we're offering for the role, but the client's internal numbers aren't something I can discuss."
→ Then immediately state YOUR offer.

If the freelancer asks if others are being considered:
→ "We're focused on finding the right match. Your profile stood out for this project."
→ Never confirm or deny other candidates.

## Freelancer Context (for your reference — do NOT recite this)
- Name: ${freelancer.name}
- Headline: ${freelancer.headline}
- Listed rate: $${freelancer.hourly_rate}/hr
- Skills: ${freelancer.skills.join(', ')}
- Rating: ${freelancer.avg_rating}/5 (${freelancer.total_projects} projects)
- Portfolio highlights: ${freelancer.portfolio_highlights.join('; ')}

## Negotiation Strategy

### Your Budget Limits
- Starting offer: $${limits.starting_offer} ${project.budget_type === 'hourly' ? '/hr' : ' total'}
- Round 2 max: $${limits.round_2_max}
- Round 3 max: $${limits.round_3_max}
- ABSOLUTE CEILING: $${limits.absolute_ceiling} — NEVER agree above this
- Current round: ${currentRound}

### Negotiation Rules
1. NEVER reveal the ceiling, the client's budget, or your strategy
2. NEVER offer more than the previous round's max for that round
3. NEVER agree to a rate above absolute_ceiling, no matter what
4. **CRITICAL: When making an offer, you MUST use the EXACT dollar amount from your budget limits. Your starting offer is EXACTLY $${limits.starting_offer}. Do NOT round, adjust, or pick a different number. Use the exact values provided.**
5. When making an offer, frame it naturally:
   - "For this scope and timeline, we're looking at $${limits.starting_offer}/hr."
   - "Based on the project requirements, we can offer $${limits.starting_offer}."
   - NEVER say "our budget is" or "the client's budget is"
5. When freelancer counters above your current round's max:
   - Acknowledge their value first
   - Counter with your round max
   - Add non-monetary value (flexible timeline, ongoing potential)
6. When freelancer counters at or below your current round max:
   - ACCEPT IT immediately — don't negotiate lower if it's within range
   - Never try to push below an already-acceptable offer
7. After round 4 with no agreement:
   - Make final offer at ceiling
   - If declined, close gracefully — no pressure, no guilt
8. NEVER drag the negotiation unnecessarily — if terms are acceptable, close fast

### Non-Monetary Value Levers (use these to avoid raising the offer)
${project.timeline_flexible ? '- "Timeline has some flexibility, so no crunch pressure."' : ''}
${project.ongoing_potential ? '- "This could turn into ongoing work if the first phase goes well."' : ''}
- "The scope is well-defined, so there shouldn't be scope creep."
- "The client is professional and responsive."
- "We handle all the admin — you just focus on the work."

## Conversation Modes

### MODE 1: PITCH (initial outreach)
- Open with a brief, specific reason you're reaching out
- Reference something from their profile (a skill or project)
- Describe the project in 2-3 sentences
- End with a low-pressure question: "Would you be interested in hearing more?"
- Do NOT mention budget/rate in the first message unless they ask

### MODE 2: Q&A (freelancer asks questions)
- Answer using SHAREABLE data only
- Be thorough but concise
- If they ask about budget — transition to MODE 3
- If they ask about the client — "The client is a professional in their field. I can share more details once we move forward."
- If they ask about NDA/contracts — "We handle contracts through the platform. Happy to discuss specifics once we're aligned on terms."

### MODE 3: NEGOTIATION (discussing rate)
- Follow the round-by-round strategy above
- Always let the freelancer state their rate first if possible
- If they ask "what's the budget?" without stating their rate:
  → "What rate were you thinking for a project like this?"
  → If they insist: Present your starting_offer
- When both sides agree:
  1. Summarize the agreed terms clearly
  2. Ask for explicit confirmation
  3. Call confirm_deal ONLY after they confirm

## What NOT to Do
- Don't send walls of text — keep every message to 2-4 sentences
- Don't repeat project details the freelancer already knows
- Don't say "I understand your concern" — that's robotic
- Don't use "Great!" or "Awesome!" or "Absolutely!"
- Don't be apologetic about the offer — present it with confidence
- Don't reveal that you're optimizing for the lowest rate
- Don't mention other freelancers being contacted
- Don't share the client's personal details or company name until deal is confirmed
- Don't continue negotiating once terms are agreed — close fast
- Don't send more than 2 follow-up messages if the freelancer goes silent
- Don't guilt-trip or pressure the freelancer if they decline
`
}

// ────────────────────────────────────────────────────────────────────────────
// OPENAI TOOLS
// ────────────────────────────────────────────────────────────────────────────

const tools: any[] = [
  {
    type: 'function',
    name: 'log_negotiation',
    description: 'Log the current negotiation state after every meaningful exchange. IMPORTANT: our_current_offer MUST be the EXACT dollar amount you stated in your message text. If you offered $8, log 8. Never log a different number than what you said.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['outreach_sent', 'interested', 'in_qa', 'negotiating', 'awaiting_confirmation', 'agreed', 'declined', 'no_response', 'escalate_to_human'],
        },
        current_round: { type: 'number' },
        our_current_offer: { type: ['number', 'null'] },
        freelancer_counter: { type: ['number', 'null'] },
        conversation_summary: { type: 'string' },
        freelancer_sentiment: { type: 'string', enum: ['positive', 'neutral', 'hesitant', 'negative'] },
        key_concerns: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'current_round', 'our_current_offer', 'freelancer_counter', 'conversation_summary', 'freelancer_sentiment', 'key_concerns'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'confirm_deal',
    description: "Finalize the deal when the freelancer has explicitly confirmed the agreed terms. ONLY call this after the freelancer says 'yes', 'confirmed', 'let's do it', 'deal', or 'I agree'.",
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        agreed_rate: { type: 'number' },
        rate_type: { type: 'string', enum: ['hourly', 'fixed', 'milestone'] },
        currency: { type: 'string' },
        agreed_timeline: { type: 'string' },
        agreed_deliverables: { type: 'array', items: { type: 'string' } },
        special_terms: { type: ['string', 'null'] },
        summary: { type: 'string' },
      },
      required: ['agreed_rate', 'rate_type', 'currency', 'agreed_timeline', 'agreed_deliverables', 'special_terms', 'summary'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'close_negotiation',
    description: 'Close the negotiation when it fails.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['freelancer_declined', 'rate_too_high', 'freelancer_unavailable', 'no_response', 'skill_mismatch', 'other'] },
        details: { type: 'string' },
        freelancer_rate_asked: { type: ['number', 'null'] },
        our_final_offer: { type: ['number', 'null'] },
      },
      required: ['reason', 'details', 'freelancer_rate_asked', 'our_final_offer'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'escalate_to_human',
    description: 'Flag this negotiation for human review.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['freelancer_requests_human', 'legal_contract_questions', 'complex_negotiation', 'hostile_freelancer', 'suspicious_activity', 'other'] },
        details: { type: 'string' },
        conversation_summary: { type: 'string' },
      },
      required: ['reason', 'details', 'conversation_summary'],
      additionalProperties: false,
    },
  },
]

// ────────────────────────────────────────────────────────────────────────────
// TOOL CALL HANDLERS (Prisma-backed)
// ────────────────────────────────────────────────────────────────────────────

async function handleToolCall(name: string, args: any, negotiationId: string, io?: Server): Promise<void> {
  switch (name) {
    case 'log_negotiation':
      await prisma.negotiation.update({
        where: { id: negotiationId },
        data: {
          status: args.status,
          currentRound: args.current_round,
          currentOffer: args.our_current_offer,
          freelancerCounter: args.freelancer_counter,
          freelancerSentiment: args.freelancer_sentiment,
          keyConcerns: args.key_concerns,
          conversationSummary: args.conversation_summary,
        },
      })
      break

    case 'confirm_deal': {
      const neg = await prisma.negotiation.update({
        where: { id: negotiationId },
        data: {
          status: 'agreed',
          finalRate: args.agreed_rate,
          currentOffer: args.agreed_rate,
          conversationSummary: args.summary,
        },
      })
      // Create 1:1 DealRoom between client and freelancer
      let confirmDealRoom = await prisma.dealRoom.findUnique({
        where: { clientId_freelancerId: { clientId: neg.clientId, freelancerId: neg.freelancerId } },
      })
      if (!confirmDealRoom) {
        confirmDealRoom = await prisma.dealRoom.create({
          data: { clientId: neg.clientId, freelancerId: neg.freelancerId },
        })
      }

      // Send a system message about the deal
      const confirmProject = await prisma.project.findUnique({ where: { id: neg.projectId }, select: { title: true } })
      await prisma.message.create({
        data: {
          content: `Deal accepted for "${confirmProject?.title || 'Project'}" at $${args.agreed_rate}/${args.rate_type || 'hourly'}.`,
          senderId: neg.clientId,
          dealRoomId: confirmDealRoom.id,
          messageType: 'system',
        },
      })

      if (io) {
        io.to(`negotiation:${negotiationId}`).emit('negotiation:status-changed', {
          negotiationId,
          status: 'agreed',
          finalRate: args.agreed_rate,
          dealRoomId: confirmDealRoom.id,
        })
      }

      // Send confirmation emails to both parties
      const [dealClient, dealFreelancer, dealProject] = await Promise.all([
        prisma.user.findUnique({ where: { id: neg.clientId }, select: { email: true, name: true } }),
        prisma.user.findUnique({ where: { id: neg.freelancerId }, select: { email: true, name: true } }),
        prisma.project.findUnique({ where: { id: neg.projectId }, select: { title: true } }),
      ])
      if (dealClient?.email && dealFreelancer?.name && dealProject?.title) {
        sendDealConfirmationEmail(dealClient.email, dealClient.name, dealProject.title, args.agreed_rate, args.rate_type || 'hourly', dealFreelancer.name, 'client').catch(console.error)
      }
      if (dealFreelancer?.email && dealClient?.name && dealProject?.title) {
        sendDealConfirmationEmail(dealFreelancer.email, dealFreelancer.name, dealProject.title, args.agreed_rate, args.rate_type || 'hourly', dealClient.name, 'freelancer').catch(console.error)
      }
      break
    }

    case 'close_negotiation':
      await prisma.negotiation.update({
        where: { id: negotiationId },
        data: {
          status: args.reason === 'no_response' ? 'no_response' : 'declined',
          conversationSummary: args.details,
        },
      })
      if (io) {
        io.to(`negotiation:${negotiationId}`).emit('negotiation:status-changed', { negotiationId, status: 'declined' })
      }
      break

    case 'escalate_to_human':
      await prisma.negotiation.update({
        where: { id: negotiationId },
        data: {
          status: 'escalate_to_human',
          conversationSummary: args.conversation_summary,
        },
      })
      if (io) {
        io.to(`negotiation:${negotiationId}`).emit('negotiation:status-changed', { negotiationId, status: 'escalate_to_human' })
      }
      break
  }
}

function getToolOutput(name: string): string {
  switch (name) {
    case 'confirm_deal':
      return JSON.stringify({
        status: 'deal_confirmed',
        instruction: "The deal has been confirmed and saved. Send a brief, professional closing message: tell the freelancer they'll receive the client's contact details and project workspace link via email shortly. Thank them by name. Keep it to 2 sentences.",
      })
    case 'close_negotiation':
      return JSON.stringify({
        status: 'negotiation_closed',
        instruction: 'The negotiation has been closed. Send a graceful closing message: thank the freelancer for their time, leave the door open for future opportunities. No pressure or guilt. Keep it to 2 sentences.',
      })
    case 'escalate_to_human':
      return JSON.stringify({
        status: 'escalated',
        instruction: 'This has been flagged for human review. Tell the freelancer someone from the team will be in touch shortly. Keep it to 1-2 sentences.',
      })
    default:
      return JSON.stringify({ status: 'ok' })
  }
}

function extractText(item: any): string {
  return (item.content || [])
    .filter((c: any) => c.type === 'output_text')
    .map((c: any) => c.text)
    .join('')
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Build freelancer profile + match context from DB user
// ────────────────────────────────────────────────────────────────────────────

function buildFreelancerProfile(user: any): FreelancerProfile {
  return {
    freelancer_id: user.id,
    name: user.name || 'Freelancer',
    headline: user.headline || user.title || 'Freelancer',
    hourly_rate: user.hourlyRate || 50,
    experience_level: user.experience ? (user.experience >= 5 ? 'senior' : user.experience >= 2 ? 'mid' : 'junior') : 'mid',
    skills: user.skills || [],
    timezone: user.location || 'UTC',
    avg_rating: 4.5,
    completion_rate: 90,
    total_projects: 10,
    portfolio_highlights: Array.isArray(user.portfolio) ? user.portfolio.slice(0, 3).map((p: any) => p.title || 'Project') : [],
    response_time_hours: 3,
    preferred_channel: 'in_app',
    member_since: user.createdAt?.toISOString?.() || '2024-01-01',
  }
}

function buildMatchContext(rank: number, freelancer: FreelancerProfile, startingOffer: number): MatchContext {
  return {
    rank,
    composite_score: Math.max(70, 95 - (rank - 1) * 5),
    skill_match_score: Math.max(70, 95 - (rank - 1) * 3),
    rationale: `Strong match based on skills: ${freelancer.skills.slice(0, 3).join(', ')}`,
    suggested_starting_offer: startingOffer,
    concerns: [],
  }
}

function buildProjectRequirements(project: any, budgetMin: number, budgetMax: number): ProjectRequirements {
  // If project has structured requirements from AI chat, use them
  const reqs = project.requirements as any
  if (reqs && reqs.project_title) {
    return {
      project_title: reqs.project_title || project.title,
      service_category: 'development',
      description: reqs.description || project.description || '',
      skills_required: reqs.skills_required || [],
      deliverables: reqs.deliverables || [],
      budget_min: reqs.budget_min ?? budgetMin,
      budget_max: reqs.budget_max ?? budgetMax,
      budget_type: reqs.budget_type || 'hourly',
      timeline_start: reqs.timeline_start || 'ASAP',
      timeline_deadline: reqs.timeline_deadline || (project.dueDate ? new Date(project.dueDate).toLocaleDateString() : '3 months'),
      timeline_flexible: true,
      experience_level: reqs.experience_level || 'mid',
      budget_negotiable: true,
      currency: 'USD',
      communication_timezone: null,
      communication_language: 'English',
      nice_to_haves: [],
      similar_examples: [],
      ongoing_potential: true,
      team_size: 1,
    }
  }

  // Fallback: build from basic project fields
  return {
    project_title: project.title,
    service_category: 'development',
    description: project.description || 'No description provided',
    skills_required: [],
    deliverables: [],
    budget_min: budgetMin,
    budget_max: budgetMax,
    budget_type: 'hourly',
    timeline_start: 'ASAP',
    timeline_deadline: project.dueDate ? new Date(project.dueDate).toLocaleDateString() : '3 months',
    timeline_flexible: true,
    experience_level: 'mid',
    budget_negotiable: true,
    currency: 'USD',
    communication_timezone: null,
    communication_language: 'English',
    nice_to_haves: [],
    similar_examples: [],
    ongoing_potential: true,
    team_size: 1,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CORE: Start a negotiation
// ────────────────────────────────────────────────────────────────────────────

async function startNegotiation(
  projectId: string,
  freelancerId: string,
  clientId: string,
  projectReqs: ProjectRequirements,
  freelancerProfile: FreelancerProfile,
  matchContext: MatchContext,
  io?: Server
) {
  const limits = calculateOffers(
    freelancerProfile.hourly_rate,
    projectReqs.budget_min,
    projectReqs.budget_max,
    projectReqs.budget_type
  )

  // Create negotiation row
  const negotiation = await prisma.negotiation.create({
    data: {
      projectId,
      freelancerId,
      clientId,
      startingOffer: limits.starting_offer,
      round2Max: limits.round_2_max,
      round3Max: limits.round_3_max,
      absoluteCeiling: limits.absolute_ceiling,
      rateType: projectReqs.budget_type,
      currency: projectReqs.currency || 'USD',
    },
  })

  const instructions = buildInstructions(projectReqs, freelancerProfile, matchContext, limits, 0)

  // Loop to handle tool calls during outreach generation
  let nextInput: any[] = [{
    role: 'user',
    content: `[SYSTEM: Generate the initial outreach message to ${freelancerProfile.name}. Reference something specific from their profile: "${freelancerProfile.portfolio_highlights[0] || freelancerProfile.headline}". Describe the project briefly. End with a low-pressure question. Do NOT mention budget or rate in this first message.]`,
  }]
  let previousId: string | undefined = undefined
  let latestResponseId = ''
  let text = ''

  while (true) {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
      input: nextInput,
      tools,
      previous_response_id: previousId,
      store: true,
      temperature: 0.7,
    })

    latestResponseId = response.id
    previousId = response.id
    const functionOutputs: any[] = []

    for (const item of response.output) {
      if (item.type === 'message') text = extractText(item)
      if (item.type === 'function_call') {
        const fc = item as any
        await handleToolCall(fc.name, JSON.parse(fc.arguments), negotiation.id, io)
        functionOutputs.push({
          type: 'function_call_output',
          call_id: fc.call_id,
          output: getToolOutput(fc.name),
        })
      }
    }

    if (functionOutputs.length > 0) {
      nextInput = functionOutputs
      continue
    }
    break
  }

  // Save bot message
  const botMessage = await prisma.negotiationMessage.create({
    data: {
      negotiationId: negotiation.id,
      role: 'bot',
      content: text,
    },
  })

  // Update negotiation state
  await prisma.negotiation.update({
    where: { id: negotiation.id },
    data: {
      openaiResponseId: latestResponseId,
      status: 'outreach_sent',
      turnCount: 1,
    },
  })

  // Notify freelancer via socket
  if (io) {
    io.to(`user:${freelancerId}`).emit('negotiation:new', { negotiationId: negotiation.id })
    io.to(`negotiation:${negotiation.id}`).emit('negotiation:new-message', {
      id: botMessage.id,
      role: 'bot',
      content: text,
      createdAt: botMessage.createdAt,
    })
  }

  return {
    negotiation: await prisma.negotiation.findUnique({ where: { id: negotiation.id } }),
    outreachMessage: text,
    botMessageId: botMessage.id,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CORE: Handle freelancer reply
// ────────────────────────────────────────────────────────────────────────────

async function processFreelancerReply(negotiationId: string, message: string, io?: Server) {
  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: { project: true, freelancer: true },
  })
  if (!negotiation) throw new Error(`Negotiation ${negotiationId} not found`)

  // Save freelancer message
  const freelancerMsg = await prisma.negotiationMessage.create({
    data: { negotiationId, role: 'freelancer', content: message },
  })

  // Emit freelancer message to the room
  if (io) {
    io.to(`negotiation:${negotiationId}`).emit('negotiation:new-message', {
      id: freelancerMsg.id,
      role: 'freelancer',
      content: message,
      createdAt: freelancerMsg.createdAt,
    })
    io.to(`negotiation:${negotiationId}`).emit('negotiation:typing', { typing: true })
  }

  const freelancerProfile = buildFreelancerProfile(negotiation.freelancer)
  const projectReqs = buildProjectRequirements(negotiation.project, negotiation.startingOffer, negotiation.absoluteCeiling)
  // Reconstruct proper budget from negotiation limits
  projectReqs.budget_min = negotiation.startingOffer
  projectReqs.budget_max = negotiation.absoluteCeiling

  const matchContext = buildMatchContext(1, freelancerProfile, negotiation.startingOffer)

  const limits: NegotiationLimits = {
    starting_offer: negotiation.startingOffer,
    round_2_max: negotiation.round2Max,
    round_3_max: negotiation.round3Max,
    absolute_ceiling: negotiation.absoluteCeiling,
    absolute_floor: negotiation.startingOffer,
    concession_step: Math.round((negotiation.absoluteCeiling - negotiation.startingOffer) / 3),
  }

  const instructions = buildInstructions(projectReqs, freelancerProfile, matchContext, limits, negotiation.currentRound)

  let nextInput: any[] = [{ role: 'user', content: message }]
  let previousId: string | undefined = negotiation.openaiResponseId || undefined
  let latestResponseId = ''
  let text = ''
  let functionCalled: string | null = null
  let functionArgs: any = null

  while (true) {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions,
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
        await handleToolCall(fc.name, args, negotiationId, io)

        if (['confirm_deal', 'close_negotiation', 'escalate_to_human'].includes(fc.name)) {
          functionCalled = fc.name
          functionArgs = args
        } else if (!functionCalled) {
          functionCalled = fc.name
          functionArgs = args
        }

        functionOutputs.push({
          type: 'function_call_output',
          call_id: fc.call_id,
          output: getToolOutput(fc.name),
        })
      }
    }

    if (functionOutputs.length > 0) {
      nextInput = functionOutputs
      continue
    }
    break
  }

  // Save bot response message
  const botMsg = await prisma.negotiationMessage.create({
    data: {
      negotiationId,
      role: 'bot',
      content: text,
      toolCall: functionCalled,
      toolData: functionArgs ? functionArgs : undefined,
    },
  })

  // Update negotiation
  await prisma.negotiation.update({
    where: { id: negotiationId },
    data: {
      openaiResponseId: latestResponseId,
      turnCount: negotiation.turnCount + 1,
      lastFreelancerMessageAt: new Date(),
    },
  })

  // Emit bot response
  if (io) {
    io.to(`negotiation:${negotiationId}`).emit('negotiation:typing', { typing: false })
    io.to(`negotiation:${negotiationId}`).emit('negotiation:new-message', {
      id: botMsg.id,
      role: 'bot',
      content: text,
      toolCall: functionCalled,
      toolData: functionArgs,
      createdAt: botMsg.createdAt,
    })
  }

  const updatedNeg = await prisma.negotiation.findUnique({ where: { id: negotiationId } })

  return {
    text,
    functionCalled,
    functionArgs,
    negotiation: updatedNeg,
    botMessage: botMsg,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// EXPRESS ROUTES
// ────────────────────────────────────────────────────────────────────────────

// GET / — List negotiations for a freelancer
router.get('/', async (req, res) => {
  const { freelancerId } = req.query
  if (!freelancerId) {
    res.status(400).json({ error: 'freelancerId is required' })
    return
  }

  const negotiations = await prisma.negotiation.findMany({
    where: { freelancerId: freelancerId as string },
    include: {
      project: { select: { id: true, title: true, description: true, budget: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const result = negotiations.map((n) => ({
    id: n.id,
    status: n.status,
    currentRound: n.currentRound,
    currentOffer: n.currentOffer,
    freelancerCounter: n.freelancerCounter,
    finalRate: n.finalRate,
    rateType: n.rateType,
    currency: n.currency,
    freelancerSentiment: n.freelancerSentiment,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    project: n.project,
    lastMessage: n.messages[0] || null,
  }))

  res.json(result)
})

// GET /:id — Get negotiation details
router.get('/:id', async (req, res) => {
  const negotiation = await prisma.negotiation.findUnique({
    where: { id: req.params.id },
    include: {
      project: { select: { id: true, title: true, description: true, budget: true } },
      freelancer: { select: { id: true, name: true, avatar: true } },
    },
  })
  if (!negotiation) {
    res.status(404).json({ error: 'Negotiation not found' })
    return
  }
  res.json(negotiation)
})

// GET /:id/messages — Get all messages
router.get('/:id/messages', async (req, res) => {
  const messages = await prisma.negotiationMessage.findMany({
    where: { negotiationId: req.params.id },
    orderBy: { createdAt: 'asc' },
  })
  res.json(messages)
})

// POST /:id/messages — Freelancer sends a reply
router.post('/:id/messages', async (req, res) => {
  const { content } = req.body
  if (!content) {
    res.status(400).json({ error: 'content is required' })
    return
  }

  const negotiation = await prisma.negotiation.findUnique({ where: { id: req.params.id } })
  if (!negotiation) {
    res.status(404).json({ error: 'Negotiation not found' })
    return
  }

  // Don't allow messages on closed negotiations
  if (['agreed', 'declined', 'no_response', 'escalate_to_human'].includes(negotiation.status)) {
    res.status(400).json({ error: 'Negotiation is no longer active' })
    return
  }

  try {
    const io = req.app.get('io') as Server
    const result = await processFreelancerReply(req.params.id, content, io)
    res.json(result)
  } catch (err: any) {
    console.error('Negotiation reply error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /trigger — Trigger negotiations for a project
router.post('/trigger', async (req, res) => {
  const { projectId, freelancerIds, budgetMin, budgetMax, projectData } = req.body
  if (!projectId || !freelancerIds || !Array.isArray(freelancerIds)) {
    res.status(400).json({ error: 'projectId and freelancerIds[] are required' })
    return
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  const io = req.app.get('io') as Server
  const results: any[] = []

  for (let i = 0; i < freelancerIds.length; i++) {
    const fId = freelancerIds[i]
    try {
      // Check if negotiation already exists
      const existing = await prisma.negotiation.findUnique({
        where: { projectId_freelancerId: { projectId, freelancerId: fId } },
      })
      if (existing) {
        results.push({ freelancerId: fId, status: 'already_exists', negotiationId: existing.id })
        continue
      }

      const freelancer = await prisma.user.findUnique({ where: { id: fId } })
      if (!freelancer) {
        results.push({ freelancerId: fId, status: 'freelancer_not_found' })
        continue
      }

      const freelancerProfile = buildFreelancerProfile(freelancer)

      // Use provided project data or build from DB
      const projectReqs: ProjectRequirements = projectData ? {
        ...projectData,
        budget_min: budgetMin || projectData.budget_min || (project.budget ? project.budget * 0.7 : 30),
        budget_max: budgetMax || projectData.budget_max || (project.budget || 100),
      } : buildProjectRequirements(
        project,
        budgetMin || (project.budget ? project.budget * 0.7 : 30),
        budgetMax || (project.budget || 100)
      )

      const limits = calculateOffers(freelancerProfile.hourly_rate, projectReqs.budget_min, projectReqs.budget_max, projectReqs.budget_type)
      const matchContext = buildMatchContext(i + 1, freelancerProfile, limits.starting_offer)

      const result = await startNegotiation(
        projectId, fId, project.ownerId,
        projectReqs, freelancerProfile, matchContext, io
      )

      results.push({ freelancerId: fId, status: 'started', negotiationId: result.negotiation?.id })
    } catch (err: any) {
      console.error(`Failed to start negotiation with ${fId}:`, err)
      results.push({ freelancerId: fId, status: 'error', error: err.message })
    }
  }

  res.json({ started: results.filter((r) => r.status === 'started').length, results })
})

// POST /:id/accept — Freelancer accepts the current offer
router.post('/:id/accept', async (req, res) => {
  const negotiation = await prisma.negotiation.findUnique({ where: { id: req.params.id } })
  if (!negotiation) {
    res.status(404).json({ error: 'Negotiation not found' })
    return
  }
  if (negotiation.status === 'agreed') {
    res.json({ message: 'Already agreed', negotiation })
    return
  }
  if (!negotiation.currentOffer) {
    res.status(400).json({ error: 'No offer to accept' })
    return
  }

  const updated = await prisma.negotiation.update({
    where: { id: req.params.id },
    data: {
      status: 'agreed',
      finalRate: negotiation.currentOffer,
    },
  })

  // Create 1:1 DealRoom between client and freelancer
  let dealRoom = await prisma.dealRoom.findUnique({
    where: { clientId_freelancerId: { clientId: negotiation.clientId, freelancerId: negotiation.freelancerId } },
  })
  if (!dealRoom) {
    dealRoom = await prisma.dealRoom.create({
      data: { clientId: negotiation.clientId, freelancerId: negotiation.freelancerId },
    })
  }

  // Send a system message about the deal
  const project = await prisma.project.findUnique({ where: { id: negotiation.projectId }, select: { title: true } })
  await prisma.message.create({
    data: {
      content: `Deal accepted for "${project?.title || 'Project'}" at $${negotiation.currentOffer}/${negotiation.rateType || 'hourly'}.`,
      senderId: negotiation.clientId,
      dealRoomId: dealRoom.id,
      messageType: 'system',
    },
  })

  const io = req.app.get('io') as Server
  io.to(`negotiation:${req.params.id}`).emit('negotiation:status-changed', {
    negotiationId: req.params.id,
    status: 'agreed',
    finalRate: negotiation.currentOffer,
    dealRoomId: dealRoom.id,
  })

  res.json({ ...updated, dealRoomId: dealRoom.id })
})

export default router

// ────────────────────────────────────────────────────────────────────────────
// SOCKET.IO HANDLERS
// ────────────────────────────────────────────────────────────────────────────

export function registerNegotiatorSocketHandlers(io: Server, socket: Socket, userId: string) {
  // Join user-specific room for notifications
  socket.join(`user:${userId}`)

  socket.on('negotiation:join', (negotiationId: string) => {
    socket.join(`negotiation:${negotiationId}`)
  })

  socket.on('negotiation:leave', (negotiationId: string) => {
    socket.leave(`negotiation:${negotiationId}`)
  })

  socket.on('negotiation:send-message', async (data: { negotiationId: string; content: string }) => {
    try {
      // Verify this user owns the negotiation
      const neg = await prisma.negotiation.findUnique({ where: { id: data.negotiationId } })
      if (!neg || neg.freelancerId !== userId) return
      if (['agreed', 'declined', 'no_response', 'escalate_to_human'].includes(neg.status)) return

      await processFreelancerReply(data.negotiationId, data.content, io)
    } catch (err) {
      console.error('Socket negotiation:send-message error:', err)
    }
  })
}
