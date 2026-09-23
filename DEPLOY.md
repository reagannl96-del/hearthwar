# Putting Hearthwar online

One shared world, Google sign-in, on your own domain. Three free-or-cheap services:

| Piece | Service | What it does | Cost |
|---|---|---|---|
| Website | **Vercel** | Serves the game on your domain | Free |
| Game server | **Railway** | Runs the one world 24/7, talks to players live | ~$5/month |
| Accounts + saves | **Supabase** | Google sign-in, stores the world | Free |

Follow the steps in order. Every value you copy is used in a later step, so keep a
notepad open. Nothing secret ever goes into the code or the repo.

---

## 1. Push the code to GitHub

In a terminal in this folder:

```
gh auth login
```

Pick GitHub.com → HTTPS → "Login with a web browser". Then tell Claude it's done,
or run the commands below yourself:

```
gh repo create hearthwar --public --source . --push
```

## 2. Supabase: the database and sign-in

1. Go to https://supabase.com → **New project**. Pick any name, a strong database
   password, and the region closest to you. Wait ~2 minutes for it to start.
2. **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, click **Run**.
3. **Project Settings → API**. Copy these to your notepad:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` (safe for the browser)
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (**secret**: only goes to Railway)

## 3. Google sign-in

1. Go to https://console.cloud.google.com → create a project (e.g. "Hearthwar").
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in the app
   name and your email, save. Under **Audience**, click **Publish app** so anyone can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
     (your Supabase Project URL + `/auth/v1/callback`)
   - Copy the **Client ID** and **Client secret**.
4. Back in Supabase: **Authentication → Sign In / Providers → Google** → enable it,
   paste the Client ID and secret, save.
5. Supabase **Authentication → URL Configuration**:
   - **Site URL**: `https://play.yourdomain.com` (your real domain)
   - **Redirect URLs**: add `https://play.yourdomain.com` and your
     `https://your-project.vercel.app` address (and `http://localhost:5173` for testing).

## 4. Railway: the game server

1. Go to https://railway.com → **New Project → Deploy from GitHub repo** → pick `hearthwar`.
   Railway finds the `Dockerfile` and builds the server automatically.
2. Open the service → **Variables** and add (see `.env.server.example`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` from step 2
   - `ALLOWED_ORIGINS` = `https://play.yourdomain.com,https://your-project.vercel.app`
   - optional world settings: `WORLD_NAME`, `WORLD_SPEED` (150), `WORLD_UNIT_SPEED` (80),
     `WORLD_SIZE` (120), `WORLD_AI` (20), `WORLD_DIFFICULTY` (normal)
3. **Settings → Networking → Generate Domain**. You get something like
   `hearthwar-production.up.railway.app`. Your game server URL is
   `wss://hearthwar-production.up.railway.app` (note **wss://**).
4. Open `https://hearthwar-production.up.railway.app` in a browser. It should say
   `Hearthwar server: The Ashen Marches, 0 players`.

## 5. Vercel: the website on your domain

1. https://vercel.com → **Add New → Project** → import the `hearthwar` repo.
   Framework: **Vite** (detected). Build command `npm run build`, output `dist`.
2. **Environment Variables** (see `.env.example`):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
   - `VITE_GAME_SERVER_URL` = `wss://hearthwar-production.up.railway.app`
3. **Deploy**.
4. **Settings → Domains → Add** `play.yourdomain.com` (or the bare domain). Vercel
   shows the DNS record to create. Add it where your domain's DNS lives
   (usually a `CNAME` to `cname.vercel-dns.com`). It goes live within minutes to hours.

Open your domain, click **Sign in with Google**, then **Enter the realm**. You're in.

---

## Running the world

- **Everyone shares one world.** It runs around the clock, AI rulers included.
- **Saves**: every 30 seconds, and on every server restart or redeploy, into Supabase.
- **Start a fresh world**: in Railway set `RESET_WORLD=yes`, redeploy, then **remove
  the variable** (or every restart would wipe the world again).
- **Change world speed/size**: those settings only apply to a new world.
- **Offline single-player** still works on the same site ("Or play alone").

## Testing multiplayer on your own computer

No accounts needed. This uses a fake sign-in and saves the world to `world-dev.json`:

```
npm run server:local     # terminal 1: game server on ws://localhost:8787
npm run dev:online       # terminal 2: website with "Sign in (local test)"
```

Open a second browser (or a private window) to play as a second person.
