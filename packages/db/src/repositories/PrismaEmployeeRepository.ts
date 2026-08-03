import { PrismaClient } from '@prisma/client';
import { IEmployeeRepository, Employee } from '@repo/application';
import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@repo/core';

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

  async findById(id: string): Promise<Employee | null> {
    return this.db.employee.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    }) as unknown as Employee | null;
  }

  async create(tenantId: string, data: CreateEmployeeDTO): Promise<Employee> {
    const count = await this.db.employee.count({ where: { tenantId } });
    const code = `EMP-${String(count + 1).padStart(3, '0')}`;
    
    const user = await this.db.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: 'cleaner',
        status: 'active',
      },
    });

    const { email, name, phone, ...empData } = data;

    return this.db.employee.create({
      data: {
        tenantId,
        userId: user.id,
        employeeCode: code,
        ...empData,
      },
      include: { user: { select: { name: true, email: true, phone: true } } },
    }) as unknown as Employee;
  }

  async update(id: string, data: UpdateEmployeeDTO): Promise<Employee> {
    const employee = await this.db.employee.findUnique({ where: { id } });
    
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
      where: { id },
      data: empData,
      include: { user: { select: { name: true, email: true, phone: true } } },
    }) as unknown as Employee;
  }

  async delete(id: string): Promise<void> {
    const employee = await this.db.employee.findUnique({ where: { id }, select: { userId: true } });
    if (!employee) return;

    // Delete all child records first (no onDelete: Cascade in schema)
    await this.db.payrollRecord.deleteMany({ where: { employeeId: id } });
    await this.db.leaveRecord.deleteMany({ where: { employeeId: id } });
    await this.db.attendance.deleteMany({ where: { employeeId: id } });
    await this.db.assignment.deleteMany({ where: { employeeId: id } });

    // Now safe to delete the employee and their user account
    await this.db.employee.delete({ where: { id } });
    await this.db.user.delete({ where: { id: employee.userId } });
  }
}
