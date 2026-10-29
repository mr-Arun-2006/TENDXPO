# TenDo setup

## 1. Run locally
```
bun install        # or npm install
cp .env.example .env   # set GEMINI_API_KEY
bun run dev            # http://localhost:3000
```

## 2. Firebase console (fixes sign-in and database errors)
Project: `tenderxpo`

1. **Authentication > Sign-in method**: enable **Email/Password** and **Google**.
2. **Authentication > Settings > Authorized domains**: add every host you serve from (for example `localhost`, your Cloud Run domain, your custom domain). Missing domains cause `auth/unauthorized-domain`.
3. **Firestore Database**: create the **(default)** database (Build > Firestore Database > Create database).
4. Deploy the rules (they are default-deny and per-user):
   ```
   npx firebase-tools deploy --only firestore --project tenderxpo
   ```
   `firebase.json` already points at `firestore.rules` for the default database.

## 3. Data sources
| Source | Access |
| --- | --- |
| TED (EU) | Live via public API, labelled "Official notice" with a link to the original |
| CPPP, GeM, SAM.gov | Link-out only (no public API or login required). Not scraped |
| Everything else | Labelled "Sample" or "Entered by you" |

## 4. API security
Protected routes require `Authorization: Bearer <Firebase ID token>`. The server verifies the token against Google's public keys, so no service account is needed.
