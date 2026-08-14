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
    const { id: _id, email, name, phone, ...empData } = data;
    return this.db.$transaction(async tx => {
      const employee = await tx.employee.findFirst({ where: { id, tenantId } });
      if (!employee) throw new Error('Employee not found');
      const userUpdate: any = {};
      if (name !== undefined) userUpdate.name = name;
      if (email !== undefined) userUpdate.email = email;
      if (phone !== undefined) userUpdate.phone = phone;
      
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: employee.userId },
          data: userUpdate,
        });
      }
      return tx.employee.update({ where: { id, tenantId }, data: empData, include: { user: { select: { name: true, email: true, phone: true } } } });
    }) as unknown as Employee;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const employee = await this.db.employee.findFirst({ where: { id, tenantId }, select: { userId: true, user: { select: { role: true } } } });
    if (!employee) return;
    if (employee.user.role === 'admin') throw Object.assign(new Error('Remove the administrator role before deleting this cleaner profile'), { status: 409 });

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
