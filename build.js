#!/usr/bin/env node
/**
 * Build script for Baker's Raid Monitor
 * Handles electron-builder limitations on Windows
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Helper to copy directory recursively
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Helper to remove directory recursively
function removeDirRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      removeDirRecursive(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dirPath);
}

const tempDir = path.join(os.tmpdir(), `wow-adv-build-${Date.now()}`);
let sourceDir = process.cwd();
let electronDir = path.join(sourceDir, 'electron');

// If we're already in the electron folder, adjust paths
if (sourceDir.endsWith('electron')) {
  sourceDir = path.join(sourceDir, '..');
  electronDir = path.join(sourceDir, 'electron');
}

const tempElectronDir = path.join(tempDir, 'electron');
const distDir = path.join(electronDir, 'dist');

console.log('🔨 Building Baker\'s Raid Monitor...\n');

try {
  // Create temp directory
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`📁 Created temp build directory: ${tempDir}`);

  // Copy electron directory
  console.log('📋 Copying source files...');
  copyDirRecursive(electronDir, tempElectronDir);

  // Copy bakers_raids.py from project root to temp dir (so ../bakers_raids.py from temp/electron works)
  const pythonScriptPath = path.join(sourceDir, 'bakers_raids.py');
  const pythonScriptTempPath = path.join(tempDir, 'bakers_raids.py');
  if (fs.existsSync(pythonScriptPath)) {
    console.log('📋 Copying bakers_raids.py...');
    fs.copyFileSync(pythonScriptPath, pythonScriptTempPath);
    console.log('✓ Copied to: ' + pythonScriptTempPath);
  } else {
    console.log('⚠️  Warning: bakers_raids.py not found at ' + pythonScriptPath);
  }

  // Build in temp directory
  console.log('\n🏗️  Building...');
  execSync('npm run build', {
    cwd: tempElectronDir,
    stdio: 'inherit'
  });

  // Copy renderer JavaScript modules that Vite doesn't bundle
  console.log('📋 Copying renderer modules...');
  const srcRendererJs = path.join(tempElectronDir, 'src', 'renderer', 'scheduled-runs.js');
  const destRendererJs = path.join(tempElectronDir, 'out', 'renderer', 'scheduled-runs.js');
  if (fs.existsSync(srcRendererJs)) {
    fs.copyFileSync(srcRendererJs, destRendererJs);
    console.log('  ✓ Copied scheduled-runs.js');
  }

  // Copy public assets (audio files, etc.) that Vite doesn't copy
  console.log('🎵 Copying public assets...');
  const srcPublicAssets = path.join(tempElectronDir, 'public', 'assets');
  const destPublicAssets = path.join(tempElectronDir, 'out', 'assets');
  console.log('  src:', srcPublicAssets, '- exists:', fs.existsSync(srcPublicAssets));
  if (fs.existsSync(srcPublicAssets)) {
    copyDirRecursive(srcPublicAssets, destPublicAssets);
    console.log('  ✓ Copied public assets to', destPublicAssets);
    // List copied files
    const soundsDir = path.join(destPublicAssets, 'sounds');
    if (fs.existsSync(soundsDir)) {
      console.log('  Sounds:', fs.readdirSync(soundsDir).join(', '));
    }
  }

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
    // Ensure dist directory exists
    fs.mkdirSync(distDir, { recursive: true });

    // Remove old exe if exists, with retries for lock issues
    if (fs.existsSync(finalExe)) {
      console.log('Removing old executable...');
      try {
        fs.unlinkSync(finalExe);
      } catch (e) {
        console.log('Could not remove old exe immediately, retrying in 2 seconds...');
        execSync('timeout /t 2 /nobreak');
        try {
          fs.unlinkSync(finalExe);
        } catch (e2) {
          console.log('Still locked, waiting 5 more seconds...');
          execSync('timeout /t 5 /nobreak');
          fs.unlinkSync(finalExe);
        }
      }
    }

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
  removeDirRecursive(tempDir);

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  // Cleanup on error
  try {
    removeDirRecursive(tempDir);
  } catch {}
  process.exit(1);
}
