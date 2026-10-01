# DUELVANTA – B07 Geschäftsmodellentscheidungen L07-01 (Fortsetzung 14)

Stand: 15.09.2026

Status: **B07 OFFEN / BLOCKIERT – interne Geschäftsmodellfestlegung, keine Rechtsfreigabe**

## Entscheidung L07-01/35 – Teilbare Angebote

- Release 1 muss das Teilen öffentlicher Angebote unterstützen.
- Jedes Angebot erhält einen öffentlichen, teilbaren DUELVANTA-Link.
- Auf unterstützten Mobilgeräten soll die native Teilen-Funktion genutzt werden; zusätzlich gibt es einen Fallback zum Kopieren des Links.
- Geteilte Links sollen eine geeignete Vorschau mit Kartenbild, Kartenname, Preis und DUELVANTA-Branding erzeugen.
- Für Instagram soll zusätzlich eine Story-taugliche Share-Karte vorgesehen werden.
- Beim Teilen dürfen keine nicht ohnehin öffentlich vorgesehenen Identitäts-, Adress- oder Kontaktdaten des Verkäufers offengelegt werden.
- Die Funktion darf nicht dazu genutzt werden, den bereits festgelegten integrierten Zahlungs- und Provisionsprozess zu umgehen.

### Technische Folge

Spätere Implementierung über öffentliche Listing-URL, Web Share API mit Link-Fallback, Open-Graph-Metadaten und Story-Share-Asset. Keine Produktcode-Änderung im aktuellen B07-Entscheidungsschritt.

### Externe Prüfung

Vor Release sind insbesondere Datenschutz, öffentlich sichtbare Verkäuferinformationen, Plattformregeln sowie die konkrete Social-Sharing-Darstellung zu prüfen.

**B07-Status: unverändert OFFEN / BLOCKIERT.**