# DeepHook

Chrome Manifest V3 extension that detects claims on webpages and generates suggested replies using a configured local engine or cloud backend.

## Version

This repository contains the latest local package, **1.1.1**. Repository publication does not indicate a new Chrome Web Store submission or approval.

## Try it

1. Open `chrome://extensions` and enable Developer mode.
2. Select **Load unpacked** and choose this repository folder.
3. Configure the extension in its popup.

The extension expects an existing local service at `localhost:8765` or a compatible Supabase backend. Those services are separate from this client repository. Cloud generation costs belong to the backend operator; there is no bundled free AI service.

Review [PRIVACY.md](PRIVACY.md) for the data flow. Suggestions remain subject to user review.
