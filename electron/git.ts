import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitInfo = {
  isRepo: boolean;
  root?: string;
  branch?: string;
  changes: number;
  ahead: number;
  behind: number;
  lastCommit?: string;
};

async function runGit(args: string[], cwd: string) {
  const result = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
}

export async function inspectGit(cwd: string): Promise<GitInfo> {
  try {
    const root = await runGit(['rev-parse', '--show-toplevel'], cwd);
    const branch = await runGit(['branch', '--show-current'], cwd);
    const status = await runGit(['status', '--porcelain'], cwd);
    let ahead = 0;
    let behind = 0;
    try {
      const counts = await runGit(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], cwd);
      const [behindText, aheadText] = counts.split(/\s+/);
      behind = Number(behindText) || 0;
      ahead = Number(aheadText) || 0;
    } catch {
      // A branch without an upstream is valid; leave sync counts at zero.
    }
    let lastCommit = '';
    try {
      lastCommit = await runGit(['log', '-1', '--pretty=%h %s'], cwd);
    } catch {
      // Empty repositories do not have a commit yet.
    }
    return { isRepo: true, root, branch: branch || 'detached', changes: status ? status.split('\n').length : 0, ahead, behind, lastCommit };
  } catch {
    return { isRepo: false, changes: 0, ahead: 0, behind: 0 };
  }
}

export type GitAction = 'status' | 'add' | 'commit' | 'fetch' | 'pull' | 'push' | 'checkout' | 'branch';

export async function runGitAction(action: GitAction, cwd: string, value?: string) {
  const args: string[] = action === 'status'
    ? ['status', '--short', '--branch']
    : action === 'add'
      ? ['add', '--all']
      : action === 'commit'
        ? ['commit', '-m', value?.trim() || 'Update project']
        : action === 'checkout'
          ? ['checkout', value?.trim() || '']
          : action === 'branch'
            ? ['switch', '-c', value?.trim() || '']
            : [action];
  if ((action === 'checkout' || action === 'branch') && !value?.trim()) {
    throw new Error(`${action} requires a branch name`);
  }
  return runGit(args, cwd);
}
