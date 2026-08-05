import { PrismaClient } from '@prisma/client';
import { IEmployeeRepository, Employee } from '@repo/application';
import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@repo/core';
import { nextReference } from '../reference-sequence';
import { hashPassword } from '../password';

export class PrismaEmployeeRepository implements IEmployeeRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Employee[]> {
    const [employees, ratingStats] = await Promise.all([
      this.db.employee.findMany({
        where: { tenantId },
        include: { user: { select: { name: true, email: true, phone: true } }, _count: { select: { assignments: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.assignment.groupBy({
        by: ['employeeId'],
        where: { tenantId, customerRating: { not: null } },
        _avg: { customerRating: true },
        _count: { customerRating: true },
      }),
    ]);
    const statsByEmployee = new Map(ratingStats.map(stat => [stat.employeeId, stat]));
    return employees.map(employee => {
      const stats = statsByEmployee.get(employee.id);
      return {
        ...employee,
        averageRating: stats?._avg.customerRating ?? 0,
        ratingCount: stats?._count.customerRating ?? 0,
      };
    }) as unknown as Employee[];
  }

  async findById(tenantId: string, id: string): Promise<Employee | null> {
    return this.db.employee.findFirst({
      where: { id, tenantId },
      include: { user: { select: { name: true, email: true, phone: true } } },
    }) as unknown as Employee | null;
  }

  async create(tenantId: string, data: CreateEmployeeDTO): Promise<Employee> {
    const { email, name, phone, temporaryPassword, ...empData } = data;
    
    return this.db.$transaction(async tx => {
      const code = await nextReference(tx, tenantId, 'employee', 'EMP', 4, 0);
      
      const user = await tx.user.create({
        data: {
          tenantId,
          email,
          name,
          phone,
          passwordHash: hashPassword(temporaryPassword),
          role: 'cleaner',
          status: 'active',
        },
      });

      return tx.employee.create({
        data: {
          tenantId,
          userId: user.id,
          employeeCode: code,
          ...empData,
        },
        include: { user: { select: { name: true, email: true, phone: true } } },
      });
    }) as unknown as Employee;
  }


  async update(tenantId: string, id: string, data: UpdateEmployeeDTO): Promise<Employee> {
    const employee = await this.db.employee.findFirst({ where: { id, tenantId } });
    
    if (employee) {
      const userUpdate: any = {};
      if (data.name) userUpdate.name = data.name;
      if (data.email) userUpdate.email = data.email;
      if (data.phone) userUpdate.phone = data.phone;
      
      if (Object.keys(userUpdate).length > 0) {
        await this.db.user.update({
          where: { id: employee.userId },
          data: userUpdate,
        });
      }
    }

    const { id: _id, email, name, phone, ...empData } = data;

    return this.db.employee.update({
      where: { id, tenantId },
      data: empData,
      include: { user: { select: { name: true, email: true, phone: true } } },
    }) as unknown as Employee;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const employee = await this.db.employee.findFirst({ where: { id, tenantId }, select: { userId: true } });
    if (!employee) return;

    const now = new Date()

    // ponytail: Soft-delete employee & deactivate user account to preserve financial audit trail
    await this.db.$transaction([
      this.db.employee.update({
        where: { id, tenantId },
        data: { status: 'inactive', deletedAt: now },
      }),
      this.db.user.update({
        where: { id: employee.userId },
        data: { status: 'inactive' },
      }),
    ])
  }

}
