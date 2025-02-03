const axios = require('axios');
const msal = require('@azure/msal-node');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const OpenAI = require('openai');
require('dotenv').config();

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.openai_api_key,
});

// Function to anonymize text using the FastAPI endpoint
async function anonymizeText(text: string) {
  try {
    const response = await axios.post('http://localhost:8051/anonymize', {
      text: text,
    });
    return response.data;
  } catch (error) {
    console.error(`Error anonymizing text: ${error?.message}`);
    return { anonymized_text: text, replacements: {} }; // Return original text if anonymization fails
  }
}

function deAnonymizeText(text: string, replacements: Record<string, string>) {
  let deanonymizedText = text;

  // Iterate through each category in replacements
  for (const category in replacements) {
    for (const replacementObj of replacements[category]) {
      for (const [placeholder, value] of Object.entries(replacementObj)) {
        deanonymizedText = deanonymizedText.replace(placeholder, value);
      }
    }
  }

  return deanonymizedText;
}

function getPlaceholderKeys(replacements: Record<string, any>) {
  const placeholders: string[] = [];

  // Iterate through each category in replacements
  for (const category in replacements) {
    // Get array for this category
    const replacementsArray = replacements[category];
    // For each object in the array, get its keys (placeholders)
    replacementsArray.forEach((obj: Record<string, any>) => {
      placeholders.push(...Object.keys(obj));
    });
  }

  return placeholders;
}

