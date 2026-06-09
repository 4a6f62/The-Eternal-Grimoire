# Requirements: D&D Character Manager & VTT Exporter

## 1. Projectdoel

Een client-side webapplicatie voor het beheren van D&D 5e karakters, gebaseerd op 5etools-data, met export-functionaliteit naar VTT's (Foundry, Roll20).

## 2. Functionele Eisen

* **Data-integratie:** Gebruik van 5etools JSON-data voor spells, items, wapens en armor.
* **Character Builder:** Wizard-stijl interface voor level-up keuzes (ASI, Feats, Proficiencies).
* **State Management:** Real-time tracking van HP, resources, spell slots en inventory gewicht.
* **VTT Export:** Genereren van JSON-formaten die compatibel zijn met Foundry VTT (compendium import) en Roll20.
* **UI/UX:** Wisselbare weergave:
* *Sheet View:* Klassieke 5e character sheet lay-out.
* *VTT View:* Dashboard met snelle actieknoppen (macros).
* *Asset Mapping:* Automatische koppeling van items aan Game-icons.net.



## 3. Technische Eisen & Stack

* **Frontend Framework:** React + TypeScript (voor strikte type-safety).
* **Build Tool:** Vite (voor snelle builds).
* **Hosting:** GitHub Pages (Static Site).
* **Opslag:** Browser-native IndexedDB (lokale opslag).
* **Backend (Optioneel/Serverless):** Supabase of Firebase Auth indien cloud-sync vereist is.

## 4. Security by Design

* **Attack Surface:** Minimale footprint door static site hosting (geen server-side code).
* **Integriteit:** Strikte JSON-schema validatie bij elke import/export actie.
* **Sanitization:** Gebruik van `DOMPurify` voor het verwerken van externe JSON-data om XSS via macro-scripts te voorkomen.
* **CSP:** Implementatie van een strikte Content Security Policy (CSP) header.
* **Dependency Audit:** Continue monitoring via `npm audit` of Snyk (SBOM-beheer).
* **Least Privilege:** Geen directe backend-toegang; communicatie verloopt via beveiligde serverless API's.

## 5. Privacy

* **Data Residency:** Alle karakterdata blijft lokaal op het apparaat van de gebruiker (Privacy by Default).
* **GDPR:** Mogelijkheid voor volledige lokale dataverwijdering.
