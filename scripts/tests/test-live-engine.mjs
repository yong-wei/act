
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Starting Live Engine Flow Test...');

  // 1. Author
  const author = await prisma.user.findFirst();
  if (!author) { console.error('No users'); process.exit(1); }
  console.log(`👤 Author: ${author.email}`);

  // 2. Create Teaching Resources
  console.log('📦 Creating Resources...');
  const staticRes = await prisma.teachingResource.create({
      data: {
          title: 'Introduction to Control',
          type: 'STATIC_TEXT',
          content: '# Welcome to Control Theory\nThis is a markdown content.',
          authorId: author.id
      }
  });

  const simRes = await prisma.teachingResource.create({
      data: {
          title: 'PID Simulator',
          type: 'SIMULATION_APP',
          registryId: 'sim-pid-v1',
          authorId: author.id
      }
  });

  // 3. Create Lesson Plan (BOPPPS)
  console.log('🎼 Creating Lesson Plan...');
  const plan = await prisma.lessonPlan.create({
      data: {
          title: 'BOPPPS Demo Lesson',
          authorId: author.id,
          items: {
              create: [
                  {
                      resourceId: staticRes.id,
                      stage: 'BRIDGE_IN',
                      order: 1,
                      duration: 5
                  },
                  {
                      resourceId: simRes.id,
                      stage: 'PARTICIPATORY',
                      order: 1,
                      duration: 15
                  }
              ]
          }
      },
      include: { items: true }
  });

  console.log(`✅ Plan Created: ${plan.id}`);
  console.log(`   Items: ${plan.items.length}`);

  if (plan.items.length !== 2) {
      throw new Error('Expected 2 items');
  }

  // 4. Create Session
  console.log('📡 Creating Class Session...');
  const session = await prisma.classSession.create({
      data: {
          joinCode: '123456',
          planId: plan.id,
          teacherId: author.id,
          status: 'ACTIVE',
          currentStage: 'BRIDGE_IN',
          currentItemId: plan.items[0].id
      }
  });
  console.log(`✅ Session Created: ${session.joinCode}`);

  // 5. Cleanup
  console.log('🧹 Cleaning up...');
  await prisma.classSession.delete({ where: { id: session.id } });
  await prisma.lessonPlan.delete({ where: { id: plan.id } });
  await prisma.teachingResource.delete({ where: { id: staticRes.id } });
  await prisma.teachingResource.delete({ where: { id: simRes.id } });

  console.log('✨ Test Passed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
