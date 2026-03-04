
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Starting Playlist Flow Test...');

  // 1. Find a user to be the author (use the first user found)
  const author = await prisma.user.findFirst();
  if (!author) {
    console.error('❌ No users found. Please seed users first.');
    process.exit(1);
  }
  console.log(`👤 Author: ${author.email}`);

  // 2. Find a knowledge node
  const node = await prisma.knowledgeNode.findFirst();
  if (!node) {
    console.error('❌ No knowledge nodes found. Please seed knowledge first.');
    process.exit(1);
  }
  console.log(`📚 Node: ${node.name}`);

  // 3. Create a Playlist
  console.log('📝 Creating Playlist...');
  const playlist = await prisma.coursePlaylist.create({
    data: {
      title: 'Integration Test Playlist',
      description: 'Created by automated test script',
      authorId: author.id,
      isPublic: true,
      items: {
        create: [
          {
            order: 1,
            nodeId: node.id,
            duration: 10,
            interactionMode: 'lecture'
          },
          {
            order: 2,
            nodeId: node.id, // Reuse same node for simplicity
            duration: 20,
            interactionMode: 'discussion'
          }
        ]
      }
    },
    include: {
      items: true
    }
  });

  console.log(`✅ Playlist Created: ${playlist.id}`);
  console.log(`   Items Count: ${playlist.items.length}`);

  if (playlist.items.length !== 2) {
      console.error('❌ Expected 2 items, got ' + playlist.items.length);
      process.exit(1);
  }

  // 4. Cleanup
  console.log('🧹 Cleaning up...');
  await prisma.coursePlaylist.delete({
    where: { id: playlist.id }
  });

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
