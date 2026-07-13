import type { WorkoutSession } from '@/src/types/user-data';

/**
 * Per-exercise progression digest — what the trainer reads at generation
 * time to make load and volume decisions. The team-context "recent
 * training" line is a session-level glance; this is the movement-level
 * detail that lets "add 5 kg to squats" be precise and consistent.
 *
 * Only logged sets count (completed and abandoned sessions both carry
 * real numbers). Grouped by exercise, newest session first.
 */

/** How many recent sessions to look back across per exercise. */
const SESSIONS_LOOKBACK = 4;
/** How many exercises to include (most-recently-trained first). */
const MAX_EXERCISES = 10;

/** One set as a short token: "50kg×8", "12 reps", "45s". */
function formatSetShort(set: {
  weight?: number;
  reps?: number;
  durationSeconds?: number;
}): string {
  if (set.durationSeconds !== undefined) return `${set.durationSeconds}s`;
  if (set.weight !== undefined && set.reps !== undefined) {
    return `${set.weight}kg×${set.reps}`;
  }
  if (set.reps !== undefined) return `${set.reps} reps`;
  if (set.weight !== undefined) return `${set.weight}kg`;
  return 'done';
}

type ExerciseTrend = {
  name: string;
  /** Most-recent-first list of per-session set summaries. */
  sessions: string[];
  /** Sort key: the most recent time this exercise was trained. */
  lastTrainedAt: number;
};

/**
 * Builds the progression digest string, or '' when there's no logged
 * history to show. Safe to append straight into a prompt.
 */
export function buildProgressionDigest(
  recentSessions: WorkoutSession[] | undefined,
): string {
  if (!recentSessions || recentSessions.length === 0) return '';

  const byExercise = new Map<string, ExerciseTrend>();

  for (const session of recentSessions.slice(0, SESSIONS_LOOKBACK)) {
    const when = session.completedAt ?? session.abandonedAt ?? session.startedAt;
    for (const log of session.logs) {
      if (log.sets.length === 0) continue; // nothing logged for this movement
      const key = log.name.trim().toLowerCase();
      const summary = log.sets.map(formatSetShort).join(', ');
      const existing = byExercise.get(key);
      if (existing) {
        existing.sessions.push(summary);
        existing.lastTrainedAt = Math.max(existing.lastTrainedAt, when);
      } else {
        byExercise.set(key, {
          name: log.name,
          sessions: [summary],
          lastTrainedAt: when,
        });
      }
    }
  }

  if (byExercise.size === 0) return '';

  const trends = [...byExercise.values()]
    .sort((a, b) => b.lastTrainedAt - a.lastTrainedAt)
    .slice(0, MAX_EXERCISES);

  const lines = trends.map((t) => {
    // "most recent" then progressively older, so the trainer reads the
    // trajectory left-to-right.
    const [latest, ...older] = t.sessions;
    const olderText = older.length > 0 ? `; before: ${older.join(' | ')}` : '';
    return `- ${t.name}: last ${latest}${olderText}`;
  });

  return `RECENT PER-EXERCISE HISTORY (what they actually logged, most recent first):\n${lines.join('\n')}\n\nUse this to progress load and volume honestly — nudge up when the numbers earned it, hold or back off when they didn't.`;
}
