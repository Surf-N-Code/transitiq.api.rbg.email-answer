import { logError, logInfo } from './logger';

const cheerio = require('cheerio');

export function extractStructuredInfoFromEmail(textToAnalyze: string) {
  try {
    const $ = cheerio.load(textToAnalyze);

    // Remove script and style tags
    $('script').remove();
    $('style').remove();
    $('head').remove();

    // Get text and preserve some formatting
    let text = $('body').text();

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Remove any remaining HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    // Extract main message content
    const comaplaintFormStartMarker = 'Eure Nachricht an uns';
    const comaplaintFormEndMarker = 'Dokumenten-Upload';
    const directMailComplaintMarker = 'Betreff:';
    const forwardedDirectComplaintMarker = 'Meldung des Kunden:';

    const fields: EmailFields = {
      anrede: '',
      email: '',
      vorname: '',
      nachname: '',
      message: '',
    };

    const startIndex = text.indexOf(comaplaintFormStartMarker);
    if (startIndex !== -1) {
      // Extract fields using regex patterns
      const patterns = {
        anrede: /Anrede(Frau|Herr|Divers|Keine Angabe)\s/,
        email: /E-Mail([^\s]+@[^\s]+)\s/,
        vorname: /Vorname([^\s]+)\s/,
        nachname: /Nachname([^\s]+)/,
      };

      for (const [field, pattern] of Object.entries(patterns)) {
        const match = text.match(pattern);
        if (match && match[1]) {
          fields[field] = match[1].trim();
        }
      }
      // Get text after start marker
      let messageText = text
        .substring(startIndex + comaplaintFormStartMarker.length)
        .trim();

      // Find end marker and cut there
      const endIndex = messageText.indexOf(comaplaintFormEndMarker);
      if (endIndex !== -1) {
        messageText = messageText.substring(0, endIndex).trim();
      }
      fields.message = messageText;
    } else if (text.includes(forwardedDirectComplaintMarker)) {
      const forwardedComplaintMarkerDetails = 'Anliegen:';
      const startIndex = text.lastIndexOf(forwardedComplaintMarkerDetails);
      const endIndex = text.indexOf('Rheinbahn AG | ');

      let messageText = text
        .substring(
          startIndex + forwardedComplaintMarkerDetails.length,
          endIndex
        )
        .trim();

      messageText = messageText.replace(/Meldung des Kunden:/g, '');
      fields.message = messageText;
    } else if (text.includes('Betreff:')) {
      const startIndex = text.lastIndexOf(directMailComplaintMarker);
      const endIndex = text.indexOf('Rheinbahn AG | ');

      let messageText = text
        .substring(startIndex + directMailComplaintMarker.length, endIndex)
        .trim();

      messageText = messageText.replace(/\[Externe E-Mail\]/g, '');
      fields.message = messageText;
    } else {
      fields.message = text;
    }
    return fields;
  } catch (error: any) {
    logError('Error parsing HTML:', { error: error?.message });
    throw new Error('Could not extract text and fields from email', {
      cause: error,
    });
  }
}
