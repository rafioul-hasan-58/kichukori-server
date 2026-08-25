import { PrismaClient } from '@prisma/client';

async function main() {
  const url = "mongodb://rafi_al_hasan:12345678Aa@159.41.227.49:27017,159.41.240.107:27017,159.41.225.248:27017/kichu-kori?ssl=true&replicaSet=atlas-x1dsq-shard-0&authSource=admin";
  console.log("Connecting with URL:", url);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });

  try {
    await prisma.$connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");
    const users = await prisma.user.findMany({ take: 1 });
    console.log("Users:", users);
  } catch (error) {
    console.error("❌ Connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
