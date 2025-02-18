import { EmailFields } from '@/types/email';
import { logError, logInfo } from './logger';
import * as fs from 'fs';

const cheerio = require('cheerio');

interface MarkerConfig {
  type: string;
  identifyingMarker: string;
  startMarker: string;
  endMarkers: string[];
  fieldRecognitionPatterns?: {
    [key: string]: RegExp;
  };
}

export function extractStructuredInfoFromEmail(
  textToAnalyze: string
): EmailFields {
  try {
    const $ = cheerio.load(textToAnalyze);

    // Remove script and style tags
    $('script').remove();
    $('style').remove();
    $('head').remove();

    $('p').after('\n');
    $('br').after('\n');

    // Get text and preserve some formatting
    let text = $('body').text();

    // Clean up whitespace
    text = text
      .replace(/[^\S\n]+/g, ' ') // Replace whitespace except newlines with single space
      .replace(/\n{2,}/g, '\n\n') // Convert 3+ newlines to double newline
      .replace(/\n\s+/g, '\n') // Clean up spaces after newlines
      .trim();

    // Remove any remaining HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    const markers: MarkerConfig[] = [
      {
        type: 'websiteComplaintForm',
        identifyingMarker: 'Eure Nachricht an uns',
        startMarker: 'Eure Nachricht an uns',
        endMarkers: ['Dokumenten-Upload'],
        fieldRecognitionPatterns: {
          anrede: /Anrede(Frau|Herr|Divers|Keine Angabe)/,
          email: /E-Mail([^\s]+@[^\s]+)(\s+)(?=Telefon)/,
          vorname: /Dokumenten-Upload-Vorname(\S+)(\s+)(?=Nachname)/,
          nachname: /Nachname(\S+)/,
        },
      },
      {
        type: 'vrrForwardedComplaint',
        identifyingMarker: 'Meldungs ID:',
        startMarker: 'Anliegen:',
        endMarkers: ['Rheinbahn AG | '],
        fieldRecognitionPatterns: {
          email: /Mail:\s*([^\s]+@[^\s]+)/,
          vorname:
            /Vorname, Name:\s*([^\s]+)\s+([^\n]+?)(?=\s*Straße\/Hausnummer:)/i,
          nachname:
            /Vorname, Name:\s*[^\s]+\s+([^\n]+?)(?=\s*Straße\/Hausnummer:)/i,
          datum: /Empfangen am\s*([0-9\.]+\sum\s[0-9\:]+)\s+([^\n]+?)/i,
        },
      },
      {
        type: 'vrrForwardedComplaint2',
        identifyingMarker: 'EFA-Freitext:',
        startMarker: 'Meldetext:',
        endMarkers: ['Kategorie0:', 'Rheinbahn AG | '],
        fieldRecognitionPatterns: {
          anrede: /Anrede:\s*([\s\S]*?)(?=\s*Vorname:)/i,
          email: /Email:\s*([^\s]+)\s+(?=Geburtsdatum:)/i,
          vorname: /Vorname:\s*([^\s]+)\s+([^\n]+?)/i,
          nachname: /Nachname:\s*([^\s]+)\s+([^\n]+?)/i,
          datum: /Anlagedatum:\s*([0-9\.]+\s[0-9\:]+)\s+([^\n]+?)/i,
        },
      },
      {
        type: 'callcenterForwardedComplaint',
        identifyingMarker: 'Datum/Uhrzeit des Vorfalls:',
        startMarker: 'Bemerkung:',
        endMarkers: [
          'Rheinbahn AG | ',
          'i.A. Nina Sternagel',
          '___________________________',
        ],
        fieldRecognitionPatterns: {
          email: /E_Mail:\s*([^\n]+?)(?=\s*\n)/i,
          vorname: /Vorname:\s*([\s\S]*?)(?=\s*Nachname:)/i,
          nachname: /Nachname:\s*([\s\S]*?)(?=\s*Geburtsdatum:)/i,
          stadt: /Ort_Vorfall:\s*([\s\S]*?)(?=\s*Linie:)/i,
          linie: /Linie:\s*([\s\S]*?)(?=\s*Haltestelle:)/i,
          haltestelle: /Haltestelle:\s*([\s\S]*?)(?=\s*Richtung:)/i,
          richtung: /Richtung:\s*([\s\S]*?)(?=\s*[-]{3,})/i,
          datum:
            /Datum\/Uhrzeit des Vorfalls:\s*(\d{4}-\d{2}-\d{2},\s*\d{2}:\d{2})/i,
        },
      },
      {
        type: 'directMailComplaint',
        identifyingMarker: 'Betreff:',
        startMarker: 'Betreff:',
        endMarkers: ['Rheinbahn AG | '],
      },
      {
        type: 'other',
        identifyingMarker: '',
        startMarker: '',
        endMarkers: [],
      },
    ];

    // Initialize fields with empty values
    const fields: EmailFields = {
      anrede: '',
      email: '',
      vorname: '',
      nachname: '',
      message: '',
      linie: '',
      haltestelle: '',
      richtung: '',
      stadt: '',
      datum: '',
    };

    // Determine email type
    const matchedMarker = markers.find((marker) =>
      text.includes(marker.identifyingMarker)
    );

    if (!matchedMarker) {
      throw new Error('Could not determine type of email');
    }

    let startIndex = text.indexOf(matchedMarker.startMarker);
    // This code block determines the end index of the message content by finding the earliest occurrence of any end marker.
    let endIndex = matchedMarker.endMarkers.reduce((minIndex, endMarker) => {
      const index = text.indexOf(endMarker);
      return index !== -1 && (index < minIndex || minIndex === -1)
        ? index
        : minIndex;
    }, -1);

    //if none of the start or end markers are found, set the start and end index to the beginning and end of the text
    if (startIndex === -1) {
      startIndex = 0;
    }

    if (endIndex === -1) {
      endIndex = text.length;
    }

    if (startIndex !== -1 && endIndex !== -1) {
      let messageText = text
        .substring(startIndex + matchedMarker.startMarker.length, endIndex)
        .trim();

      // Clean up common artifacts
      messageText = messageText
        .replace(/\[Externe E-Mail\]/g, '')
        .replace(/Meldung des Kunden:/g, '')
        .trim();

      fields.message = messageText;
    }

    // Extract fields using the patterns defined for this email type
    if (matchedMarker.fieldRecognitionPatterns) {
      for (const [field, pattern] of Object.entries(
        matchedMarker.fieldRecognitionPatterns
      )) {
        const match = text.match(pattern);
        if (match && match[1]) {
          fields[field] = match[1].trim();
        }
      }
    }

    return fields;
  } catch (error: any) {
    logError('Error parsing email:', { error: error?.message });
    throw error;
  }
}
