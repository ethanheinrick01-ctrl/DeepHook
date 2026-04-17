# Privacy Policy

**DeepHook Bait Layer** ("the Extension") is a cloud-only, manual-only Chrome extension. This privacy policy explains what data is processed.

## How It Works

The Extension operates in **manual mode only**. Nothing is scanned or sent automatically. Generation only happens when you:

1. Highlight text on a webpage
2. Click "Generate Bait" in the tooltip

## Data Flow

When you click generate:
- The highlighted text and the current page URL are sent to the configured Supabase project (`gcvnkfxmdqvusnkwczrt.supabase.co`), which runs the generation engine in the cloud.
- Generated responses are returned to the extension and displayed in the draggable tooltip.
- No generation runs on your computer. No automatic scanning ever occurs.

You control the Supabase project and its data. No analytics or third-party trackers are used.

## Permissions Used

| Permission | Why |
|------------|-----|
| `activeTab` | To read highlighted text when you trigger generation |
| `storage` | To save your settings (persona, platform, Supabase key) locally |
| `scripting` | To inject the content script into web pages |
| `clipboardWrite` | To copy generated responses to your clipboard |
| `https://gcvnkfxmdqvusnkwczrt.supabase.co/*` | To communicate with the Supabase cloud engine |

## Contact

For questions about this privacy policy, contact the developer.
