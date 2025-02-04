import { NextRequest, NextResponse } from 'next/server';
import { classifyText } from '@/lib/classifyText';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const isComplaintAboutBeingLeftBehind = await classifyText(text);

    return NextResponse.json({
      isComplaintAboutBeingLeftBehind,
    });
  } catch (error) {
    console.error('Error classifying text:', error);
    return NextResponse.json(
      { error: 'Failed to classify text' },
      { status: 500 }
    );
  }
}
