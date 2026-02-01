const fs = require('fs');
const path = require('path');

function getConfigDir() {
  const home = process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME;
  return path.join(home || '', '.adgen');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function readConfig() {
  try {
    const filePath = getConfigPath();
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function writeConfig(obj) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = getConfigPath();
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = { getConfigPath, readConfig, writeConfig };
