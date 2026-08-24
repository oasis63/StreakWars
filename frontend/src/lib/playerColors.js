// Hues spaced around the wheel so chart lines stay distinguishable.
// Keep a single purple — indigo + violet look identical on a dark chart.
export const PLAYER_PALETTE = [
  '#4D96FF', // blue
  '#FF5DA2', // magenta
  '#2EC27E', // green
  '#F5C542', // gold
  '#FF9A3C', // orange
  '#C77DFF', // purple (only one)
  '#FF5A5A', // red
  '#2EC4B6', // teal
  '#8BD346', // lime
];

export function withDistinctPlayerColors(leaderboard) {
  if (!leaderboard || leaderboard.length === 0) return leaderboard;
  const ids = [...new Set(leaderboard.map((u) => u.user_id))].sort((a, b) => a - b);
  const indexById = new Map(ids.map((id, i) => [id, i]));
  return leaderboard.map((user) => ({
    ...user,
    color: PLAYER_PALETTE[(indexById.get(user.user_id) ?? 0) % PLAYER_PALETTE.length],
  }));
}
