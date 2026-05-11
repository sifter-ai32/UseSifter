import OpenAI, { toFile } from 'openai'
import fs from 'fs'

let openai: OpenAI
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

const systemInstructions = `You are a resume data extraction engine. Extract all information from the uploaded resume.

1. The person's full name is almost always at the top of the resume — extract it as "name".
2. Extract all factual information: name, skills, work experience, projects, links, country, etc.
3. Do NOT invent companies, roles, dates, skills, or projects that are not in the resume.
4. Return null only for fields that are truly absent from the resume.
5. Generate these fields based on the extracted facts:
   - professionalTitle: A strong, market-ready job title based on their FULL skill set, projects, AND internships/work experience. Highlight specific domains they have hands-on experience with. Examples: "AI/ML Engineer | Gen AI & NLP Specialist", "Full Stack Developer | React & Node.js". Do NOT use weak words like "Aspiring" or "Junior" — present them as a professional. Do NOT just copy their last job title.
   - headline: A compelling one-liner summarizing their profile, mentioning their key specializations. Example: "AI/ML Engineer skilled in Gen AI, AI Agents, NLP, and Deep Learning" — be specific about their actual tech domains.
   - bio (>=150 words, written in FIRST PERSON as if the person is describing themselves. Use "I" not their name. Example: "I am a software engineer with..." NOT "John is a software engineer with...")
6. skills: Extract ONLY technical/hard skills — programming languages, frameworks, tools, technologies, platforms, methodologies, and domain expertise. Do NOT include soft skills like "Communication", "Team Work", "Adaptability", "Time Management", "Collaborative", "Leadership", "Problem Solving", etc. Focus on what they can actually build with.
7. experienceYears: calculate from work experience dates. If no work experience, use 0.
8. categories: Extract domain expertise areas (e.g. "AI/ML", "Web Development", "Gen AI", "NLP"). These should reflect their actual areas of work based on projects and experience, not generic categories.
9. languages: Extract spoken/written languages mentioned in the resume with proficiency levels. Use "Native", "Fluent", "Conversational", or "Basic". If the resume is in a language but doesn't list languages, infer that language as "Native". Return null if no language info can be determined.
10. education: Extract education entries with institution name, degree/certification, start year, and end year. Return null if no education info is present.
11. Output must strictly match the provided JSON schema.`

// Helper for nullable types (OpenAI strict mode requires anyOf format)
const nullable = (type: string) => ({ anyOf: [{ type }, { type: 'null' as const }] })

const resumeSchema = {
  type: 'object',
  properties: {
    name: nullable('string'),
    professionalTitle: nullable('string'),
    experienceYears: nullable('number'),
    country: nullable('string'),
    headline: nullable('string'),
    categories: { type: 'array', items: { type: 'string' } },
    skills: { type: 'array', items: { type: 'string' } },
    links: {
      type: 'object',
      properties: {
        github: nullable('string'),
        linkedin: nullable('string'),
        portfolio: nullable('string'),
        x: nullable('string'),
      },
      required: ['github', 'linkedin', 'portfolio', 'x'],
      additionalProperties: false,
    },
    workExperience: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              company: { type: 'string' },
              role: { type: 'string' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['company', 'role', 'startDate', 'endDate', 'description'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    bio: nullable('string'),
    projects: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              startMonthYear: { type: 'string' },
              endMonthYear: { type: 'string' },
              description: { type: 'string' },
              techStack: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'startMonthYear', 'endMonthYear', 'description', 'techStack'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    languages: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              proficiency: { type: 'string' },
            },
            required: ['name', 'proficiency'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    education: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              institution: { type: 'string' },
              degree: { type: 'string' },
              startYear: { type: 'string' },
              endYear: { type: 'string' },
            },
            required: ['institution', 'degree', 'startYear', 'endYear'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
  },
  required: [
    'name', 'professionalTitle', 'experienceYears', 'country', 'headline',
    'categories', 'skills', 'links', 'workExperience', 'bio', 'projects',
    'languages', 'education',
  ],
  additionalProperties: false,
}

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

export async function extractResumeData(filePath: string, originalName: string): Promise<ResumeData> {
  const client = getOpenAI()

  // Upload file to OpenAI with proper filename
  const fileBuffer = fs.readFileSync(filePath)
  const file = await client.files.create({
    file: await toFile(fileBuffer, originalName, { type: 'application/pdf' }),
    purpose: 'user_data',
  })

  console.log('File uploaded to OpenAI:', file.id)

  // Extract structured data using Responses API
  const response = await client.responses.create({
    model: 'gpt-4o',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_file', file_id: file.id },
          { type: 'input_text', text: systemInstructions },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'resume_profile',
        strict: true,
        schema: resumeSchema,
      },
    },
  })

  console.log('OpenAI response received')

  // Extract JSON from response
  const outputItem = response.output[0]
  if (outputItem.type !== 'message') {
    console.error('Unexpected output:', JSON.stringify(response.output, null, 2))
    throw new Error('Unexpected response type: ' + outputItem.type)
  }
  const content = outputItem.content[0]
  if (content.type !== 'output_text') {
    console.error('Unexpected content:', JSON.stringify(outputItem.content, null, 2))
    throw new Error('Unexpected content type: ' + content.type)
  }

  const data: ResumeData = JSON.parse(content.text)

  // Clean up the uploaded file
  await client.files.delete(file.id).catch(() => {})

  return data
}
