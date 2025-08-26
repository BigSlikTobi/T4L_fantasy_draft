## Features

- **AI Provider Selection**: Choose between Google Gemini and OpenAI GPT for draft recommendations
- **Easy Setup**: Enter your API keys directly in the app - no environment variable configuration required
- **Draft Assistant Mode**: Get personalized draft recommendations based on your league settings and current roster
- **Mock Draft Mode**: Simulate a full draft with AI-powered picks for all teams
- **Fast Mode**: Speed up mock drafts with optimized algorithms (up to 10x faster while maintaining quality)
- **Strategy-First Approach**: Get strategic guidance before specific player recommendations
- **Player Blocking**: Block players you don't want to draft and they won't be recommended
- **Tier-Based Rankings**: Upload your own player rankings with tier system for better draft decisions

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Open your browser to the displayed URL (usually http://localhost:5173)
4. In the setup screen:
   - Choose your AI provider (Gemini or OpenAI)
   - Enter your API key for the selected provider:
     - **Gemini**: Get your API key from https://ai.google.dev/
     - **OpenAI**: Get your API key from https://platform.openai.com/api-keys
   - Configure your league settings
   - Upload your player rankings JSON file
   - Start drafting!

## API Keys

No environment variable setup required! Simply enter your API keys in the setup screen:

- **For Gemini**: Get your free API key from [Google AI Studio](https://ai.google.dev/)
- **For OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys) (requires billing setup)

The app securely handles your API keys and only uses them for generating draft recommendations.
