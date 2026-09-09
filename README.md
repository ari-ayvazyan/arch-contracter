# Arch-Contracter

Lokaler Lastenheft-Editor: Paketbaum, Drag-and-drop, Vertragsumfänge, Fragen, Referenzen und PDF-Druck. Keine Cloud, keine Konten, keine Datenbank und keine externen Frontend-Abhängigkeiten.
<img width="1916" height="950" alt="image" src="https://github.com/user-attachments/assets/192d8f15-b439-47c7-a638-1696cf5c2cb9" />

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
- **Neues Projekt:** Über „+ Neues Projekt“ in der Seitenleiste (unter „Auf Vorlage zurücksetzen“) kann jederzeit ein neues Lastenheft begonnen werden. Dabei stehen zwei Optionen bereit:
  1. *Beispiel-Vorlage:* Startet mit einer exemplarischen Struktur aus Paketen, Anforderungen und Fragen.
  2. *Leeres Lastenheft:* Erstellt ein sauberes Lastenheft nur mit dem Wurzelelement zum freien Neuaufbau.
- **Unlöschbarkeit des Lastenhefts:** Das Wurzelelement des Lastenhefts kann nicht gelöscht werden; der Editor arbeitet stets mit einem aktiven Projekt. Unterelemente (Gruppen, Pakete, Anforderungen) können wie gewohnt über „…“ oder den Detailbereich entfernt werden.
- Änderungen mit „Speichern“ oder Strg+S sichern. Alle Daten werden lokal im Speicher des Browsers (`localStorage`) abgelegt. Rückgängig/Wiederholen betrifft Dokumentänderungen; innerhalb eines Textfelds gilt das native Text-Undo.
- „JSON herunterladen“ lädt den gesamten Datenstand des Lastenhefts als formatiertes JSON auf den Rechner herunter.
- „JSON hochladen“ oder Drag-and-drop einer `.json`-Datei in das Browserfenster lädt ein vorhandenes Lastenheft in den Editor und speichert es im Browser ab.
- „PDF-Vorschau“ öffnet das lineare Lastenheft. Gesamtumfang oder Einzelvertrag wählen, dann „Als PDF drucken“. Im Browserdruckdialog „Als PDF speichern“ auswählen. A4 und 100 % Skalierung nutzen; optionale Browser-Kopf-/Fußzeilen ergänzen Seitenzahlen. Interne Notizen, interne Fragen und Aufwandsschätzungen werden nicht exportiert. Kunde, Versionsnummer und Dokumentdatum werden nicht im PDF ausgegeben.
- „Umfang als PDF“ im Detailbereich exportiert den effektiven Vertragsumfang des ausgewählten Elements, nicht nur dessen Unterbaum.

## Datenspeicherung und gehosteter Betrieb

Die Anwendung wird gehostet betrieben und speichert alle Arbeitsdaten direkt im Browser (`localStorage`). Es werden keine Benutzerkonten oder Cloud-Datenbanken benötigt:

1. **Browser-Speicher:** Beim Öffnen der Anwendung wird der lokal im Browser gespeicherte Stand geladen.
2. **JSON Upload & Download:** Über „↑ JSON hochladen“ (oder Drag-and-drop einer JSON-Datei) und „↓ JSON herunterladen“ können vollständige Lastenheft-Dateien importiert und exportiert werden.
3. **Tab-Synchronisation:** Änderungen, die in einem anderen Tab desselben Browsers gespeichert werden, werden über Browser-Events erkannt und synchronisiert.
4. **Wiederherstellung:** Ungespeicherte Entwürfe werden automatisch im Browser zwischengespeichert und beim erneuten Laden zur Wiederherstellung angeboten.

## Dateien und KI-Bearbeitung

Die Standardvorlage liegt in `data/lastenheft.json`. `lastenheft.schema.json` beschreibt das Format. KIs können diese JSON-Datei ändern und über „JSON hochladen“ bzw. die Testumgebung nutzen.

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

## Prüfung

`npm run check` prüft die JavaScript-Syntax. `npm test` prüft Datenvalidierung, Baumoperationen, Vertragstrennung, Exportfilter und die lokale API einschließlich Konflikterkennung. API-Tests verwenden ausschließlich temporäre Daten.

## Bewusste Grenzen

- PDF-Ausgabe erfolgt über den Browserdruckdialog, nicht über einen separaten PDF-Dienst.
- Keine Angebotskalkulation, digitale Unterschrift oder Benutzerverwaltung.
- Die mitgelieferten Inhalte sind ausdrücklich Beispieldaten entsprechend der funktionalen Vorlage; sie lassen sich im Editor ersetzen.
