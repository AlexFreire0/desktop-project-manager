import { describe, expect, it } from 'vitest';

function tokenize(command: string) {
  return command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((token) => token.replace(/^"(.*)"$/, '$1')) ?? [];
}

describe('quick command parsing', () => {
  it('keeps quoted arguments together', () => {
    expect(tokenize('run --name "Project Desk"')).toEqual(['run', '--name', 'Project Desk']);
  });

  it('does not produce a shell string', () => {
    const tokens = tokenize('npm run dev');
    expect(tokens).toEqual(['npm', 'run', 'dev']);
    expect(tokens).not.toContain('npm run dev');
  });
});
