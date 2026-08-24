// Hues spaced around the wheel so chart lines stay distinguishable.
// Keep a single purple — indigo + violet look identical on a dark chart.
const PLAYER_PALETTE = [
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

function normalizeHex(color) {
  return String(color || '').trim().toLowerCase();
}

function colorForIndex(index) {
  return PLAYER_PALETTE[((index % PLAYER_PALETTE.length) + PLAYER_PALETTE.length) % PLAYER_PALETTE.length];
}

function distinctColorsByUserId(users) {
  const ids = [...new Set(users.map((u) => u.user_id ?? u.id))].sort((a, b) => a - b);
  const indexById = new Map(ids.map((id, i) => [id, i]));
  return users.map((user) => {
    const id = user.user_id ?? user.id;
    return {
      ...user,
      color: colorForIndex(indexById.get(id) ?? 0),
    };
  });
}

function nextUnusedColor(existingColors) {
  const used = new Set((existingColors || []).map(normalizeHex));
  const unused = PLAYER_PALETTE.find((c) => !used.has(normalizeHex(c)));
  return unused || colorForIndex(used.size);
}

module.exports = {
  PLAYER_PALETTE,
  colorForIndex,
  distinctColorsByUserId,
  nextUnusedColor,
};
