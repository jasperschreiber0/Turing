// Grudge message generation — extracted so API routes can import it
// without triggering the full agent startup (which calls start() at module level).

import Anthropic from '@anthropic-ai/sdk'
import fs        from 'fs'
import path      from 'path'

const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts')

export async function generateGrudgeMessage(
  session: { ai_codename: string; ai_was_caught: boolean; rounds_survived: number },
  catcherCodename: string | null,
  allCodenames:    string[],
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const template  = fs.readFileSync(path.join(PROMPTS_DIR, 'grudge.md'), 'utf8')

  const prompt = template
    .replace(/\{\{AI_CODENAME\}\}/g,                   session.ai_codename)
    .replace(/\{\{AI_WAS_CAUGHT\}\}/g,                 session.ai_was_caught ? 'CAUGHT' : 'SURVIVED')
    .replace(/\{\{CATCHER_CODENAME\}\}/g,              catcherCodename ?? 'someone')
    .replace(/\{\{CLOSEST_CODENAME\}\}/g,              catcherCodename ?? 'someone')
    .replace(/\{\{ROUNDS_SURVIVED\}\}/g,               String(session.rounds_survived))
    .replace(/\{\{ALL_CODENAMES\}\}/g,                 allCodenames.join(', '))
    .replace(/\{\{PRIOR_ENCOUNTER_COUNT\}\}/g,         '0')
    .replace(/\{\{ALL_CODENAMES_EXCLUDING_SLEEPER\}\}/g, allCodenames.join(', '))

  const res = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 120,
    messages:   [{ role: 'user', content: prompt }],
  })
  return res.content[0].type === 'text' ? res.content[0].text.trim() : ''
}
