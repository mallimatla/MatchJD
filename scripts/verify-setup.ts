/**
 * Setup Verification Script
 *
 * This script verifies that all required environment variables and
 * dependencies are properly configured before running the application.
 *
 * Usage: npx ts-node scripts/verify-setup.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, message: string, warnOnly = false): void {
  results.push({
    name,
    status: condition ? 'pass' : warnOnly ? 'warn' : 'fail',
    message,
  });
}

function checkEnvVar(name: string, required = true): void {
  const value = process.env[name];
  const hasValue = value !== undefined && value !== '';
  check(
    `ENV: ${name}`,
    hasValue,
    hasValue ? 'Set' : required ? 'Missing (required)' : 'Missing (optional)',
    !required
  );
}

function checkFile(filePath: string, description: string): void {
  const exists = fs.existsSync(filePath);
  check(`FILE: ${description}`, exists, exists ? 'Found' : 'Not found');
}

async function main() {
  console.log('\n========================================');
  console.log('  Neurogrid Setup Verification');
  console.log('========================================\n');

  // Load .env file if exists
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
    console.log('Loaded .env.local\n');
  } else {
    console.log('No .env.local found, checking environment variables...\n');
  }

  // 1. Check Environment Variables
  console.log('--- Environment Variables ---\n');

  // Firebase (required)
  checkEnvVar('NEXT_PUBLIC_FIREBASE_API_KEY', true);
  checkEnvVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', true);
  checkEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID', true);
  checkEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', true);
  checkEnvVar('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', true);
  checkEnvVar('NEXT_PUBLIC_FIREBASE_APP_ID', true);

  // Anthropic (required for AI features)
  checkEnvVar('ANTHROPIC_API_KEY', true);

  // Optional
  checkEnvVar('FIREBASE_SERVICE_ACCOUNT', false);

  // 2. Check Required Files
  console.log('\n--- Required Files ---\n');

  checkFile('package.json', 'Root package.json');
  checkFile('next.config.js', 'Next.js config');
  checkFile('tailwind.config.js', 'Tailwind config');
  checkFile('firebase.json', 'Firebase config');
  checkFile('firestore.rules', 'Firestore security rules');
  checkFile('functions/package.json', 'Functions package.json');
  checkFile('functions/src/index.ts', 'Functions entry point');

  // 3. Check Source Directories
  console.log('\n--- Source Directories ---\n');

  checkFile('src/app', 'App Router directory');
  checkFile('src/components', 'Components directory');
  checkFile('src/lib', 'Library directory');
  checkFile('src/hooks', 'Hooks directory');
  checkFile('functions/src/document-ai', 'Document AI directory');
  checkFile('functions/src/workflows', 'Workflows directory');
  checkFile('functions/src/agents', 'Agents directory');

  // 4. Check Dependencies
  console.log('\n--- Dependencies Check ---\n');

  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    check('DEP: next', !!deps['next'], deps['next'] || 'Not found');
    check('DEP: react', !!deps['react'], deps['react'] || 'Not found');
    check('DEP: firebase', !!deps['firebase'], deps['firebase'] || 'Not found');
    check('DEP: tailwindcss', !!deps['tailwindcss'], deps['tailwindcss'] || 'Not found');
  } catch {
    check('Package.json', false, 'Could not read package.json');
  }

  try {
    const functionsPackageJson = JSON.parse(fs.readFileSync('functions/package.json', 'utf-8'));
    const deps = { ...functionsPackageJson.dependencies, ...functionsPackageJson.devDependencies };

    check('DEP: firebase-functions', !!deps['firebase-functions'], deps['firebase-functions'] || 'Not found');
    check('DEP: firebase-admin', !!deps['firebase-admin'], deps['firebase-admin'] || 'Not found');
    check('DEP: @anthropic-ai/sdk', !!deps['@anthropic-ai/sdk'], deps['@anthropic-ai/sdk'] || 'Not found');
  } catch {
    check('Functions package.json', false, 'Could not read functions/package.json');
  }

  // Print Results
  console.log('\n========================================');
  console.log('  Results Summary');
  console.log('========================================\n');

  const passed = results.filter((r) => r.status === 'pass').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  results.forEach((result) => {
    const icon =
      result.status === 'pass' ? '\x1b[32m[PASS]\x1b[0m' :
      result.status === 'warn' ? '\x1b[33m[WARN]\x1b[0m' :
      '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${icon} ${result.name}: ${result.message}`);
  });

  console.log('\n----------------------------------------');
  console.log(`Total: ${results.length} checks`);
  console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`  \x1b[33mWarnings: ${warned}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
  console.log('----------------------------------------\n');

  if (failed > 0) {
    console.log('\x1b[31mSetup verification FAILED. Please fix the issues above.\x1b[0m\n');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\x1b[33mSetup verification PASSED with warnings.\x1b[0m\n');
    process.exit(0);
  } else {
    console.log('\x1b[32mSetup verification PASSED!\x1b[0m\n');
    process.exit(0);
  }
}

main().catch(console.error);
