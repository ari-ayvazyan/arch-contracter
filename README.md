# Arch-Contracter

Lokaler Lastenheft-Editor: Paketbaum, Drag-and-drop, Vertragsumfänge, Fragen, Referenzen und PDF-Druck. Keine Cloud, keine Konten, keine Datenbank und keine externen Frontend-Abhängigkeiten.

## Starten

Voraussetzung: Node.js 20 oder neuer. Im Ordner `start.cmd` doppelklicken oder `npm start` ausführen. Anschließend http://127.0.0.1:4317 öffnen. Der Server ist ausschließlich an die lokale Loopback-Adresse gebunden. Mit Strg+C beenden. Für einen anderen Port die Umgebungsvariable `PORT` setzen.

Die Oberfläche liegt in `dist/index.html`, ergänzt durch lokale CSS- und JavaScript-Dateien. Zum Laden und Speichern der JSON-Datei muss sie über den lokalen Server geöffnet werden, nicht über `file://`. Es ist kein Installations- oder Build-Schritt nötig.

## Benutzung

- Im Baum ein Element auswählen und rechts bearbeiten. Am rechten Kartenrand stehen untereinander Plus, Aufklapppfeil (bei Unterelementen) und „…“. Plus zeigt direkt anklickbare Optionen für Paketgruppe, Arbeitspaket, Anforderung und Abhängigkeit. Anforderungen können nur Abhängigkeiten erhalten. Nach dem Erstellen eines Elements den Titel direkt in der neuen Karte eingeben; Enter oder ein Klick außerhalb übernimmt ihn. Escape behält den anfänglichen Titel bei. Der Pfeil klappt den Ast ein oder aus. „…“ bietet Duplizieren, Export des Vertragsumfangs und Löschen; das Wurzelelement kann nicht dupliziert oder gelöscht werden.
- Im Plus-Menü „Abhängigkeit“ auswählen, dann das benötigte Zielelement im Baum anklicken. Ein vorläufiger Pfeil folgt dem Mauszeiger. Erst der Zielklick legt die Verbindung an; Escape oder „Abbrechen“ verwirft den Vorgang. Selbstverbindungen und doppelte Abhängigkeiten werden nicht angelegt.
- Karten frei ziehen, um ihre Position in der aktuellen Ansicht zu ändern. Diese Positionen werden weder in der JSON-Datei noch im Browser gespeichert. Nach Neuladen gilt wieder die automatische Anordnung; „↺“ bei den Zoom-Steuerungen setzt sie sofort zurück. Der Leistungsumfang und die PDF-Reihenfolge ändern sich durch freies Verschieben nicht.
- Mit Alt+Ziehen auf die Mitte einer Paketgruppe oder eines Arbeitspakets ein Element strukturell dort einordnen. Der obere bzw. untere Rand fügt davor bzw. danach ein (grüne Einfügelinie). Diese Strukturänderungen gehören zu den speicherbaren Dokumentdaten. Alternativ rechts „Übergeordnetes Element“ wählen. Mit ↑ und ↓ die Reihenfolge unter demselben Elternknoten ändern.
- Abnahmekriterien sind direkt bearbeitbare Aufzählungspunkte. Enter erzeugt den nächsten Punkt, mehrzeiliger eingefügter Text wird auf mehrere Punkte verteilt. „+ Kriterium“ ergänzt einen Punkt; × entfernt ihn. Die JSON-Daten bleiben eine Liste von Texten.
- Freie Fläche ziehen, um den Baum zu verschieben. Mausrad/Trackpad verschiebt, Strg+Mausrad zoomt. Unten stehen Zoom, Gesamtansicht und Vollbild bereit.
- Den Griff am linken Rand des Detailbereichs ziehen, um dessen Breite zu ändern. Die Breite wird lokal im Browser gespeichert; ein Doppelklick setzt sie zurück. Mit fokussiertem Griff funktionieren auch die Pfeiltasten (mit Shift in größeren Schritten). Auf schmalen Mobilansichten steht der Detailbereich weiterhin unter dem Baum.
- Einen Namen unter „Vertragsumfang“ vergeben, um einen Teilbaum zu isolieren. Unterelemente erben die Zuordnung. Ein leerer Wert erbt vom Elternknoten; ohne Vorgabe gilt „Hauptvertrag“. Explizite Zuordnungen innerhalb eines Teilbaums bleiben bestehen.
- „Benötigt“ und „Siehe auch“ verbinden Elemente. Abhängigkeiten der Auswahl erscheinen blau mit Richtungspfeil zum benötigten Element, Referenzen blau gestrichelt. Beschriftete Linien und eine nummerierte Verbindungsleiste erklären Quelle und Ziel; ein Klick in der Leiste öffnet das andere Element. Grüne Linien zeigen weiterhin die Baumstruktur.
- Fragen benötigen keinen Typ. Sie bestehen aus Text, Antwort und dem Status offen oder geklärt. Geklärte Fragen bleiben mit ihrer Antwort beim Element erhalten. Das frühere Feld `visibility` ist für neue Fragen nicht erforderlich; vorhandene interne Markierungen werden aus Kompatibilitätsgründen beim PDF-Export weiter berücksichtigt.
- Änderungen mit „Speichern“ oder Strg+S sichern. Rückgängig/Wiederholen betrifft Dokumentänderungen; innerhalb eines Textfelds gilt das native Text-Undo.
- „PDF-Vorschau“ öffnet das lineare Lastenheft. Gesamtumfang oder Einzelvertrag wählen, dann „Als PDF drucken“. Im Browserdruckdialog „Als PDF speichern“ auswählen. A4 und 100 % Skalierung nutzen; optionale Browser-Kopf-/Fußzeilen ergänzen Seitenzahlen. Interne Notizen, interne Fragen und Aufwandsschätzungen werden nicht exportiert.
- „Umfang als PDF“ im Detailbereich exportiert den effektiven Vertragsumfang des ausgewählten Elements, nicht nur dessen Unterbaum.

