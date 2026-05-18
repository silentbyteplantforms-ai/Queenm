require('dotenv').config();
const path = require("path");

const parseList = (envVar, fallback) => {
  if (!envVar) return fallback;
  try {
    return JSON.parse(envVar);
  } catch {
    return envVar.split(',').map(s => s.trim()).filter(Boolean);
  }
};

global.commandCount = 0;

module.exports = {
  // Firebase configuration
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || 'AIzaSyCXu_bVuYFZArxnyeaxxEn-wy_P6Egu8sU',
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || 'queen-mini.firebaseapp.com',
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || 'https://queen-mini-default-rtdb.firebaseio.com',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'queen-mini',
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || 'queen-mini.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '70101923824',
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '1:70101923824:web:6fdb27fd7959a6a8ef8f35',

  // Bot behavior
  AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS || 'true',
  AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || 'true',
  AUTO_RECORDING: process.env.AUTO_RECORDING || 'true',
  AUTO_BIO_UPDATE: 'true',
  AUTO_LIKE_EMOJI: parseList(process.env.AUTO_LIKE_EMOJI, ['💋', '🍬', '🫆', '💗', '🎈', '🎉', '🥳', '❤️', '🧫', '🐭']),
  PREFIX: process.env.PREFIX || '.',
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),

  // Paths
  ADMIN_LIST_PATH: process.env.ADMIN_LIST_PATH || './database/admin.json',
  SESSION_BASE_PATH: process.env.SESSION_BASE_PATH || './session',
  NUMBER_LIST_PATH: process.env.NUMBER_LIST_PATH || './numbers.json',

  // Images / UI
RCD_IMAGE_PATH: process.env.RCD_IMAGE_PATH || path.join(__dirname, "./ruva.jpg"),
  CAPTION: process.env.CAPTION || 'Queen_Ruva',

  // Newsletter / channels
  NEWSLETTER_JID: (process.env.NEWSLETTER_JID || '120363406453808987@newsletter').trim(),
  CHANNEL_LINK: process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb7H0lTGZNCuwI8A7E0i',
  MINI_URL: process.env.MINI_URL || 'https://queen-ruva-mini.zone.id',

  // OTP & owner
  OTP_EXPIRY: parseInt(process.env.OTP_EXPIRY || '300000', 10),
  OWNER_NUMBER: process.env.OWNER_NUMBER || '263716304574',

  // Misc
  GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || 'https://chat.whatsapp.com/LyFPHDvc5vMCglUFjv7Rlp',
  PM2_NAME: process.env.PM2_NAME || 'Queen_Ruva'
};
