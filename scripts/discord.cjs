// Posts a patch-notes message to the game's Discord channel.
//
//   node scripts/discord.cjs notes.md "Title of the update"
//
// The webhook URL lives in .env.discord (DISCORD_WEBHOOK=...), which is never committed.
// The notes file is plain markdown; long notes are split across several embeds.

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.discord');
const url = (fs.readFileSync(envFile, 'utf8').match(/^DISCORD_WEBHOOK=(.+)$/m) || [])[1]?.trim();
if (!url) throw new Error('No DISCORD_WEBHOOK in .env.discord');

const [file, title = 'Hearthwar update'] = process.argv.slice(2);
const text = fs.readFileSync(file, 'utf8').trim();

// an embed holds up to 4096 characters: split on blank lines
const parts = [];
let cur = '';
for (const para of text.split(/\n\s*\n/)) {
  if (cur && cur.length + para.length + 2 > 3900) { parts.push(cur); cur = ''; }
  cur += (cur ? '\n\n' : '') + para;
}
if (cur) parts.push(cur);

const embeds = parts.map((d, i) => ({
  title: i === 0 ? title : undefined,
  description: d,
  color: 0xc9892a,
  timestamp: i === parts.length - 1 ? new Date().toISOString() : undefined,
}));

(async () => {
  for (let i = 0; i < embeds.length; i += 10) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Hearthwar Herald', embeds: embeds.slice(i, i + 10) }),
    });
    if (!res.ok) throw new Error(`Discord said ${res.status}: ${await res.text()}`);
  }
  console.log(`posted ${embeds.length} embed(s)`);
})();
