import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import prisma from '../infrastructure/database/prisma.js'

dotenv.config({ override: true })

const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || 'Super Admin Local'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'superadmin@local.test'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || 'Admin@123456'

async function run() {
  if (ADMIN_PASSWORD.length < 8) {
    throw new Error('ADMIN_PASSWORD deve ter pelo menos 8 caracteres.')
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  })

  console.log('Admin pronto para uso local:')
  console.log(`- id: ${admin.id}`)
  console.log(`- nome: ${admin.name}`)
  console.log(`- email: ${admin.email}`)
  console.log(`- role: ${admin.role}`)
  console.log(`- status: ${admin.status}`)
}

run()
  .catch((error) => {
    console.error('Falha ao criar/atualizar super admin:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
