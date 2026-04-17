// background/service-worker.js
// Routes GENERATE_REQUEST from content.js → Supabase cloud engine (cloud-only)

import { getSettings } from '../lib/storage.js';
import { SupabaseClient } from '../lib/supabase-client.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_REQUEST') {
    handleGenerateRequest(message.payload)
      .then(candidates => sendResponse({ type: 'GENERATE_RESPONSE', candidates }))
      .catch(err => sendResponse({ type: 'GENERATE_ERROR', error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }
});

async function handleGenerateRequest({ claimText, url, persona, platform }) {
  const settings = await getSettings();
  const p = persona || settings.persona;
  const plat = platform || settings.platform;

  return handleCloudRequest(claimText, url, p, plat, settings.supabaseUrl, settings.supabaseAnonKey);
}

async function handleCloudRequest(claimText, url, persona, platform, supabaseUrl, anonKey) {
  if (!anonKey) throw new Error('Set your Supabase anon key in popup settings');

  const client = new SupabaseClient(supabaseUrl, anonKey);

  const request = await client.insert('troll_requests', {
    source_url: url,
    claim_text: claimText,
    persona,
    platform,
    status: 'pending',
  });

  const candidates = await client.pollForCandidates(request.id);
  return candidates.map((c, i) => ({
    candidate_text: c.candidate_text || c.text || '',
    weave_role: c.weave_role || (i === 0 ? 'lead' : i === 1 ? 'support' : 'sting'),
    rank_index: c.rank_index ?? i,
  }));
}
