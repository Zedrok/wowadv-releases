#!/usr/bin/env node
/**
 * Build script for Baker's Raid Monitor
 * Handles electron-builder limitations on Windows
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const tempDir = path.join(os.tmpdir(), `wow-adv-build-${Date.now()}`);
const sourceDir = process.cwd();
const electronDir = path.join(sourceDir, 'electron');
const tempElectronDir = path.join(tempDir, 'electron');
const distDir = path.join(electronDir, 'dist');

console.log('🔨 Building Baker\'s Raid Monitor...\n');

try {
  // Create temp directory
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`📁 Created temp build directory: ${tempDir}`);

  // Copy electron directory
  console.log('📋 Copying source files...');
  execSync(`cp -r "${electronDir}" "${tempElectronDir}"`, {
    stdio: 'inherit',
    shell: '/bin/bash'
  });

  // Build in temp directory
  console.log('\n🏗️  Building...');
  execSync('npm run build', {
    cwd: tempElectronDir,
    stdio: 'inherit'
  });

  // Run electron-builder
  console.log('\n📦 Packaging...');
  execSync('npx electron-builder --win portable --publish=never', {
    cwd: tempElectronDir,
    stdio: 'inherit'
  });

  // Copy result
  const tempExe = path.join(tempElectronDir, 'dist', 'Bakers Raid Monitor 1.0.0.exe');
  const finalExe = path.join(distDir, 'Bakers Raid Monitor.exe');

  if (fs.existsSync(tempExe)) {
    fs.copyFileSync(tempExe, finalExe);
    const stats = fs.statSync(finalExe);
    console.log(`\n✅ Build successful!`);
    console.log(`📦 Executable: ${finalExe}`);
    console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
  } else {
    throw new Error('Build failed: executable not created');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  execSync(`rm -rf "${tempDir}"`, {
    stdio: 'ignore',
    shell: '/bin/bash'
  });

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  // Cleanup on error
  try {
    execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore', shell: '/bin/bash' });
  } catch {}
  process.exit(1);
}
