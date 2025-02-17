import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logError, logInfo } from '@/lib/logger';

interface EmailAnalysis {
  emailId: string;
  analysis: {
    mainPoints: string[];
    topic: string;
    priority: string;
  };
}

interface Category {
  name: string;
  description: string;
  topics: string[];
}

interface EmailWithCategory {
  emailId: string;
  subject: string;
  topic: string;
  category: string;
  mainPoints: string[];
}

interface CategoryStats {
  name: string;
  description: string;
  emailCount: number;
  emails: EmailWithCategory[];
}

async function readJsonFile(filename: string): Promise<any> {
  const filePath = path.join(process.cwd(), 'analysis-results', filename);
  const fileContent = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

function findCategoryForTopic(
  topic: string,
  categories: Category[]
): Category | undefined {
  // First try exact match
  let category = categories.find((cat) =>
    cat.topics.some((t) => t.toLowerCase() === topic.toLowerCase())
  );

  // If no exact match, try fuzzy match
  if (!category) {
    category = categories.find((cat) =>
      cat.topics.some(
        (t) =>
          topic.toLowerCase().includes(t.toLowerCase()) ||
          t.toLowerCase().includes(topic.toLowerCase())
      )
    );
  }

  return category;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const emailsFile = searchParams.get('emailsFile');
    const clusteringFile = searchParams.get('clusteringFile');

    if (!emailsFile || !clusteringFile) {
      return NextResponse.json(
        { error: 'Both emailsFile and clusteringFile parameters are required' },
        { status: 400 }
      );
    }

    // Read both files
    const [emailsData, clusteringData] = await Promise.all([
      readJsonFile(emailsFile),
      readJsonFile(clusteringFile),
    ]);

    const categories = clusteringData.clustering.categories;
    const categoryStats: CategoryStats[] = categories.map(
      (category: Category) => ({
        name: category.name,
        description: category.description,
        emailCount: 0,
        emails: [],
      })
    );

    logInfo('Processing emails:', {
      emailCount: emailsData.analysis.length,
      categoryCount: categories.length,
    });

    // Process each email
    const emailsWithCategories: EmailWithCategory[] = [];
    const uncategorizedEmails: EmailWithCategory[] = [];

    for (const emailAnalysis of emailsData.analysis) {
      const topic = emailAnalysis.analysis.topic;
      const category = findCategoryForTopic(topic, categories);
      const email = emailsData.emails.find(
        (e: any) => e.id === emailAnalysis.emailId
      );

      logInfo('Processing email:', {
        topic,
        foundCategory: category?.name || 'none',
        emailId: emailAnalysis.emailId,
      });

      const emailInfo: EmailWithCategory = {
        emailId: emailAnalysis.emailId,
        mainPoints: emailAnalysis.analysis.mainPoints,
        subject: email?.subject || 'No subject',
        topic,
        category: category?.name || 'Uncategorized',
      };

      if (category) {
        const statIndex = categoryStats.findIndex(
          (stat) => stat.name === category.name
        );
        if (statIndex !== -1) {
          categoryStats[statIndex].emailCount++;
          categoryStats[statIndex].emails.push(emailInfo);
        }
        emailsWithCategories.push(emailInfo);
      } else {
        uncategorizedEmails.push(emailInfo);
      }
    }

    // Sort categories by email count
    categoryStats.sort((a, b) => b.emailCount - a.emailCount);

    // Prepare response
    const response = {
      totalEmails: emailsData.analysis.length,
      categorizedEmails: emailsWithCategories.length,
      uncategorizedCount: uncategorizedEmails.length,
      categoryStats,
      uncategorizedList:
        uncategorizedEmails.length > 0 ? uncategorizedEmails : undefined,
      metadata: {
        emailsFile,
        clusteringFile,
        analysisTimestamp: new Date().toISOString(),
      },
    };

    // Store results
    const statsFilename = emailsFile.replace(
      'email-analysis',
      'category-stats'
    );
    const statsPath = path.join(
      process.cwd(),
      'analysis-results',
      statsFilename
    );
    await fs.promises.writeFile(
      statsPath,
      JSON.stringify(response, null, 2),
      'utf-8'
    );

    logInfo('Category statistics generated:', {
      totalEmails: response.totalEmails,
      categorizedEmails: response.categorizedEmails,
      uncategorizedCount: response.uncategorizedCount,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating category statistics:', error);
    return NextResponse.json(
      { error: 'Failed to generate category statistics' },
      { status: 500 }
    );
  }
}
