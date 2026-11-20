# Felis große Reise 👑

Geburtstagsspiel fürs Handy: sechs Minispiele mit Storyline, jedes bringt ein Puzzleteil und ein Hinweiswort.

- Live: https://jno-devhub.github.io/feli_geburtstagsspiel_2026/
- Spezifikation: [docs/SPEC.md](docs/SPEC.md)

## Entwicklung

```powershell
npm install
npm run check
npm run smoke
```

| Befehl | Zweck |
| --- | --- |
| `npm run build` | baut nach `dist/` |
| `npm run dev` | baut bei jeder Änderung neu |
| `npm test` | Unit-Tests mit `node:test` |
| `npm run lint` | ESLint |
| `npm run smoke` | kompletter Durchlauf im Browser (390×844) mit Bildschirmfotos in `screenshots/` |

Debug-Modus: `?debug=1` an die URL hängen. Mit `?debug=1&go=game:3` startet direkt ein Spiel (Kapitel zählen ab 0).
