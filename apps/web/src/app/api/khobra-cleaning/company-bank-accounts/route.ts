import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, PrismaPaymentRepository } from '@repo/db';
import { PaymentService } from '@repo/application';
import { CompanyBankAccountSchema } from '@repo/core';
import { requireAuth } from '@/lib/auth';

const paymentRepository = new PrismaPaymentRepository(db);
const paymentService = new PaymentService(paymentRepository);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer', 'admin']);
    if ('response' in auth) return auth.response;

    const isAdmin = auth.session.role === 'admin';
    const accounts = await paymentService.getCompanyBankAccounts(auth.session.tenantId, isAdmin);

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch company bank accounts' }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if ('response' in auth) return auth.response;

    const body = await req.json();
    const data = CompanyBankAccountSchema.parse(body);

    const account = await paymentService.saveCompanyBankAccount(
      auth.session.tenantId,
      auth.session.userId,
      data
    );

    return NextResponse.json(account, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid bank account data' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to save company bank account' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if ('response' in auth) return auth.response;

    const body = await req.json();

    if (body.action === 'toggleActive') {
      if (!body.id) {
        return NextResponse.json({ error: 'Bank account ID is required' }, { status: 400 });
      }
      const account = await paymentService.toggleCompanyBankAccountActive(
        auth.session.tenantId,
        auth.session.userId,
        body.id,
        Boolean(body.isActive)
      );
      return NextResponse.json(account, { status: 200 });
    }

    const data = CompanyBankAccountSchema.parse(body);
    const account = await paymentService.saveCompanyBankAccount(
      auth.session.tenantId,
      auth.session.userId,
      data
    );

    return NextResponse.json(account, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid bank account data' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update company bank account' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bank account ID is required' }, { status: 400 });
    }

    const result = await paymentService.deleteCompanyBankAccount(
      auth.session.tenantId,
      auth.session.userId,
      id
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete company bank account' }, { status: 400 });
  }
}
