import assert from 'node:assert/strict';

/**
 * Extracts the text of a single GitHub Actions workflow step (or any YAML
 * block-sequence item) starting at `marker` (e.g. "- name: Checkout") up to,
 * but excluding, the next block-sequence item at any indentation level.
 *
 * This intentionally avoids depending on a full YAML parser (none of this
 * repository's dependencies are installed at test time) while still letting
 * tests assert on the exact contents of a given step.
 */
export function extractBlock(content, marker) {
  const start = content.indexOf(marker);
  assert.ok(start !== -1, `expected to find "${marker}" in the workflow file`);

  const rest = content.slice(start + marker.length);
  const nextMarkerOffset = rest.search(/\n[ \t]*-[ \t]/);
  const end = nextMarkerOffset === -1 ? rest.length : nextMarkerOffset;

  return marker + rest.slice(0, end);
}