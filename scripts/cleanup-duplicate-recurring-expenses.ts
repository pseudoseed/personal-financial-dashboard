import { prisma } from '../src/lib/db';

async function main() {
  const userId = 'default';
  const all = await prisma.recurringExpense.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  const seen = new Set<string>();
  let deleted = 0;
  for (const exp of all) {
    const key = `${exp.merchantName || ''}__${exp.frequency}`;
    if (seen.has(key)) {
      await prisma.recurringExpense.delete({ where: { id: exp.id } });
      deleted++;
    } else {
      seen.add(key);
    }
  }
  console.log(`Deleted ${deleted} duplicate recurring expenses.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); }); 