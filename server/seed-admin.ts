import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from './db'

async function main() {
  const hashedPassword = await bcrypt.hash('admin@greesh', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@greesh' },
    update: { password: hashedPassword, userType: 'admin' },
    create: {
      email: 'admin@greesh',
      password: hashedPassword,
      name: 'Admin',
      userType: 'admin',
    },
  })

  console.log('Admin user created/updated:', admin.id, admin.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