async function processTextWithAi(
  anonymized_text: string,
  anonymized_text_parts: Record<string, any>
) {
  // Get just the placeholder keys
  const placeholderKeys = getPlaceholderKeys(anonymized_text_parts);
  console.log('Placeholder keys:', placeholderKeys);

  const prompt = `
Du bist Kundensupport Mitarbeiter der Rheinbahn AG und schreibst antworten auf Kundenanliegen. Die Kundenanliegen befassen sich alle mit der Kernbeschwerde, dass der Kunde an einer Haltestelle von einem Bus oder Bahnfahrer stehen gelassen worden ist.

Bitte formuliere auf das folgende KUNDENALIEGEN eine sehr freundliche Antwort.

Notiz: In dem Kundenliegen sind die persönlich identifierbaren Informationen ersetzt worden durch Platzhalter. Die Informationen die ersetzt wurden, enthalten typischerweise:
- Haltestellen namen
- Straßennamen
- Nnamen
- Datum und Uhrzeit

Die Platzhalter sind wie folgt. Bitte verwende die Platzhalter in deiner Antwort. Du findest die Platzhalter ebenfalls in der anonymisierten Nachricht:
${placeholderKeys.join('\n')}

Vor den Platzhaltern Platzhaltern [TRANSPORT_LINE_NUMBER_1] etc. stehen nur noch die genauen identifizierenden Informationen des Busses, der Linie, der U-Bahn, der S-Bahn, der RE, der IC, etc. Bitte nutze diese Informationen um die Antwort zu verbessern.

Stelle sicher, dass du die gleichen Platzhalter in deiner Antwort verwendest, dort wo Sie sinnvoll sind.

[KUNDENANLIEGEN] 
${anonymized_text}
[KUNDENANLIEGEN_ENDE]

Nutze die folgenden Beispiele von Kundenanliegen und antworten
[BEISPIELE]
Kundenanliegen1: "Der M2 um 7.15 Richtung Staufenplatz, ist einfach an mir vorbei gefahren. \nLangsam reicht es wirklich! Das nächste Mal werde ich mir ein Taxi bestellen und zwar auf die Kosten des Unternehmens."
Antwort1: "sie standen gut sichtbar an der Haltestelle und warteten auf den Bus. Dieser kam, und fuhr einfach vorbei. Nun \nfragen Sie sich "Was war da los?" wir auch. \nNatürlich müssen unsere Fahrzeuge alle Haltestellen, an denen Fahrgäste sichtbar warten, auch bedienen. Denn \nunsere Fahrgäste sicher und komfortabel von A nach B zu bringen ist unser Job, und den machen wir gerne! Eine \nAusnahme besteht nur, wenn das Fahrzeug voll besetzt und somit keine weitere Fahrgastaufnahme möglich ist. In \ndiesem Fall darf das Fahrzeug vorbeifahren. Wir wollen so unnötige Diskussionen an der Haltestelle vermeiden. \nGerne werden wir Ihr Thema in unseren regelmäßig stattfindenden Mitarbeiterunterweisungen ansprechen, damit die \nKolleginnen und Kollegen sich noch sorgfältiger vergewissern ob Fahrgäste an der Haltestelle warten, denn wir \nmöchten es beim nächsten Mal besser für Sie und unsere anderen Fahrgäste machen. Daher ist Ihre Rückmeldung \nsehr wichtig für uns. Wir bedanken uns herzlich, dass Sie sich die Zeit genommen haben, sich bei uns zu melden. \nGleichzeitig entschuldigen wir uns vielmals für die Ihnen entstandene ungeplante Wartezeit auf den nächsten Bus. \nSo wollten wir keinesfalls glänzen! \nBitte tragen Sie uns die von Ihnen erlebte Situation nicht länger nach und bleiben Sie uns gewogen."

Kundenanliegen2: "Sehr geehrte Damen und Herren,  um 15:54 uhr hielt an der Norbert Schmidt Str. der Bus mit der Nr.8752\nMit der Aufschrift Dienstfahrt an.und öffnete die Tür. Da der 730 Verspätung hatte ging ich davon aus dass dies ein Ersatzbus wäre. Vor mir stieg ein kleiner Junge ein und setzte sich. Ich sagte dem Fahrer dass auf dem Display Dienstfahrt stünde. Darauf sagte er in einem sehr unangemessenem Ton, dass er nur seinen Sohn abholen würde. Schloss die Tür und fuhr weiter. Werden jetzt bei der Rheinbahn Gelenkbusse als Kindertaxen eingesetzt? Ich bitte hier um eine Rückantwort. \nMit freundlichen Grüßen
Antwort2: "sie berichten uns von einem Vorfall, bei dem ein Fahrer während einer Dienst- oder Leerfahrt seinen Sohn, jedoch keine anderen Fahrgäste mitnahm. So etwas geht natürlich nicht und ist auch untersagt. Hier informieren wir selbstverständlich den Fachbereich, damit Maßnahmen getroffen werden. So etwas soll sich nicht wiederholen. Wir kümmern uns darum! Bitte entschuldigen Sie den negativen Eindruck. Bitte glauben Sie uns: So ist die Rheinbahn nicht! Zukünftig wünschen wir Ihnen wieder eine unbeschwerte Fahrt mit unseren Bussen.

Kundenaliegen3: "Der Busfahrer der Linie 729 ab Flughafen Bahnhof heute am 06.8. Um 15:52, ist ohne die Fahrgäste aufzunehmen. Einfach abgefahren. Dies ist eine bodenlose Frechheit. Mit freundlichen Grüßen
Antwort3: "vielen Dank für Ihre Nachricht und Ihre Rückmeldung zur Linie 729. Wir bedauern sehr, dass der Busfahrer am 06. \nAugust um 15:52 Uhr am Flughafen Bahnhof abgefahren ist, ohne Fahrgäste aufzunehmen. Wir verstehen, dass dies \nsehr ärgerlich und frustrierend für Sie war. \nDer betreffende Bus musste aufgrund eines technischen Defekts unverzüglich in den Betriebshof fahren, um \nausgetauscht zu werden. Solche Maßnahmen sind leider manchmal notwendig, um die Sicherheit und Zuverlässigkeit \ndes öffentlichen Nahverkehrs zu gewährleisten. Der Bus konnte daher nicht wie geplant Fahrgäste aufnehmen. Wir \nentschuldigen uns aufrichtig für die entstandenen Unannehmlichkeiten und die dadurch verursachte Verzögerung. Wir \nsind stets bemüht, solche Vorfälle zu vermeiden und die Servicequalität für unsere Fahrgäste zu verbessern. Ihre \nRückmeldung ist für uns dabei sehr wertvoll und hilft uns, unseren Service kontinuierlich zu optimieren. \nSollten Sie weitere Fragen oder Anmerkungen haben, stehen wir Ihnen gerne zur Verfügung.

Kundenaliegen4: (Ersatzhaltestelle):"Sehr geehrte Damen und Herren,\n\nschon mehrfach seit den letzten Tagen - gerade wieder aktuell 15:41 754-er Richtung Ratingen - lassen die Fahrer*innen die Ersatzhaltestelle Oststraße U komplett aus und fahren daran vorbei, obwohl dort mind. 10 Fahrgäste standen.\n\nEs wäre schön, wenn alle Fahrer*innen über die Einrichtung dieser Ersatzhaltestelle Bescheid wüssten und diese nicht weiterhin von einigen ausgelassen wird.\n\nSehr ärgerlich für diejenigen, die 20 Minuten später ans Ziel gelangen und in dieser Zeit an einer Haltestelle ohne Sitzmöglichkeiten herumstehen müssen.\n"
Antwort4: "sie berichten uns, dass unsere Mitarbeitenden im Fahrdienst die verlegte Ersatzhaltestelle "Oststraße U" nicht \nbedienen. Herzlichen Dank für Ihre Nachricht. Nur durch solche Hinweise ist es uns möglich, Kenntnis von dem \nGeschilderten zu erhalten und der Sache nachzugehen. \nUnsere Fahrgäste müssen sich leider bei nötigen Bauarbeiten umorientieren, dann soll dieser veränderte Aus- und \nEinstieg aber auch funktionieren. Dazu informieren wir auch stets unser Fahrpersonal, damit solche Situationen wie \nvon Ihnen berichtet keinesfalls passieren. Wir entschuldigen uns für den Ihnen entstandenen Eindruck und die \nUnannehmlichkeiten. \nGerne kümmern wir uns darum und haben unsere Betriebsleitung in Kenntnis gesetzt. Hier muss durch unsere \nVerkehrsaufsicht vor Ort geschaut werden, wie die Bedienung der Haltestelle vom Personal gelebt wird und \nentsprechend bei Auffälligkeiten handeln. \nZukünftig wünschen wir Ihnen wieder eine unbeschwerte Fahrt mit unseren Bussen und Bahnen."
[BEISPIELE_ENDE]

[REGELN]
Formuliere eine sehr freundliche und ausführliche Antwort. Nenne in deiner Antwort auch auch mögliche Ursachen für die verspätung / den Grund für das stehen gelassen werden etc. Nenne das Datum, die Uhrzeit und die Haltestelle in der Antwort, sofern diese dir in dem Kundenanliegen genannt wurde.
[REGELN_ENDE]

Bitte formuliere nun eine sehr freundliche Antwort auf das oben genannte Kundenanliegen.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 1,
      max_tokens: 2000,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error(`Error in GPT processing: ${error?.message}`);
    return null;
  }
}

interface Fields {
  [key: string]: string;
  anrede: string;
  email: string;
  vorname: string;
  nachname: string;
  message: string;
}

function extractCustomerFieldsFromComplaintEmail(
  textToAnalyze: string
): Fields {
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

    // if the text contains "Eure Nachricht an uns" and "Dokumenten-Upload" then the email will contain the below fields

    // Extract main message content
    const comaplaintFormStartMarker = 'Eure Nachricht an uns';
    const comaplaintFormEndMarker = 'Dokumenten-Upload';
    const fields: Fields = {
      anrede: '',
      email: '',
      vorname: '',
      nachname: '',
      message: '',
    };

    const startIndex = text.indexOf(comaplaintFormStartMarker);
    if (startIndex !== -1) {
      console.log('Complaint Form Complaint:');
      // Extract additional fields

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

      return fields;
    } else {
      //get new startindex
      console.log('Direct Mail Complaint:');
      const directMailComplaintMarker = 'Betreff:';
      const startIndex = text.lastIndexOf(directMailComplaintMarker);
      const endIndex = text.indexOf('Rheinbahn AG | ');
      console.log('Start Index:', startIndex);
      console.log('End Index:', endIndex);
      // get the text between the start and end index
      let messageText = text
        .substring(startIndex + directMailComplaintMarker.length, endIndex)
        .trim();

      messageText = messageText.replace(/\[Externe E-Mail\]/g, '');
      fields.message = messageText;
      console.log('Message Text:', messageText);
      return fields;
    }
  } catch (error) {
    console.error(`Error parsing HTML: ${error}`);
    throw new Error('Could not extract text and fields from email');
  }
}

async function sendEmailViaGraph(
  accessToken: string,
  subject: string,
  content: string,
  toRecipients: string[],
  ccRecipients?: string[]
) {
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const emailData = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: content.replace(/\n/g, '<br>'),
        },
        toRecipients: toRecipients.map((email) => ({
          emailAddress: { address: email },
        })),
        ccRecipients:
          ccRecipients?.map((email) => ({
            emailAddress: { address: email },
          })) || [],
      },
    };

    const endpoint =
      'https://graph.microsoft.com/v1.0/users/' +
      process.env.MSAL_USER_EMAIL +
      '/sendMail';
    await axios.post(endpoint, emailData, { headers });
    console.log(`Email sent successfully to ${toRecipients.join(', ')}`);
  } catch (error: any) {
    console.error(`Error sending email: ${error?.message}`);
    throw error;
  }
}

class EmailCrawler {
  private msalClient: any;
  private config: any;
  private GRAPH_API_ENDPOINT: string;

  constructor() {
    this.GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0';
    this.msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: process.env.MSAL_CLIENT_ID,
        clientSecret: process.env.MSAL_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.MSAL_TENANT_ID}`,
      },
    });
  }

  async getAccessToken() {
    const scopes = ['https://graph.microsoft.com/.default'];
    try {
      const response = await this.msalClient.acquireTokenByClientCredential({
        scopes: scopes,
      });
      return response.accessToken;
    } catch (error) {
      console.error(`Error getting access token: ${error}`);
      throw error;
    }
  }

  async crawlUnreadEmails(toRecipients: string[], ccRecipients?: string[]) {
    try {
      const accessToken = await this.getAccessToken();
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      let endpoint =
        `${this.GRAPH_API_ENDPOINT}/users/${process.env.MSAL_USER_EMAIL}/messages?` +
        `$filter=isRead eq false&` +
        '$orderby=receivedDateTime desc&' +
        '$top=999&' +
        '$select=id,subject,body,from,receivedDateTime,isRead';

      let totalEmails = 0;

      while (endpoint) {
        try {
          const response = await axios.get(endpoint, { headers });
          const emails = response.data.value;
          totalEmails += emails.length;
          console.log(`Processing batch of ${emails.length} emails`);

          for (const email of emails) {
            if (
              email.from.emailAddress.address === process.env.MSAL_USER_EMAIL
            ) {
              console.log(`Skipping email ${totalEmails} - sent by self`);
              continue;
            }

            // Extract clean text and fields from anonymized HTML content
            let extractedFields: Fields;
            try {
              extractedFields = extractCustomerFieldsFromComplaintEmail(
                email.body.content
              );
            } catch (error) {
              const emailErrorObject = {
                id: email.id,
                from: email.from.emailAddress.address,
                subject: email.subject,
                receivedDateTime: email.receivedDateTime,
              };
              console.error(
                `Error extracting fields from email: ${JSON.stringify(
                  emailErrorObject,
                  null,
                  2
                )}`
              );
              continue;
            }
            console.log(
              'Extracted fields from anonymized content except content:',
              extractedFields
            );

            // Call the message/generate endpoint to generate the text
            const response = await fetch(
              'http://localhost:3000/api/message/generate',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: extractedFields.message,
                  vorname: extractedFields.vorname,
                  nachname: extractedFields.nachname,
                  anrede: extractedFields.anrede,
                }),
              }
            );

            if (!response.ok) {
              console.error(
                'Error calling message/generate endpoint:',
                response.statusText
              );
              throw new Error('Failed to generate text');
            }

            const messageGenerationResponse = await response.json();

            // Send GPT response via email
            if (messageGenerationResponse) {
              let content =
                `<strong>Kategorie:</strong>\nBeschwerde stehen gelassen` +
                `\n\n<strong>Kunden Beschwerde:</strong>\n${extractedFields.message}` +
                `\n\n<strong>KI Antwort:</strong>\n` +
                messageGenerationResponse.finalResponse;
              if (!messageGenerationResponse.isComplaintAboutBeingLeftBehind) {
                content = `<strong>Kategorie:</strong>\nAndere Kategorie\n\n<strong>Kunden Beschwerde:</strong> \n${extractedFields.message}`;
              }

              await sendEmailViaGraph(
                accessToken,
                `Kategorie: ${messageGenerationResponse.isComplaintAboutBeingLeftBehind ? 'Kategorie: Beschwerde stehen gelassen' : 'Andere Kategorie'} -> ${email.subject}`,
                content,
                toRecipients,
                ccRecipients
              );
            }

            // Mark email as read
            const markAsReadEndpoint = `${this.GRAPH_API_ENDPOINT}/users/${process.env.MSAL_USER_EMAIL}/messages/${email.id}`;
            await axios.patch(
              markAsReadEndpoint,
              { isRead: true },
              { headers }
            );
            console.log(`Marked email ${email.id} as read`);
          }

          // Check for more pages
          endpoint = response.data['@odata.nextLink'] || null;
        } catch (error) {
          console.error(`Error processing batch: ${error}`);
          throw error;
        }
      }

      return true;
    } catch (error) {
      console.error(`Error crawling emails: ${error}`);
      throw error;
    }
  }
}

export async function POST(request: Request) {
  try {
    const emailCrawler = new EmailCrawler();
    await emailCrawler.crawlUnreadEmails(['ndilthey@gmail.com']);
    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST handler:', error?.message);
    return Response.json(
      { error: error?.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
