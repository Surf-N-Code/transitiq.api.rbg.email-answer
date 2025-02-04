import { logInfo } from './logger';
import { sleep } from 'openai/core.mjs';
import { openai } from './openai';

export async function classifyText(text: string): Promise<boolean> {
  const prompt = `Aufgabe: Analysiere die folgende Nachricht eines Kunden und entscheide, ob sie sich darauf bezieht, dass der Kunde an einer Haltestelle (Bahn, Bus, U-Bahn) stehen gelassen wurde – also der Fahrer nicht gehalten oder an der Haltestelle vorbeigefahren ist.

Hinweise, die auf diesen Fall hindeuten können:

Haltestellenbezug: Erwähnung von Haltestellen (z. B. „Haltestelle Bilker Kirche“, „Haltestelle Universität Südost“, „Haltestelle Pempelforter“, „Haltestelle Haan Pütt“, „Vautierstr.“ etc.).
Formulierungen: Ausdrücke wie „stehen gelassen“, „vorbeifuhr“, „ohne zu halten“, „fährt an uns vorbei“ oder Hinweise darauf, dass Fahrgäste trotz Warteposition nicht bedient wurden.
Situationsbeschreibung: Konkrete Zeitangaben, situative Details (z. B. „im Regen stehen“, „warten“, „wurde abgeblinkt“) oder Verhaltensbeschreibungen (wie Gesten des Fahrers oder Reaktionen der Fahrgäste).
Unmut/Empörung: Aussagen, die auf Frust, Ärger oder Empörung über das Verhalten des Fahrers hinweisen.
Beispiele für Beschwerden, die in diese Kategorie fallen:

"Sehr geehrte Damen und Herren, heute, sogar gerade (Freitag, den 31.01.2025 um 12.23 Uhr) standen eine junge Dame mit einem Kinderwagen und ich an der Haltestelle Bilker Kirche in Düsseldorf und warteten auf den Bus 723 Richtung D-Eller, als der Busfahrer einfach ohne zu halten an uns vorbeifuhr. Man sah uns beiden an, dass wir auf diesen Bus warteten."

"Hallo. Es ist jetzt 15:27h und stehe an der Haltestelle Universität Südost. Gerade eben kam der Bus 835 Richtung Belsenplatz. Der Bus fuhr zwar langsamer, schaute kurz, machte aber keine Anstalten zu bremsen. Mein Winken wurde mit undeutbaren Gesten erwidert. Dann gab er Gas. 5 weitere Fahrgäste und ich sahen uns ungläubig an, dessen was gerade passierte."

"Sehr geehrte Damen und Herren, Ich stehe gerade an der Haltestelle Pempelforter im Regen. Ca. 13 Uhr und ihre nette Mitarbeiterin fährt mit voller Absicht an uns vorbei! Was soll das? Das ist mir noch nie passiert! Kundenfreundlich schaut anderes aus... Verärgert Grüße B. Blazejczak. Ich bitte um Stellungnahme."

"Ich bin eben gerade Zeuge geworden von der Unfähigkeit eines Busfahrers/in. Der 792 Richtung Sohlingen Ohligs kam um 8:20 an der Haltestelle Haan Pütt an. Ein älterer Herr, der nicht gut zu Fuß war und die Haltestelle noch nicht erreicht hatte, winkte dem Fahrer/in zu, dass er mit wollte. Der Fahrer/in fuhr an die Haltestelle, da dort noch jemand zusteigen wollte. Kurz bevor der ältere Herr den Bus erreichte und noch winkte, wurde der Blinker gesetzt und der Bus fuhr ab. Das nenne ich mal richtig unverschämt. So viel Zeit sollte doch wohl sein. Kann man keine Rücksicht auf ältere Menschen nehmen?????"

"Hallo, heute Samstag, 25.1., ist der Bus 733 an der Vautierstr. um 18.36 bzw. 18.37 direkt an der Haltestelle an uns vorbeigefahren. Danke, dass wir dadurch unseren Termin verpasst haben. Beste Grüße, Anett Wesoly."

Anweisung:
Lies die folgende Nachricht und entscheide, ob sie das Thema "Stehen gelassen werden an der Haltestelle" abdeckt. Antworte mit:

"Ja" – wenn die Nachricht darauf hindeutet, dass der Kunde an einer Haltestelle stehen gelassen wurde oder ein Bus/Train/andere Verkehrsmittel ohne Halt vorbeigefahren ist.
"Nein" – falls die Nachricht nicht in diese Kategorie fällt.

Antworte nur mit "Ja" oder "Nein".

Analysiere nun den folgenden Text:
Text: ${text}`;

  await sleep(500);
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
      max_tokens: 1500,
      temperature: 0,
    });

    const answer = response.choices[0]?.message?.content?.toLowerCase() || '';
    logInfo('Classification result:', answer);
    return answer.includes('ja');
  } catch (error) {
    console.error('Error classifying text:', JSON.stringify(error, null, 2));
    throw new Error('Error classifying text');
  }
}
