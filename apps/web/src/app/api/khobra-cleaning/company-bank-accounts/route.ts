import { NextRequest, NextResponse } from 'next/server';
import { db, PrismaPaymentRepository } from '@repo/db';
import { CompanyBankAccountSchema } from '@repo/core';
import { requireAuth } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-error';

const paymentRepository = new PrismaPaymentRepository(db);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer', 'admin']);
    if ('response' in auth) return auth.response;

    const isAdmin = auth.session.role === 'admin';
    const accounts = await paymentRepository.getCompanyBankAccounts(auth.session.tenantId, isAdmin);

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch company bank accounts', domainErrorStatus: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if ('response' in auth) return auth.response;

    const body = await req.json();
    const data = CompanyBankAccountSchema.parse(body);

    const account = await paymentRepository.saveCompanyBankAccount(
      auth.session.tenantId,
      auth.session.userId,
      data
    );

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to save company bank account', conflict: 'A bank account with this account number or IBAN already exists', domainErrorStatus: 400 });
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
      const account = await paymentRepository.toggleCompanyBankAccountActive(
        auth.session.tenantId,
        auth.session.userId,
        body.id,
        Boolean(body.isActive)
      );
      return NextResponse.json(account, { status: 200 });
    }

    const data = CompanyBankAccountSchema.parse(body);
    const account = await paymentRepository.saveCompanyBankAccount(
      auth.session.tenantId,
      auth.session.userId,
      data
    );

    return NextResponse.json(account, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to update company bank account', conflict: 'A bank account with this account number or IBAN already exists', missing: 'Company bank account not found', domainErrorStatus: 400 });
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

    const result = await paymentRepository.deleteCompanyBankAccount(
      auth.session.tenantId,
      auth.session.userId,
      id
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to delete company bank account', missing: 'Company bank account not found', relatedRecord: 'This bank account is used by a payment and cannot be deleted', domainErrorStatus: 400 });
  }
}
