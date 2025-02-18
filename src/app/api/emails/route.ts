import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@/types/email';
import { fetchEmails } from '@/app/actions/actions';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const client = searchParams.get('client') as Client | 'all';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    const response = await fetchEmails({
      client,
      unreadOnly,
      page,
      pageSize,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
