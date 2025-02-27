import { createInterface } from 'readline';
import { stdin as input, stdout as output } from 'process';

export const askForConfirmation = async (
  inboxToProcess: string,
  toRecipients: string[],
  ccRecipients: string[],
  nonCategoryRecipients: string[]
): Promise<boolean> => {
  const rl = createInterface({ input, output });

  try {
    const redText = `\x1b[31mAre you sure you want to process emails for ${inboxToProcess}? ${toRecipients.join(
      ', '
    )} ${ccRecipients?.join(', ')} ${nonCategoryRecipients?.join(', ')}\x1b[0m`;
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${redText} (y/n): `, resolve);
    });

    return answer.toLowerCase() === 'y';
  } finally {
    rl.close();
  }
};