## Dateien und KI-Bearbeitung

Die einzige Inhaltsquelle ist `data/lastenheft.json`. `lastenheft.schema.json` beschreibt das Format. KIs sollten diese JSON-Datei ändern und die Oberfläche unangetastet lassen.

1. `schemaVersion` bleibt `1`.
2. Genau ein Element vom Typ `document` hat `parentId: null`. Sein Titel und `document.title` sollen identisch sein.
3. IDs sind eindeutig und bleiben bei Umbenennungen stabil. Neue IDs verwenden Buchstaben, Zahlen, `_` und `-`.
4. `parentId` referenziert eine vorhandene ID. Keine Kreise; Anforderungen haben keine Kinder.
5. Die Reihenfolge in `nodes` bestimmt die Reihenfolge von Geschwistern. Gruppen und Pakete können verschachtelt werden.
6. Alle im Schema erforderlichen Felder angeben. Leere Texte als `""`, Listen als `[]`, ungeschätzten Aufwand als `null` speichern.
7. Texte sind Klartext, kein HTML oder Markdown. HTML wird in der Oberfläche und im Export maskiert.
8. `contract` leer lassen, um den Umfang zu erben. Für einen separaten Vertrag an der gewünschten Paketgruppe einen eigenen Namen setzen.
9. `links` enthält gültige `source`-/`target`-IDs. Beim Löschen alle betroffenen Verbindungen entfernen.
10. Nach externer Bearbeitung `npm test` ausführen; die Tests prüfen auch die aktuelle Inhaltsdatei.

Der Editor prüft alle vier Sekunden auf Dateiänderungen. Ohne ungespeicherte Bearbeitung wird der neue Stand übernommen. Bei einem Konflikt verhindert der Server das Speichern über eine veraltete Revision. Den eigenen Entwurf als JSON herunterladen, den Dateistand laden und die gewünschten Änderungen zusammenführen. Es gibt kein automatisches Zusammenführen.

Jeder erfolgreiche Speichervorgang legt den vorherigen Stand in `data/lastenheft.backup.json` ab und ersetzt die Hauptdatei über eine temporäre Datei. Unfertige Bearbeitungen werden zusätzlich lokal im Browser zwischengespeichert und beim erneuten Öffnen zur Wiederherstellung angeboten. Diese Wiederherstellung ersetzt keine Dateisicherung. Externe Werkzeuge sollten vollständige JSON-Dateien atomar schreiben und nicht während eines Speichervorgangs dieselbe Datei überschreiben.

## Prüfung

`npm run check` prüft die JavaScript-Syntax. `npm test` prüft Datenvalidierung, Baumoperationen, Vertragstrennung, Exportfilter und die lokale API einschließlich Konflikterkennung. API-Tests verwenden ausschließlich temporäre Daten.

## Bewusste Grenzen

- PDF-Ausgabe erfolgt über den Browserdruckdialog, nicht über einen separaten PDF-Dienst.
- Keine Angebotskalkulation, digitale Unterschrift oder Benutzerverwaltung.
- Die mitgelieferten Inhalte sind ausdrücklich Beispieldaten entsprechend der funktionalen Vorlage; sie lassen sich im Editor ersetzen.
