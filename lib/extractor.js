// lib/extractor.js — claim detection via heuristics

const CLAIM_TRIGGERS = [
  'because', 'actually', 'clearly', 'obviously', 'the fact is',
  'everyone knows', 'studies show', "it's proven", 'simply',
  'if you think about it', 'anyone with half a brain',
  'you have to admit', 'undeniably', 'without question',
  'there is no doubt', 'it is clear that', 'wake up',
  'sheep', 'sheeple', 'do your research', 'just saying',
];

const PLATFORM_SELECTORS = {
  'reddit.com': [
    'shreddit-post [slot="text-body"] p',
    'shreddit-comment .md p',
    '[data-testid="post-container"] [data-click-id="text"]',
    '[data-testid="comment"]',
    '.Comment__body',
  ],
  'x.com': ['[data-testid="tweetText"]'],
  'twitter.com': ['[data-testid="tweetText"]'],
  'facebook.com': ['[data-ad-preview="message"]', '.userContent'],
};

function scoreText(text) {
  if (!text || text.length < 30) return 0;
  let score = 0;
  const lower = text.toLowerCase();
  for (const trigger of CLAIM_TRIGGERS) {
    if (lower.includes(trigger)) score += 2;
  }
  if (text.length > 100) score += 2;
  if (text.length > 250) score += 1;
  if (text.includes('?')) score += 1; // questions = reverse interrogation
  return score;
}

function getSelectorsForHost(hostname) {
  for (const [domain, selectors] of Object.entries(PLATFORM_SELECTORS)) {
    if (hostname.includes(domain)) return selectors;
  }
  return ['p', 'article', '.post-content', '.entry-content', 'blockquote'];
}

export function extractClaims(root = document) {
  const hostname = window.location.hostname;
  const selectors = getSelectorsForHost(hostname);
  const seen = new Set();
  const results = [];

  for (const selector of selectors) {
    try {
      const elements = root.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.innerText?.trim();
        if (!text || seen.has(text)) continue;
        const score = scoreText(text);
        if (score >= 2) {
          seen.add(text);
          results.push({ text, score, element: el });
        }
      }
    } catch {
      // selector may be invalid on some pages
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

// djb2 hash for dedup tracking
export function hashText(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}
