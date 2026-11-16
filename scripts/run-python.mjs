#!/usr/bin/env node
// Runs Python from the project's virtual environment when one exists, so the
// same npm scripts work on Windows (.venv\Scripts\python.exe) and on
// Linux/macOS hosting (.venv/bin/python).
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';

const venvCandidates = ['Scripts/python.exe', 'bin/python'];
const venv = venvCandidates
  .map(relative => `.venv/${relative}`)
  .find(candidate => existsSync(candidate));
const fallback = process.platform === 'win32' ? 'py' : 'python3';
const python = venv || fallback;

const child = spawn(python, process.argv.slice(2), {stdio: 'inherit'});
child.on('error', error => {
  console.error(`Could not start Python (${python}): ${error.message}`);
  console.error('Create a virtual environment first: python -m venv .venv');
  process.exit(1);
});
child.on('exit', code => process.exit(code === null ? 1 : code));
