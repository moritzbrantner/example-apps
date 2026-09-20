import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { apps } from './catalog';

const expoRoot = fileURLToPath(new URL('../../expo/', import.meta.url));

function expoAppSlugs(): string[] {
  return readdirSync(expoRoot)
    .filter((entry) => {
      const directory = join(expoRoot, entry);
      return statSync(directory).isDirectory() && existsSync(join(directory, 'package.json'));
    })
    .sort();
}

describe('Pages app catalog', () => {
  test('lists every Expo app exactly once', () => {
    const catalogSlugs = apps.map((app) => app.slug).sort();
    expect(catalogSlugs).toEqual(expoAppSlugs());
    expect(new Set(catalogSlugs).size).toBe(catalogSlugs.length);
  });

  test('keeps navigation metadata complete', () => {
    for (const app of apps) {
      expect(app.name.trim().length).toBeGreaterThan(0);
      expect(app.description.trim().length).toBeGreaterThan(0);
      expect(['everyday', 'fine-arts']).toContain(app.category);
    }
  });
});
