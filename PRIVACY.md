# Privacy Policy

**DeepHook Bait Layer** ("the Extension") operates entirely on your device. This privacy policy explains what data, if any, the Extension processes.

## Data Collection

The Extension does **not** collect, transmit, or store any personal data by default.

### Local Mode (default)
When running in Local mode, all processing happens locally on your machine:
- Page content is analyzed locally in your browser
- AI responses are generated using your local AI engine (Ollama)
- No data is sent to external servers

### Cloud Mode (optional)
When Cloud mode is enabled with a Supabase URL/key:
- AI responses are generated via your configured Supabase project
- You control your Supabase project and its data
- No analytics, tracking, or third-party services are used

## Permissions Used

| Permission | Why |
|------------|-----|
| `activeTab` | To read page content when you click the extension |
| `storage` | To save your settings and preferences locally |
| `scripting` | To inject the content script into web pages |
| `clipboardWrite` | To copy generated responses to your clipboard |
| `http://localhost:8765/*` | To communicate with your local Bait Engine panel (local mode only) |
| `https://gcvnkfxmdqvusnkwczrt.supabase.co/*` | To communicate with your Supabase project (cloud mode only) |

## Contact

For questions about this privacy policy, contact the developer.
