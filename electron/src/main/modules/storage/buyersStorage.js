const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { v4: uuidv4 } = require('crypto').randomUUID || (() => {
  const crypto = require('crypto')
  return () => crypto.randomUUID()
})()

const userData = app.getPath('userData')
const buyersFile = path.join(userData, 'buyers.json')

// Helper: generate UUID (fallback if crypto.randomUUID not available)
function generateId() {
  try {
    return require('crypto').randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Load buyers from file
function loadBuyers() {
  try {
    if (fs.existsSync(buyersFile)) {
      const data = fs.readFileSync(buyersFile, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('[BuyersStorage] Error loading buyers:', e.message)
  }
  return { buyers: [] }
}

// Save buyers to file
function saveBuyers(data) {
  try {
    fs.writeFileSync(buyersFile, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('[BuyersStorage] Error saving buyers:', e.message)
    return false
  }
}

// Get all buyers
function getBuyers() {
  return loadBuyers().buyers || []
}

// Get buyer by ID
function getBuyerById(buyerId) {
  const buyers = loadBuyers()
  return buyers.buyers?.find(b => b.id === buyerId) || null
}

// Add new buyer
function addBuyer(nickRealm, battleTag, monto) {
  const buyers = loadBuyers()
  const newBuyer = {
    id: generateId(),
    nickRealm,
    battleTag,
    monto,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  }
  buyers.buyers.push(newBuyer)
  saveBuyers(buyers)
  return newBuyer
}

// Update lastUsed for a buyer
function updateLastUsed(buyerId) {
  const buyers = loadBuyers()
  const buyer = buyers.buyers.find(b => b.id === buyerId)
  if (buyer) {
    buyer.lastUsed = new Date().toISOString()
    saveBuyers(buyers)
  }
}

// Delete buyer by ID
function deleteBuyer(buyerId) {
  const buyers = loadBuyers()
  buyers.buyers = buyers.buyers.filter(b => b.id !== buyerId)
  saveBuyers(buyers)
}

module.exports = {
  getBuyers,
  getBuyerById,
  addBuyer,
  updateLastUsed,
  deleteBuyer,
  loadBuyers,
  saveBuyers
}
