// lib/storage.js — chrome.storage.local wrapper (cloud-only)

const DEFAULTS = {
  persona: 'dry_midwit_savant',
  platform: 'web',
  supabaseUrl: 'https://gcvnkfxmdqvusnkwczrt.supabase.co',
  supabaseAnonKey: '',    // user fills this in popup
};

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (items) => resolve(items));
  });
}

export async function setSetting(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export async function getAllSettings() {
  return getSettings();
}
