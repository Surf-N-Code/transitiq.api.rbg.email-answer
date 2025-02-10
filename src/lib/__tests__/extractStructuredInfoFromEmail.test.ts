import { extractStructuredInfoFromEmail } from '../extractStructuredInfoFromEmail';

describe('extractStructuredInfoFromEmail', () => {
  test('extracts fields from website complaint form', () => {
    const html = `
      <html>
        <body>
        Anrede Herr
        Vorname John
        Nachname Doe
        E-Mail john.doe@example.com
        Eure Nachricht an uns
          Dies ist die Nachricht
          Dokumenten-Upload
        </body>
      </html>
    `;

    const result = extractStructuredInfoFromEmail(html);
    expect(result).toEqual(
      expect.objectContaining({
        anrede: 'Herr',
        vorname: 'John',
        nachname: 'Doe',
        email: 'john.doe@example.com',
        message: 'Dies ist die Nachricht',
      })
    );
  });

  test('extracts fields from email complaint', () => {
    const html = `
      <html>
        <body>
          Betreff: [Externe E-Mail] U76 6:25 Uhr am 3.2. ab Belsenplatz
          2. Versuch
          --
          Gesendet mit der GMX Mail App
          Am 03.02.25, 06:33 schrieb Kati Fritzsche <kati.fritzsche@gmx.de>:
          ... es handelte sich um die Haltestelle Belsenplatz.
          --
          Gesendet mit der GMX Mail App
          Am 03.02.25, 06:32 schrieb Kati Fritzsche <kati.fritzsche@gmx.de>:
          Liebes Kundenservice Team,
          Ich konnte heute nicht in meine Bahn einsteigen, da eine Tür öffnete, aber keine Treppen ausfuhr. Die nächstgelegene Tür öffnete gar nicht nach Drücken des Knopfes. Als ich weiter Richtung Spitze des Zuges lief, weil dort ein Fahrgast eingestiegen war, wunk ich dabei Richtung Triebfahrzeug. Statt noch einen Augenblick zu warten (wir waren in Summe nur 2 Fahrgäste am Gleis), verriegelte die Bahn und fuhr weiter. Mir fehlen die Worte wegen dieses unnötigen Frustes und schlechtem Kundenservice. Ich verpasse nun meinen Anschlusszug und stehe unnötig in der Kälte an der Haltestelle.
          Viele Grüsse
          Kati Fritzsche
          --
          Gesendet mit der GMX Mail App
          Rheinbahn AG | Lierenfelder Str. 42 | 40231 Düsseldorf | (H) Lierenfeld Btf
        </body>
      </html>
    `;

    const result = extractStructuredInfoFromEmail(html);
    expect(result).toEqual(
      expect.objectContaining({
        anrede: '',
        vorname: '',
        nachname: '',
        email: '',
        message:
          'U76 6:25 Uhr am 3.2. ab Belsenplatz 2. Versuch -- Gesendet mit der GMX Mail App Am 03.02.25, 06:33 schrieb Kati Fritzsche : ... es handelte sich um die Haltestelle Belsenplatz. -- Gesendet mit der GMX Mail App Am 03.02.25, 06:32 schrieb Kati Fritzsche : Liebes Kundenservice Team, Ich konnte heute nicht in meine Bahn einsteigen, da eine Tür öffnete, aber keine Treppen ausfuhr. Die nächstgelegene Tür öffnete gar nicht nach Drücken des Knopfes. Als ich weiter Richtung Spitze des Zuges lief, weil dort ein Fahrgast eingestiegen war, wunk ich dabei Richtung Triebfahrzeug. Statt noch einen Augenblick zu warten (wir waren in Summe nur 2 Fahrgäste am Gleis), verriegelte die Bahn und fuhr weiter. Mir fehlen die Worte wegen dieses unnötigen Frustes und schlechtem Kundenservice. Ich verpasse nun meinen Anschlusszug und stehe unnötig in der Kälte an der Haltestelle. Viele Grüsse Kati Fritzsche -- Gesendet mit der GMX Mail App',
        metaInformation: '',
        linie: '',
        haltestelle: '',
        richtung: '',
        stadt: '',
        datum: '',
      })
    );
  });

  test('extracts fields from callcenter forwarded complaint', () => {
    const html = `
      <html>
        <body>
          Anrede: 
          Titel: 
          Vorname: Nicol
          Nachname: Klot
          Geburtsdatum: 
          Kundennummer/Abonummer: 
          Abo_Typ: 
          Ticketinhaber: 
          Straße: Duisburgerstr.
          Hausnummer: 291
          PLZ: 47829
          Ort: Krefeld
          Adresse_Zusatz: 
          Kontaktwunsch: schriftlich
          Telefonnummer: 0176 24136159
          E_Mail: keine
          --------------------------
          Datum/Uhrzeit des Vorfalls: 2025-02-05, 15:49 Uhr
          Ort_Vorfall: Krefeld, Am Röttgen
          Linie: 831
          Haltestelle: CHEMPARK Tor 15, Krefeld
          Richtung: Krefeld HPZ
          --------------------------
          Bemerkung: Kunde beschwerte sich über das Fahrverhalten des Busfahrers. Ein Kinderwagen stand im Mehrzweckbereich und dieser schwankte bedenklich hin und her, aufgrund der ungünstigen Fahrweise. Auch telefonierte der Busfahrer und schimpfte mit den Kunden. 
          ___________________________
          i.A. Nina Sternagel
          Sachbearbeitung Kundendialog (K212.500)
          Tel:      + 49 0211 582 1430
          Mobil:  + 49 172 309 7032
          Email:   nina.sternagel@rheinbahn.de
          Rheinbahn AG | Lierenfelder Str. 42 | 40231 Düsseldorf | (H) Lierenfeld Btf
        </body>
      </html>
    `;

    const result = extractStructuredInfoFromEmail(html);
    expect(result).toEqual(
      expect.objectContaining({
        anrede: '',
        vorname: 'Nicol',
        nachname: 'Klot',
        email: '',
        message:
          'Kunde beschwerte sich über das Fahrverhalten des Busfahrers. Ein Kinderwagen stand im Mehrzweckbereich und dieser schwankte bedenklich hin und her, aufgrund der ungünstigen Fahrweise. Auch telefonierte der Busfahrer und schimpfte mit den Kunden.',
        linie: '831',
        haltestelle: 'CHEMPARK Tor 15, Krefeld',
        richtung: 'Krefeld HPZ',
        stadt: 'Krefeld, Am Röttgen',
        datum: '2025-02-05, 15:49',
      })
    );
  });

  test('extracts fields from VRR forwarded complaint', () => {
    const html = `
      <html>
        <body>
           
 
___________________________

i.A. Nina Sternagel
Team Kundendialog (K212.500)
 
Tel:      + 49 0211 582 1956
Email:   kundendialog@rheinbahn.de
 
Von: Witte, Uwe <Uwe.Witte@rheinbahn.de>
Gesendet: Montag, 13. Januar 2025 11:48
An: Kundendialog <Kundendialog@rheinbahn.de>
Betreff: WG: [Externe E-Mail] Weiterleitung VRR an Rheinbahn - MeldungsID 173617
 
 
 
Von: info@vrr.de <info@vrr.de>
Gesendet: Montag, 13. Januar 2025 10:28
An: Rheinbahn <Rheinbahn@rheinbahn.de>
Betreff: [Externe E-Mail] Weiterleitung VRR an Rheinbahn - MeldungsID 173617
 
Liebe Kolleg*innen,
 
zuständigkeitshalber leiten wir Ihnen das bei uns eingegangene Kundenanliegen mit der Bitte um weitere Bearbeitung zu. Der Kundin/ dem Kunden wurde die Weiterleitung bereits mitgeteilt.
 
Für weitere Informationen oder Rückfragen stehen wir Ihnen gerne zur Verfügung.
 
Freundliche Grüße
 
Ihr VRR-Team
 
Verkehrsverbund Rhein-Ruhr AöR

- Fachgruppe Kundenmanagement - 

Augustastraße 1, 45879 Gelsenkirchen

Fon 0209/ 1584 0 

info@vrr.de

---

Vorstand: Oliver Wittke (Sprecher)

Vorsitzender des Verwaltungsrates: Uwe Schneidewind

Sitz der Gesellschaft: Ribbeckstraße 15 (Rathaus), 45127 Essen

USt-Id: DE 250 085 017 - Handelsregister: Amtsgericht Essen, HRA 8767

 

___________________________________________________
 
Von: Nordkap1@web.de
Empfangen am 12.01.2025 um 19:59:54
 
Meldung des Kunden:
 
Meldungs ID: 173617
Rückmeldungswunsch: E-Mail
 
Kundendaten:
Vorname, Name: Benedikt  Lamerz
Straße/Hausnummer:
PLZ/Ort:
Telefon privat: /
Telefon mobil: /
Mail: Nordkap1@web.de
 
Anliegen:
Guten Abend,
der Bus der Linie 746 in Richtung Mettmann ist heute (12.01.2025) an der Bushaltestelle Schöne Aussicht in Wülfrath (Abfahrtszeit 19:45 Uhr) ohne Anzuhalten vorbeigefahren obwohl wir winkend - also sichtbar - an der Bushaltestelle standen.
Eine riesengroße Unverschämtheit vor allem bei diesen Temperaturen!!!
So gewinnen Sie ganz gewiss keine Kunden für den ÖPNV!!!
Wir erwarten eine Stellungnahme hierzu!
 

 





Rheinbahn AG | Lierenfelder Str. 42 | 40231 Düsseldorf | (H) Lierenfeld Btf

            
______________________________________________________

Annette Grabbe - Sprecherin des Vorstands, Arbeitsdirektorin und Finanzvorständin
Michael Richarz - Vorstand Technik und Betrieb
Vorsitzender des Aufsichtsrats: Rolf Tups
Sitz der Gesellschaft: Düsseldorf, Amtsgericht Düsseldorf - HRB 562
 

Datenschutz:
Im Rahmen eines geschäftlichen Austauschs haben wir Ihre Kontaktdaten elektronisch gespeichert, um in Zukunft mit Ihnen in Kontakt treten zu können.
Die Rheinbahn AG, als Verantwortliche für die Erhebung und Verarbeitung Ihrer Daten, nimmt den Schutz Ihrer persönlichen Informationen sehr ernst.
Die personenbezogenen Angaben werden vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie der Datenschutzerklärung behandelt.
Wir weisen darauf hin, dass die Datenübertragung im Internet (z.B. bei der Kommunikation per E-Mail) Sicherheitslücken aufweisen kann.
Ein lückenloser Schutz Ihrer Daten vor dem Zugriff durch Dritte ist nicht möglich.
        </body>
      </html>
    `;

    const result = extractStructuredInfoFromEmail(html);
    expect(result).toEqual(
      expect.objectContaining({
        anrede: '',
        vorname: 'Benedikt',
        nachname: 'Lamerz',
        email: 'Nordkap1@web.de',
        message:
          'Guten Abend, der Bus der Linie 746 in Richtung Mettmann ist heute (12.01.2025) an der Bushaltestelle Schöne Aussicht in Wülfrath (Abfahrtszeit 19:45 Uhr) ohne Anzuhalten vorbeigefahren obwohl wir winkend - also sichtbar - an der Bushaltestelle standen. Eine riesengroße Unverschämtheit vor allem bei diesen Temperaturen!!! So gewinnen Sie ganz gewiss keine Kunden für den ÖPNV!!! Wir erwarten eine Stellungnahme hierzu!',
        linie: '',
        haltestelle: '',
        richtung: '',
        stadt: '',
        datum: '',
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
