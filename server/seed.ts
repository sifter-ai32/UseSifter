import 'dotenv/config'
import prisma from './db'

async function main() {
  // Create default users
  const client = await prisma.user.upsert({
    where: { email: 'client' },
    update: {},
    create: {
      email: 'client',
      password: 'client',
      name: 'Client User',
      userType: 'client',
    },
  })

  const freelancer = await prisma.user.upsert({
    where: { email: 'freelancer' },
    update: {},
    create: {
      email: 'freelancer',
      password: 'freelancer',
      name: 'Freelancer User',
      userType: 'talent',
      bio: 'Full-stack developer with 5+ years of experience',
      location: 'San Francisco, CA',
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      hourlyRate: 85,
    },
  })

  // Create a sample project
  const project = await prisma.project.upsert({
    where: { id: 'sample-project-1' },
    update: {},
    create: {
      id: 'sample-project-1',
      title: 'E-Commerce Platform Redesign',
      description: 'Complete redesign of the e-commerce platform with modern UI/UX',
      budget: 12000,
      status: 'Processing',
      progress: 45,
      dueDate: new Date('2026-04-15'),
      ownerId: client.id,
      phases: {
        create: [
          { name: 'Discovery', status: 'completed', order: 1 },
          { name: 'Design', status: 'active', order: 2 },
          { name: 'Development', status: 'pending', order: 3 },
          { name: 'Testing', status: 'pending', order: 4 },
        ],
      },
    },
  })

  // Add freelancer as project member
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: freelancer.id } },
    update: {},
    create: {
      projectId: project.id,
      userId: freelancer.id,
      role: 'talent',
    },
  })

  // Create a deal room for the project
  const dealRoom = await prisma.dealRoom.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      messages: {
        create: [
          { content: 'Hi! Excited to work on this project.', senderId: freelancer.id },
          { content: 'Welcome aboard! Let\'s discuss the timeline.', senderId: client.id },
        ],
      },
    },
  })

  console.log('Seed completed!')
  console.log({ client: client.id, freelancer: freelancer.id, project: project.id, dealRoom: dealRoom.id })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
