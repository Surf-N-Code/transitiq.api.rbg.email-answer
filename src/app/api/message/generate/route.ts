import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function classifyText(text: string): Promise<boolean> {
  const prompt = `Analysiere den folgenden Text und bestimme, ob es sich um eine Beschwerde handelt, bei der jemand am Bahnhof oder an einer Haltestelle zurückgelassen wurde.
    Ebenfalls könnte die Beschwerde darüber gehen, dass ein Fahrzeug, ein Bus, oder eine Bahn, an einer Haltestelle nicht gehalten hat und einfach vorbeigefahren ist.
Antworte nur mit "Ja" oder "Nein".

Text: ${text}

Ist dies eine Beschwerde über das Zurücklassen am Bahnhof?`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein Assistent, der Texte analysiert und bestimmt, ob es sich um Beschwerden über das Zurücklassen am Bahnhof handelt.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
    });

    const answer = response.choices[0]?.message?.content?.toLowerCase() || '';
    return answer.includes('ja');
  } catch (error) {
    console.error('Error classifying text:', error);
    return false;
  }
}

export async function POST(req: Request) {
  const { text, vorname, nachname, anrede } = await req.json();
  const clientData = { vorname, nachname, anrede };
  if (!text) {
    console.error('Please provide text to analyze');
    process.exit(1);
  }
  console.log('\nAnalyzing text with GPT...');

  // Anonymize text first and then classify the anonymized text
  const { anonymized_text, replacements } = await anonymizeText(text);
  const isComplaintAboutBeingLeftBehind = await classifyText(anonymized_text);

  console.log('\n\nAnonymized text:');
  console.log(anonymized_text);
  console.log('\n\nReplacements:');
  console.log(replacements);
  console.log(
    '\n\nIs complaint about being left behind:',
    isComplaintAboutBeingLeftBehind
  );

  // Only generate response if it's a complaint about being left behind
  let finalResponse = null;
  if (isComplaintAboutBeingLeftBehind) {
    const aiResponse = await processTextWithAi(
      anonymized_text,
      replacements,
      clientData
    );
    if (!aiResponse) {
      console.error('Error in GPT processing');
      return Response.json({ error: 'Error in GPT processing' });
    }
    console.log('\n\nResponse:');
    console.log(aiResponse);

    finalResponse = deAnonymizeText(aiResponse, replacements);
    console.log('\n\nDeanonymized text:');
    console.log(finalResponse);
  }

  return Response.json({
    finalResponse,
    anonymized_text,
    replacements,
    isComplaintAboutBeingLeftBehind,
  });
}

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

type ClientData = {
  vorname: string;
  nachname: string;
  anrede: string;
};

async function processTextWithAi(
  anonymized_text: string,
  anonymized_text_parts: Record<string, any>,
  clientData: ClientData
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
- Namen der Personen die die Nachricht geschrieben haben
- Namen von anderen Personen
- Datum und Uhrzeit

Die Platzhalter sind wie folgt. Bitte verwende die Platzhalter in deiner Antwort. Du findest die Platzhalter ebenfalls in der anonymisierten Nachricht:
${placeholderKeys.join('\n')}

Stelle sicher, dass du die gleichen Platzhalter in deiner Antwort verwendest, dort wo Sie sinnvoll sind.

Im folgenden unter [LINIEN] gebe ich dir die Nummern der in Düsseldorf verkehrenden Bus, Stadtbahn (Linien), U-Bahn, Straßenbahn, und Schnell- und Metrobusse, sowie Orts- und Bürgerbusse. Wenn du die Nummer der Linie in dem Kundenanliegen findest, dann bezeichne die Linie entsprechend korrekt.
Beispielsätze:
Kundenanliegen: "Als ich an der Haltestelle Heinrichstraße stand, fuhr 834 einfach weiter ohne zu halten."
Antwort: "Es tut uns leid, dass der Bus 834 einfach an Ihnen vorbei gefahren ist... usw."

Kundenanliegen: "Heute früh fuhr 701 einfach an uns vorbei."
Antwort: "Es tut uns leid, dass die Straßenbahn 701 einfach an Ihnen vorbei gefahren ist... usw."

[LINIEN]
U-Bahnen / Stadtbahnen
U70
U71
U72
U73
U75
U76
U77
U78
U79
U83

Straßenbahnen
701
704
705
706
707
708
709

Busse
721
722
723
724
725
726
727
728
729
730
731
732
733
734
735
736
737
738
741
742
743
745
746
747
748
749
751
752
753
754
756
757
758
759
760
761
770
771
772
773
774
776
777
778
779
780
781
782
783
784
785
786
787
788
789
790
791
792
805
807
810
812
815
817
827
828
829
830
831
832
833
834
835
836
839
863
891
896

Schnell- und Metrobusse
SB19
SB50
SB51
SB52
SB53
SB55
SB57
SB59
SB68
SB79
M1
M2
M3

Orts- und Bürgerbusse
O1
O3
O5
O6
O10
O11
O12
O13
O14
O15
O16
O17
O19
BB1
BB2
BB3
[LINIEN_ENDE]

[KUNDENDATEN]
${
  clientData
    ? `Vorname des Kunden: ${clientData.vorname}
Nachname des Kunden: ${clientData.nachname}
Anrede des Kunden: ${clientData.anrede}
[KUNDENDATEN_ENDE]

`
    : `Wenn du das Geschlecht der Person ermitteln kannst, die die Nachricht geschrieben hat, dann verwende das Geschlecht in deiner Antwort in der Anrede. Zum Beispiel: "Sehr geehrte Frau Meier" oder "Sehr geehrter Herr Müller".
Wenn du das Geschlecht nicht ermitteln kannst, dann verwende die Anrede "Sehr geehrter Kunde".
Die Person die die Nachricht geschrieben hat, ist üblicherweise am Ende der Nachricht zu finden.
[KUNDENDATEN_ENDE]
`
}

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
