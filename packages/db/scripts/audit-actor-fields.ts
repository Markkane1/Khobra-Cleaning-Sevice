import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const fields: Record<string, string[]> = {
  CompanyBankAccount: ['createdBy', 'updatedBy', 'activatedBy', 'deactivatedBy', 'deletedBy'],
  LeaveRecord: ['approvedBy'], Booking: ['createdBy', 'cancelledBy'], BookingPickupAlert: ['generatedBy'],
  DriverExpense: ['submittedBy', 'approvedBy'], BusinessExpense: ['createdBy'],
  Payment: ['receivedBy', 'selectedBy', 'verifiedBy'], PaymentEvent: ['actorId'], Complaint: ['assignedTo'],
};

async function main() {
  let dangling = 0;
  for (const [table, columns] of Object.entries(fields)) for (const column of columns) {
    const rows = await db.$queryRawUnsafe<{ value: string; count: number }[]>(
      `SELECT x."${column}" value, count(*)::int count FROM "${table}" x LEFT JOIN "User" u ON u.id=x."${column}" WHERE x."${column}" IS NOT NULL AND u.id IS NULL GROUP BY x."${column}"`,
    );
    if (rows.length) console.log(table, column, rows);
    dangling += rows.reduce((total, row) => total + row.count, 0);
  }
  console.log(`${dangling} dangling actor references found.`);
}

main().finally(() => db.$disconnect());
