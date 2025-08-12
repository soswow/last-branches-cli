#!/usr/bin/env node

const { execSync, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { AutoComplete } = require('enquirer');
const c = require('ansi-colors');

function printUsageAndExit() {
  console.log(
    [
      'last-branches - interactively pick a recent git branch and checkout',
      '',
      'Usage:',
      '  last-branches [-C <dir>] [-n <limit>]',
      '',
      'Options:',
      '  -C <dir>     Run as if git was started in <dir>',
      '  -n <limit>   Max branches to show (default 30)',
      '  -h, --help   Show help',
    ].join('\n')
  );
  process.exit(0);
}

function parseArgs(argv) {
  const args = { dir: process.cwd(), limit: 30 };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      printUsageAndExit();
    } else if (arg === '-C') {
      const next = argv[i + 1];
      if (!next) {
        console.error('Error: -C requires a directory');
        process.exit(2);
      }
      args.dir = path.resolve(next);
      i += 1;
    } else if (arg === '-n') {
      const next = argv[i + 1];
      if (!next || Number.isNaN(Number(next))) {
        console.error('Error: -n requires a numeric limit');
        process.exit(2);
      }
      args.limit = Number(next);
      i += 1;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsageAndExit();
    }
  }
  return args;
}

function ensureGitRepo(dir) {
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(2);
  }
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      stdio: 'ignore',
    });
  } catch {
    console.error(`Not a git repository: ${dir}`);
    process.exit(2);
  }
}

function fetchBranches(dir) {
  const format = '%(refname:short)||%(committerdate:relative)||%(committerdate:iso)';
  const cmd = `git for-each-ref --sort=-committerdate --format=${JSON.stringify(format)} refs/heads/`;
  const output = execSync(cmd, { cwd: dir, encoding: 'utf8' });
  const branches = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, rel, iso] = line.split('||');
      return { name, relative: rel, iso };
    });
  return branches;
}

async function selectBranchInteractive(branches, limit) {
  const shown = branches.slice(0, limit);
  const choices = shown.map((b) => ({
    name: b.name,
    message: `${c.cyan(b.name)}   ${c.dim(b.relative)}`,
    value: b.name,
  }));
  const prompt = new AutoComplete({
    name: 'branch',
    message: c.bold('Pick a branch to checkout'),
    limit: Math.max(5, Math.min(20, shown.length)),
    choices,
    footer: c.dim('Use ↑/↓ to move, type to filter, and press Enter to checkout'),
  });
  const answer = await prompt.run();
  return answer;
}

function doCheckout(dir, branch) {
  console.log(`\n> git checkout ${branch}`);
  const result = spawnSync('git', ['checkout', branch], { cwd: dir, stdio: 'inherit' });
  process.exit(result.status ?? 0);
}

async function main() {
  const { dir, limit } = parseArgs(process.argv);
  ensureGitRepo(dir);
  const branches = fetchBranches(dir);
  if (branches.length === 0) {
    console.log('No local branches found.');
    process.exit(0);
  }
  const selected = await selectBranchInteractive(branches, limit);
  doCheckout(dir, selected);
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});


