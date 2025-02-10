export const rbgClassifyEmail = (
  text: string
) => `Aufgabe: Analysiere die folgende Nachricht eines Kunden und entscheide, ob sie sich darauf bezieht, dass der Kunde an einer Haltestelle (Bahn, Bus, U-Bahn) stehen gelassen wurde – also der Fahrer nicht gehalten oder an der Haltestelle vorbeigefahren ist.
  Emails die darüber berichten, dass ein Bus / Bahn für einen Fahrgast der bereits mitfuhr nicht gehalten hat um diesen Fahrgast abzusetzen, sollen mit "Nein" beantwortet werden.
  Emails die nicht zu dieser Kategorie gehören, sollen mit "Nein" beantwortet werden.

Hinweise, die auf diesen Fall hindeuten können:

Haltestellenbezug: Erwähnung von Haltestellen (z. B. „Haltestelle Bilker Kirche“, „Haltestelle Universität Südost“, „Haltestelle Pempelforter“, „Haltestelle Haan Pütt“, „Vautierstr.“ etc.).
Formulierungen: Ausdrücke wie „stehen gelassen“, „vorbeifuhr“, „ohne zu halten“, „fährt an uns vorbei“ oder Hinweise darauf, dass Fahrgäste trotz Warteposition nicht bedient wurden.
Situationsbeschreibung: Konkrete Zeitangaben, situative Details (z. B. „im Regen stehen“, „warten“, „wurde abgeblinkt“, „stehen gelassen“, „Türen nicht geöffnet“) oder Verhaltensbeschreibungen (wie Gesten des Fahrers oder Reaktionen der Fahrgäste).
Unmut/Empörung: Aussagen, die auf Frust, Ärger oder Empörung über das Verhalten des Fahrers hinweisen.

Beispiele für Beschwerden, die in diese Kategorie fallen:
- "Sehr geehrte Damen und Herren, heute, sogar gerade (Freitag, den 31.01.2025 um 12.23 Uhr) standen eine junge Dame mit einem Kinderwagen und ich an der Haltestelle Bilker Kirche in Düsseldorf und warteten auf den Bus 723 Richtung D-Eller, als der Busfahrer einfach ohne zu halten an uns vorbeifuhr. Man sah uns beiden an, dass wir auf diesen Bus warteten."
- "Hallo. Es ist jetzt 15:27h und stehe an der Haltestelle Universität Südost. Gerade eben kam der Bus 835 Richtung Belsenplatz. Der Bus fuhr zwar langsamer, schaute kurz, machte aber keine Anstalten zu bremsen. Mein Winken wurde mit undeutbaren Gesten erwidert. Dann gab er Gas. 5 weitere Fahrgäste und ich sahen uns ungläubig an, dessen was gerade passierte."
- "Sehr geehrte Damen und Herren, Ich stehe gerade an der Haltestelle Pempelforter im Regen. Ca. 13 Uhr und ihre nette Mitarbeiterin fährt mit voller Absicht an uns vorbei! Was soll das? Das ist mir noch nie passiert! Kundenfreundlich schaut anderes aus... Verärgert Grüße B. Blazejczak. Ich bitte um Stellungnahme."
- "Ich bin eben gerade Zeuge geworden von der Unfähigkeit eines Busfahrers/in. Der 792 Richtung Sohlingen Ohligs kam um 8:20 an der Haltestelle Haan Pütt an. Ein älterer Herr, der nicht gut zu Fuß war und die Haltestelle noch nicht erreicht hatte, winkte dem Fahrer/in zu, dass er mit wollte. Der Fahrer/in fuhr an die Haltestelle, da dort noch jemand zusteigen wollte. Kurz bevor der ältere Herr den Bus erreichte und noch winkte, wurde der Blinker gesetzt und der Bus fuhr ab. Das nenne ich mal richtig unverschämt. So viel Zeit sollte doch wohl sein. Kann man keine Rücksicht auf ältere Menschen nehmen?????"
- "Hallo, heute Samstag, 25.1., ist der Bus 733 an der Vautierstr. um 18.36 bzw. 18.37 direkt an der Haltestelle an uns vorbeigefahren. Danke, dass wir dadurch unseren Termin verpasst haben. Beste Grüße, Anett Wesoly."
- "Die Bahn (geplante Abfahrt am Haus Meer: 10:01 Uhr) stand sogar noch an der Haltestelle, als die Passagiere des Busses auf den Bahnsteig liefen, der Bahnfahrer hat jedoch die Türen nicht mehr geöffnet und ist dann losgefahren"

Anweisung:
Lies die folgende Nachricht und entscheide, ob sie das Thema "Stehen gelassen werden an der Haltestelle" abdeckt. Antworte mit:

"Ja" – wenn die Nachricht darauf hindeutet, dass der Kunde an einer Haltestelle stehen gelassen wurde oder ein Bus/Train/andere Verkehrsmittel ohne Halt vorbeigefahren ist.
"Nein" – falls die Nachricht nicht in diese Kategorie fällt.

Antworte nur mit "Ja" oder "Nein".

Analysiere nun den folgenden Text:
Text: ${text}`;
