import { NextResponse } from 'next/server';
import { Email } from '@/types/email';
import axios from 'axios';
import { extractEtag } from 'next/dist/server/image-optimizer';
const msal = require('@azure/msal-node');
const cheerio = require('cheerio');
import { openai } from '@/lib/openai';
import { classifyText } from '@/lib/classifyText';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const isComplaintAboutBeingLeftBehind = await classifyText(text);
    console.log('Classification result api:', isComplaintAboutBeingLeftBehind);
    return NextResponse.json({ isComplaintAboutBeingLeftBehind });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
