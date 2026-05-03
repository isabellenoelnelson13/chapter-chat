import { execFileSync } from 'node:child_process';
import { mkdirSync, symlinkSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

if (process.env.EAS_BUILD_PLATFORM !== 'ios') {
  process.exit(0);
}

const shimPath = '/Users/expo/workingdir/bin/pod';

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function findPod() {
  try {
    return run('/bin/zsh', ['-lc', 'command -v pod']);
  } catch {
    return '';
  }
}

let podPath = findPod();

if (!podPath) {
  execFileSync('gem', ['install', 'cocoapods', '-v', '1.16.2', '--no-document'], { stdio: 'inherit' });
  podPath = findPod();
}

if (!podPath) {
  throw new Error('CocoaPods was installed, but the pod executable is still not available.');
}

mkdirSync(dirname(shimPath), { recursive: true });

if (!existsSync(shimPath)) {
  symlinkSync(podPath, shimPath);
}

console.log(`CocoaPods available at ${podPath}`);
