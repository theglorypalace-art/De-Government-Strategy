const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'positions.json');

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

function load() {
  try {
    ensureDir();
    if (!fs.existsSync(FILE)) return {};
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    logger.warn('positionsStore load failed', err.message);
    return {};
  }
}

function save(obj) {
  try {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    logger.error('positionsStore save failed', err.message);
  }
}

module.exports = { load, save };
