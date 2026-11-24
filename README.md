# Finanzas de casa (HomeCheck)

App web instalable (PWA) para llevar las cuentas del hogar entre dos personas, con datos compartidos en tiempo real (Firebase).

- **Publicada en:** https://robertrull11.github.io/homecheck/
- **Cada cambio en `main` se publica solo** (GitHub Actions → GitHub Pages).
- Configuración de Firebase y miembros del hogar: `src/config.js`.
- Reglas de seguridad de la base de datos: `firestore.rules` (se pegan en la consola de Firebase).

## Estructura
- `src/` — la app (React + Tailwind).
- `public/` — manifest y service worker (los iconos se generan al publicar).
- `scripts/` — construcción (`build.mjs`) y generación de iconos (`icons.mjs`).
