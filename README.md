# TURING — Phase 0 Scaffold

## Quick start

```bash
# 1. Copy env
cp .env.example .env.local
# Fill in your Supabase + Anthropic keys

# 2. Install
npm install

# 3. Run schema
# Paste schema.sql into Supabase SQL editor

# 4. Start
npm run dev
```

## Day by day

| Day | Task |
|-----|------|
| 1 | ✅ Scaffold done — add your .env.local keys |
| 2 | Add Bebas Neue font to /public/fonts/ |
| 3 | Test lobby → room → chat in two browser tabs |
| 4 | Iterate /prompts/ai-agent.md until it misdirects |
| 5 | Deploy services/ai-agent to Railway |
| 6 | Test consent screen — confirm row writes to consent_records |
| 7 | Playtest with 3 people |

## File map

```
prompts/
  ai-agent.md     ← THE PRODUCT. Edit this first.
  grudge.md       ← The retention hook. Edit this too.

app/
  (game)/lobby    ← Codename + room join
  (game)/room     ← Live game room

components/
  atmosphere/     ← Noise, scan lines, glitch
  chat/           ← Message reveal, typing indicator
  game/           ← Vote panel, reveal sequence
  ui/             ← Consent overlay

services/ai-agent ← Railway service (deploy separately)
schema.sql        ← Run in Supabase SQL editor
```

## Font note

Download Bebas Neue from Google Fonts and place at:
`public/fonts/BebasNeue-Regular.ttf`

Or update app/layout.tsx to use the Google Fonts import instead.
