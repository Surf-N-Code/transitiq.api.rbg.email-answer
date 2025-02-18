import { extractStructuredInfoFromEmail } from '../extractStructuredInfoFromEmail';
import { emailExamples } from './htmlEmails';

describe('extractStructuredInfoFromEmail', () => {
  test('extracts fields from complaint form', () => {
    const html = emailExamples.filter(
      (email) => email.type === 'websiteComplaintForm'
    )[0].html;

    const result = extractStructuredInfoFromEmail(html);
    expect(result).toEqual(
      expect.objectContaining({
        anrede: 'Herr',
        vorname: 'Daniel',
        nachname: 'Krug',
        email: 'd.k.1986@gmx.net',
        message: `Liebe Rheinbahn, ich bitte täglich Ihr Angebot und bin sehr glücklich darüber. Allerdings gäbe es eine Verbesserung. Ich nehme an, dass nicht genug Fahrzeuge für die Wehrhahnlinie vorhanden sind. In einigen Monaten fällt das auch mehr auf als in anderen, vielleicht finden da ja Wartungen statt. Jedenfalls fahren dann immer viele Kurzzüge, die für Chaos sorgen, weil sich da alle reindrängeln, obwohl vielleicht eine Minute später noch eine Bahn kommt. Wer das weiß, wartet. Nur doof, wenn das auch ein Kurzzug ist. Zu gefühlt 90% fahren die kurzen Bahnen auf der Linie U83. Könnte man es nicht so machen, dass diese ausschließlich auf dieser Linie fahren? Wenn man dann an der Haltestelle steht, wüsste man: U71/72/73, da kommt auf jeden Fall ein langer, U83 könnte kurz sein. Gerade auch wenn ein überfüllter langer Zug einfährt und man auf die nächste Bahn wartet, die aber auch überfüllt (weil kurz) ist, könnte man das besser abschätzen. Außerdem fahren Kurzzüge immer bis ganz vorne und alle die ganz hinten einsteigen wollten müssen dann nach vorne hetzen und nutzen alle die hintere Tür. Dadurch wird es da besonders eng. Besser wäre es, wenn die Kurzzüge mehr mittig halten. Viele Grüße, Daniel Krug`,
        linie: '',
        haltestelle: '',
        richtung: '',
        stadt: '',
        datum: 'Dienstag, 18. Februar 2025 09:03',
      })
    );
  });

  test('extracts fields from VRR forwarded complaint version 1 with "Anliegen:"', () => {
    const html = emailExamples.filter(
      (email) => email.type === 'vrrForwardedComplaint'
    )[0].html;

    const result = extractStructuredInfoFromEmail(html);
    expect(result).toEqual(
      expect.objectContaining({
        anrede: '',
        vorname: 'Benedikt',
        nachname: 'Lamerz',
        email: 'Nordkap1@web.de',
        message: `Guten Abend,
der Bus der Linie 746 in Richtung Mettmann ist heute (12.01.2025) an der Bushaltestelle Schöne Aussicht in Wülfrath (Abfahrtszeit 19:45 Uhr) ohne Anzuhalten vorbeigefahren obwohl wir winkend - also sichtbar - an der Bushaltestelle standen.
Eine riesengroße Unverschämtheit vor allem bei diesen Temperaturen!!!
So gewinnen Sie ganz gewiss keine Kunden für den ÖPNV!!!
Wir erwarten eine Stellungnahme hierzu!`,
        linie: '',
        haltestelle: '',
        richtung: '',
        stadt: '',
        datum: '12.01.2025 um 19:59:54',
      })
    );
  });

  test('extracts fields from VRR forwarded complaint version 2 with "Meldetext:"', () => {
    const html = emailExamples.filter(
      (email) => email.type === 'vrrForwardedComplaint2'
    )[0].html;

    const result = extractStructuredInfoFromEmail(html);
    expect(result).toEqual(
      expect.objectContaining({
        anrede: '',
        vorname: 'Philippe',
        nachname: 'Favresse',
        email: 'Delolmofavresse@hotmail.com',
        message: `Der Bus 759 fährt immer vor 17:34 von der Düsseldorf Flughafen Bushaltestelle ab und kann diesen nicht erwischen, wenn mein Zug kurz davor am Düsseldorf Flughafen ankommt. Zusätzliche fährt dieser Bus auch noch fast leer von der Bushaltestelle! Bitten Sie doch einfach den Busfahrer nicht votr 17:34 loszufahren.`,
        linie: '',
        haltestelle: '',
        richtung: '',
        stadt: '',
        datum: '10.02.2025 17:48:32',
      })
    );
  });

  test('throws error for unknown email type', () => {
    const html = `
      <html>
        <body>
          Some random content
        </body>
      </html>
    `;

    expect(() => extractStructuredInfoFromEmail(html)).toThrow(
      'Could not determine type of email'
    );
  });
});
