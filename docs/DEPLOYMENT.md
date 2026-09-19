# VS Code / Railway DB / Vercel deployment

## Local

```bash
npm install
copy .env.example .env.local
# edit .env.local and add DATABASE_URL + AUTH_SECRET + DEV_AUTH_*
npm run verify:db
```

Run `db_extensions.sql` once in the Railway PostgreSQL SQL console. Then bootstrap the first admin and start Next.js:

```bash
npm run bootstrap:admin -- --email admin@ditrinity.com --name "IRMS Admin"
npm run dev
```

Open `http://localhost:3000`.

## Vercel

Create a Vercel project from this repository and add the same environment variables in Project Settings. Set `APP_URL` and `NEXTAUTH_URL` to the deployed URL. For Entra, register the callback:

`https://YOUR-DOMAIN/api/auth/entra/callback`

## Power BI

The service principal must have access to the Power BI workspace/report and tenant settings must allow the chosen embed model. The app will fail closed with `POWERBI_NOT_CONFIGURED` instead of rendering fake data.

## Zoho

When Zoho credentials are unavailable, do not fabricate employee/leave data. Use the Integrations → Zoho test-sync adapter with an actual response payload. Once the corporate Zoho OAuth setup is approved, replace the test adapter with the live endpoint adapter and preserve the same normalized tables/idempotency strategy.
