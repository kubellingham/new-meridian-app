/**
 * Kael's morning brief — Collaboration Model §4.2.
 *
 * Once a day, Kael pulls together where things stand and delivers a short
 * note. This module owns three things: generating the brief text (via the
 * generic directed-message path), the once-per-local-day dedup, and the
 * event shape it's stored as. Delivery to the user (the Home card and the
 * chat handoff) lives in the UI.
 *
 * Built generic-ish on purpose: the generation directive is Kael's, but
 * the plumbing (a user-facing TeamEvent, delivered-once, keyed by day)
 * is exactly what a future Sera weekly check-in would reuse.
 */

import { getDirectedMessage } from '@/src/services/claude';
import { makeEventId } from '@/src/services/events';
import type { TeamEvent } from '@/src/types/user-data';

/** Local YYYY-MM-DD for a timestamp — the dedup key is one brief per day. */
export function localDateOf(at: number): string {
  const d = new Date(at);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns today's morning-brief event if one already exists, else undefined. */
export function todaysBrief(events: readonly TeamEvent[]): TeamEvent | undefined {
  const today = localDateOf(Date.now());
  return events.find((e) => e.kind === 'morning-brief' && localDateOf(e.at) === today);
}

/** The most recent morning brief the user hasn't opened yet, if any. */
export function undeliveredBrief(events: readonly TeamEvent[]): TeamEvent | undefined {
  return [...events]
    .filter((e) => e.kind === 'morning-brief' && e.deliveredAt === undefined)
    .sort((a, b) => b.at - a.at)[0];
}

/**
 * The instruction Kael composes his brief against. Never persisted or
 * shown — all the real content comes from the team context in his system
 * prompt (today's plan, recent training, pending events, the user's
 * facts).
 */
const MORNING_BRIEF_DIRECTIVE = `[It's the start of a new day. Give the user your morning brief — a short, in-voice note that pulls together where things stand and what matters today. Reference teammates by name where it's genuinely real: the trainer's plan for today, a nutrition adjustment, something Sera flagged. Keep it to a few lines. If there's honestly little to say yet — new user, no data, nothing logged — a brief, grounded hello is exactly right. Never invent numbers, sessions, or events that aren't in what you already know. This is a note you're leaving them, not a question.]`;

/**
 * Generates the brief text in Kael's voice. Caller persists it as a
 * TeamEvent (see makeMorningBriefEvent) and surfaces it on Home.
 */
export async function generateMorningBrief(userName: string): Promise<string> {
  return getDirectedMessage('kael', userName, MORNING_BRIEF_DIRECTIVE);
}

/** Wraps brief text in the user-facing TeamEvent Kael delivers it as. */
export function makeMorningBriefEvent(text: string): TeamEvent {
  return {
    id: makeEventId(),
    at: Date.now(),
    from: 'kael',
    to: ['kael'],
    kind: 'morning-brief',
    summary: text,
    seenBy: [],
  };
}
