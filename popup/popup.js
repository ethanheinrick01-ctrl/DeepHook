// popup/popup.js — cloud-only, manual-only
import { getSettings, setSetting } from '../lib/storage.js';

const $ = id => document.getElementById(id);

async function init() {
  const settings = await getSettings();

  $('persona-select').value = settings.persona || 'dry_midwit_savant';
  $('platform-select').value = settings.platform || 'web';
  $('supabase-key').value = settings.supabaseAnonKey || '';

  updateStatus(settings.supabaseAnonKey);

  $('save-btn').addEventListener('click', async () => {
    await setSetting('persona', $('persona-select').value);
    await setSetting('platform', $('platform-select').value);
    const key = $('supabase-key').value.trim();
    await setSetting('supabaseAnonKey', key);

    const msg = $('save-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2000);

    updateStatus(key);
  });
}

function updateStatus(anonKey) {
  const indicator = $('status-indicator');
  if (anonKey) {
    indicator.textContent = '☁️ Cloud mode — ready';
  } else {
    indicator.textContent = '⚠️ Add Supabase anon key';
  }
}

init();
