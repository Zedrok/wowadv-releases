#!/usr/bin/env node
/**
 * Create a valid ICO file from PNG using a simple approach
 * This creates a minimal but valid ICO file from the android-chrome-512x512.png
 */

const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'electron/assets/android-chrome-512x512.png');
const icoPath = path.join(__dirname, 'electron/resources/icon.ico');

// Read PNG
const pngBuffer = fs.readFileSync(pngPath);

// Create a minimal ICO file by wrapping the PNG
// ICO format for a single PNG entry:
// Header (6 bytes) + IconDirEntry (16 bytes) + Image data

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // Type: 1 = ICO
header.writeUInt16LE(1, 4); // Count: 1 image

const iconDirEntry = Buffer.alloc(16);
iconDirEntry.writeUInt8(0, 0);        // Width (0 = use image width)
iconDirEntry.writeUInt8(0, 1);        // Height (0 = use image height)
iconDirEntry.writeUInt8(0, 2);        // Color count
iconDirEntry.writeUInt8(0, 3);        // Reserved
iconDirEntry.writeUInt16LE(1, 4);     // Color planes
iconDirEntry.writeUInt16LE(32, 6);    // Bits per pixel
iconDirEntry.writeUInt32LE(pngBuffer.length, 8);  // Image size
iconDirEntry.writeUInt32LE(6 + 16, 12); // Image offset (after header + dir entry)

const icoBuffer = Buffer.concat([header, iconDirEntry, pngBuffer]);

fs.writeFileSync(icoPath, icoBuffer);
console.log(`✓ Icon created: ${icoPath}`);
console.log(`✓ File size: ${fs.statSync(icoPath).size} bytes`);
