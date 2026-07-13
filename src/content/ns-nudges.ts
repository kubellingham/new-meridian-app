/**
 * One quiet afternoon nudge per nutrition specialist — shown on Home
 * when nothing has been logged by midday. Static, in each locked voice,
 * written to be true whenever shown (no invented specifics). The live
 * conversation stays in the Diet Corner; this is a door, not a chat.
 */

import type { CharacterId } from '@/src/content/characters';

export const NS_QUIET_DAY_NUDGES: Partial<Record<CharacterId, string>> = {
  nneka: "The day's gone quiet on me, my dear. What have you eaten? Even small small counts.",
  kavya: 'Nothing on the board since morning. Haan — what did I miss? Tell me properly.',
  haruki: 'The log is quiet today. The table was not, I think. Tell me.',
  sofia: "Nothing logged yet, cariño — and I know that's not the whole story. What did you eat?",
  yasmin: 'The day is looking very empty in here, habibti. Come, tell me what I missed.',
  elena: "Éla — nothing logged since morning? I don't believe you fasted. Come tell me.",
  jordan: "Log's been quiet since morning. No confession booth — just tell me what you had.",
  'mei-lin': 'Hm. Nothing logged since morning. A day with no food has no soul — what did I miss?',
};
