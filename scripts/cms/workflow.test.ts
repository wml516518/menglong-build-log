import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { expect, it } from 'vitest';
type Step = { name: string; id?: string; uses?: string; run?: string; if?: string; env?: Record<string, string>; with?: Record<string, unknown>; 'working-directory'?: string };
type Workflow = { on: Record<string, unknown>; permissions: Record<string, string>; jobs: Record<string, { steps: Step[]; concurrency?: { group: string; 'cancel-in-progress': boolean } }> };
const read = (name: string) => yaml.load(readFileSync(resolve('.github/workflows', name), 'utf8'), { schema: yaml.JSON_SCHEMA }) as Workflow;
it('keeps ordinary CI secret-free and validates content before tests', () => {
  const ci = read('ci.yml');
  expect(ci.on).toHaveProperty('push'); expect(ci.on).toHaveProperty('pull_request');
  expect(ci.permissions).toEqual({ contents: 'read' });
  const runs = ci.jobs['test-and-build'].steps.map(s => s.run).filter(Boolean);
  expect(runs).toEqual(['npm ci', 'npm run content:validate', 'npm run content:check-generated', 'npm test', 'npm run build']);
  expect(JSON.stringify(ci)).not.toContain('secrets.');
});
it('isolates default-branch tools, gates secrets, pins PR checkout and merge', () => {
  const wf = read('cms-publish.yml');
  expect(wf.on).toEqual({ workflow_run: { workflows: ['CI'], types: ['completed'] } });
  expect(wf.permissions).toEqual({ actions: 'read', contents: 'write', 'pull-requests': 'write' });
  const job = wf.jobs.publish;
  expect(job.concurrency?.group).toContain('needs.discover.outputs.pr');
  expect(job.concurrency?.['cancel-in-progress']).toBe(true);
  const steps = job.steps;
  const checkout = steps.filter(s => s.uses?.startsWith('actions/checkout@'));
  expect(checkout[0].with).toMatchObject({ path: 'trusted', ref: '${{ github.event.repository.default_branch }}', 'persist-credentials': false });
  expect(checkout[1].with).toMatchObject({ path: 'cms-data', ref: '${{ steps.guard.outputs.sha }}', 'persist-credentials': false, token: '${{ secrets.CMS_TRANSLATION_TOKEN }}' });
  const guard = steps.findIndex(s => s.id === 'guard');
  expect(guard).toBeGreaterThan(0);
  for (const [index, step] of steps.entries()) {
    if (JSON.stringify(step).includes('secrets.')) expect(index).toBeGreaterThan(guard);
    if (step.run) {
      expect(step['working-directory']).toBe('trusted');
      expect(step.run).not.toContain('${{');
      expect(step.run).not.toMatch(/(?:cd|npm --prefix)\s+.*cms-data/);
    }
  }
  expect(steps.find(s => s.id === 'publish')?.env).toMatchObject({ CMS_TRANSLATION_TOKEN: '${{ secrets.CMS_TRANSLATION_TOKEN }}', DEEPSEEK_API_KEY: '${{ secrets.DEEPSEEK_API_KEY }}' });
  expect(steps.find(s => s.uses?.startsWith('actions/upload-artifact@'))?.if).toContain("steps.publish.outputs.changed == 'true'");
});
