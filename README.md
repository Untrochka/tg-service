# tg-notion-sync

Listens to the Telegram chat/channel where your bank sends transaction notifications, parses
them, and automatically creates records in the **🧾 Операции** ("Operations") database of your
Financial OS in Notion. You still add the category, description, and receipt photo yourself
afterward — this service only records that a transaction happened.

## Why user session (GramJS), not the Bot API

Telegram's Bot API can't read messages from **another** bot (your bank's) in a private chat or
channel unless your own bot has been added there as an admin with the right permissions — and
for private bank chats that's often not possible at all. So the service connects as **your own
personal account** instead (via the `telegram` / GramJS library, the same MTProto protocol the
official app uses). That means it sees exactly what you see, including messages from the bank's
bot.

⚠️ The session string is equivalent to full access to your account. Keep `.env` on your server
only — never publish it or commit it to git (already covered by `.gitignore`).

---

## 1. Install dependencies

```bash
cd tg-notion-sync
npm install
cp .env.example .env
```

## 2. Telegram API keys

Go to https://my.telegram.org → **API development tools** → create an application → copy
`api_id` and `api_hash` into `.env` (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`).

## 3. Log in (once)

```bash
npm run login
```

You'll enter your phone number, the code Telegram sends you, and your 2FA password if you have
one set. A long string prints to the console — paste it into `.env` as `TELEGRAM_SESSION`.

## 4. Find the chat/channel

```bash
npm run list-chats
```

Find the channel or chat your bank sends notifications to in the list, and copy its `@username`
(if public) or numeric `id` into `.env` → `TARGET_CHAT`. If it's a direct chat with a bot (the
bank messages you directly), you'll see a line like
`[user/bot] HumoBank | id: 6392... | @HumoBankBot` — use the id or username from there.

## 5. Notion integration

1. Go to https://www.notion.so/my-integrations → **New integration** → Internal.
2. Copy the **Internal Integration Token** → `.env` → `NOTION_TOKEN`.
3. Open your **🧾 Операции** database in Notion → `•••` (top right) → **Connections** → connect
   the integration you just created. Skip this and writes will fail (Notion returns a 404).
4. `NOTION_OPERATIONS_DATABASE_ID` — open your **🧾 Операции** database in the browser and copy
   the 32-character ID from the URL (between the last `/` and `?`) into `.env`.

## 6. Card-to-account mapping

In `.env`, the `CARD_TO_ACCOUNT` variable is a comma-separated list of `last4digits:accountPageId` pairs:

```
CARD_TO_ACCOUNT=1234:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,5678:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
```

The account page ID is grabbed the same way as the operations database ID — open the account in
your **💳 Счета** ("Accounts") database and copy the ID from the URL. If a transaction's card
isn't in any pair, `DEFAULT_ACCOUNT_ID` is used instead (also an account page ID, e.g. "Cash").

## 7. Check it locally

```bash
npm test              # parser unit tests (node --test, nothing extra to install)
npm run test-parse   # check that the parser understands YOUR bank's specific format
npm start             # run the service (Ctrl+C to stop)
```

Send or wait for a test notification from your bank — a line like
`✅ [Расход] Оплата — Coffee Point: -45000 UZS -> https://notion.so/...` will show up in the
console, and the record will appear in the Operations database.

---

## Deploying it 24/7

### Option A: Fly.io (recommended — simple, ~$2/month)

The simplest path, no VPC/subnet/SSH-key setup like Oracle Cloud requires. No "Out of capacity"
issues either — this uses the regular shared-CPU pool, not the scarce ARM cores.

**Cost:** for a lightweight process like this (256MB RAM, minimal traffic) — roughly
**$1.94–2.10/month**, billed strictly by usage, no mandatory monthly plan fee.

**Steps:**

1. Sign up at https://fly.io (GitHub sign-in works — one click, no forms)

2. Install `flyctl` (Fly's CLI):
   ```bash
   # macOS
   brew install flyctl
   ```

3. Log in:
   ```bash
   fly auth login
   ```
   A browser window opens — just confirm.

4. From the project folder (where `Dockerfile` and `fly.toml` already live), run:
   ```bash
   fly launch --no-deploy
   ```
   Accept the suggested app name (or pick your own), choose the **fra** (Frankfurt) region if it
   isn't picked automatically, and decline adding Postgres/Redis (not needed).

   ⚠️ `fly launch` writes an `app = 'your-name'` line back into `fly.toml` — and `fly.toml` is
   tracked by git, so that line will end up in a commit. The app name is effectively its public
   URL (`<name>.fly.dev`). If the repo is public, **remove that line before committing** and use
   the `--app` flag instead (see steps 7 and 9).

5. Push the secrets from `.env` into Fly (they never go into the Docker image — stored separately
   and encrypted):
   ```bash
   fly secrets set \
     TELEGRAM_API_ID=your_id \
     TELEGRAM_API_HASH=your_hash \
     TELEGRAM_SESSION=your_session \
     TARGET_CHAT=your_chat \
     NOTION_TOKEN=your_token \
     NOTION_OPERATIONS_DATABASE_ID=your_database_id \
     CARD_TO_ACCOUNT=your_card_and_accounts
   ```
   (Pull the TELEGRAM_API_ID/API_HASH/SESSION and TARGET_CHAT values from your local `.env`,
   which you've already set up and verified via `npm run login` / `npm run list-chats`.)

6. Create a volume to persist `data/state.json` (otherwise the service "forgets" which messages
   it already processed every time the container restarts):
   ```bash
   fly volumes create tg_notion_data --size 1 --region fra
   ```

7. Deploy (use your actual app name — the one that used to be in `app = '...'` before you removed
   it from `fly.toml`):
   ```bash
   fly deploy --app your-app-name
   ```
   To avoid typing `--app` every time, set it once as a shell environment variable
   (`export FLY_APP=your-app-name` in `~/.zshrc` or `~/.bashrc`) — then plain `fly deploy` works.

8. Check it's running:
   ```bash
   fly logs --app your-app-name
   ```
   You should see "✅ Connected to Telegram" and "👂 Service started...".

9. Need to change something (like TARGET_CHAT)? Just `fly secrets set ...` again — Fly redeploys
   automatically with the new values.

**Useful commands:**
```bash
fly status        # app status
fly logs           # live logs
fly machine restart # restart if it's stuck
```

### Auto-deploy on push to main (already set up)

`.github/workflows/fly-deploy.yml` deploys to Fly.io on every push to `main`/`master` — it never
touches the app's secrets (`.env`), those already live in Fly separately (step 5 above). You need
to add two secrets once, under GitHub repo → **Settings → Secrets and variables → Actions**:

- `FLY_API_TOKEN` — get it via `fly tokens create deploy`
- `FLY_APP_NAME` — the same app name that was removed from `fly.toml`

Without `FLY_APP_NAME`, the Actions deploy fails with "no app specified" — that's intentional, so
the app name is never sitting in plain text in a public repository.

### Option B: Oracle Cloud Always Free (100% free, but more involved)

A real VM, free forever — but the signup and network setup (VCN/subnet/SSH keys) is more
involved, plus ARM instances in popular regions frequently run into "Out of capacity."

---

## Project structure

```
tg-notion-sync/
├── src/
│   ├── config.js       # reads .env
│   ├── parser.js       # parses bank message text
│   ├── parser.test.js  # parser tests (node --test, no extra dependencies)
│   ├── notion.js       # writes the operation to Notion
│   ├── login.js        # one-time Telegram login
│   ├── list-chats.js   # finds the target channel/chat's ID
│   ├── listener.js     # the main process
│   └── test-parse.js   # manual check of the parser against your own message format
├── data/state.json     # last processed message ID (created automatically)
├── .env.example
└── package.json
```

## What the service does and doesn't do

✅ Fills in automatically: Название (Title), Дата (Date), Тип (Type: Доход/Расход/Перевод —
Income/Expense/Transfer), Сумма (Amount), Валюта (Currency), Счёт (Account, by card number),
Комментарий (Comment: place, card, time, balance after the transaction).

❌ Leaves alone (you fill these in yourself in Notion): Категория (Category),
Обязательный/Спонтанный (Essential/Impulse), Чек (Receipt photo), Теги (Tags). That's
deliberate — the service has no way to infer "what you actually spent it on" from a terminal name.
