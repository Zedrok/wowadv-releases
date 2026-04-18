#!/usr/bin/env node
/**
 * Build script for Baker's Raid Monitor
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

let sourceDir = process.cwd();
let electronDir = path.join(sourceDir, 'electron');

// If we're already in the electron folder, adjust paths
if (sourceDir.endsWith('electron')) {
  sourceDir = path.join(sourceDir, '..');
  electronDir = path.join(sourceDir, 'electron');
}

const distDir = path.join(electronDir, 'dist');

console.log('🔨 Building Baker\'s Raid Monitor...\n');

try {
  // Build vite bundles
  console.log('🏗️  Building...');
  execSync('npm run build', {
    cwd: electronDir,
    stdio: 'inherit'
  });

  // Copy renderer JS modules that Vite doesn't bundle
  console.log('📋 Copying renderer modules...');
  const srcRendererJs = path.join(electronDir, 'src', 'renderer', 'scheduled-runs.js');
  const destRendererJs = path.join(electronDir, 'out', 'renderer', 'scheduled-runs.js');
  if (fs.existsSync(srcRendererJs)) {
    fs.copyFileSync(srcRendererJs, destRendererJs);
    console.log('  ✓ Copied scheduled-runs.js');
  }

  // Copy public assets (audio files, etc.)
  console.log('🎵 Copying public assets...');
  const srcPublicAssets = path.join(electronDir, 'public', 'assets');
  const destPublicAssets = path.join(electronDir, 'out', 'assets');
  if (fs.existsSync(srcPublicAssets)) {
    copyDirRecursive(srcPublicAssets, destPublicAssets);
    console.log('  ✓ Copied public assets to', destPublicAssets);
    const soundsDir = path.join(destPublicAssets, 'sounds');
    if (fs.existsSync(soundsDir)) {
      console.log('  Sounds:', fs.readdirSync(soundsDir).join(', '));
    }
  }

  // Run electron-builder
  console.log('\n📦 Packaging...');
  execSync('npx electron-builder --win portable --publish=never', {
    cwd: electronDir,
    stdio: 'inherit'
  });

  // Copy result to dist root
  const builtExe = path.join(electronDir, 'dist', 'Bakers Raid Monitor 1.0.0.exe');
  const finalExe = path.join(distDir, 'Bakers Raid Monitor.exe');

  if (fs.existsSync(builtExe)) {
    fs.mkdirSync(distDir, { recursive: true });

    if (fs.existsSync(finalExe)) {
      try { fs.unlinkSync(finalExe); } catch { /* locked, skip rename */ }
    }

    if (builtExe !== finalExe) {
      fs.copyFileSync(builtExe, finalExe);
      try { fs.unlinkSync(builtExe); } catch { /* ignore */ }
    }

    const stats = fs.statSync(finalExe);
    console.log(`\n✅ Build successful!`);
    console.log(`📦 Executable: ${finalExe}`);
    console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
  } else if (fs.existsSync(finalExe)) {
    const stats = fs.statSync(finalExe);
    console.log(`\n✅ Build successful!`);
    console.log(`📦 Executable: ${finalExe}`);
    console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
  } else {
    throw new Error('Build failed: executable not created');
  }

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
