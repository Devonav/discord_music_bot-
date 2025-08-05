# Discord Music Bot

A Discord music bot that can play music from YouTube URLs using Discord.js and ytdl-core.

## Features

- Play music from YouTube URLs
- Queue management (add songs to queue)
- Basic playback controls (play, pause, resume, skip, stop)
- Display current queue
- Rich embeds with song information

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Discord application and bot:
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to the "Bot" section
   - Create a bot and copy the token

3. Configure the bot:
   - Open `config.json`
   - Replace `YOUR_BOT_TOKEN_HERE` with your bot token

4. Invite the bot to your server:
   - Go to the "OAuth2" > "URL Generator" section
   - Select "bot" scope
   - Select the following permissions:
     - Send Messages
     - Connect
     - Speak
     - Use Voice Activity
   - Copy the generated URL and open it to invite the bot

5. Run the bot:
   ```bash
   node index.js
   ```

## Commands

- `!play <YouTube URL>` - Play a song from YouTube
- `!skip` - Skip the current song
- `!stop` - Stop playing and clear the queue
- `!pause` - Pause the current song
- `!resume` - Resume the paused song
- `!queue` - Show the current queue
- `!help` - Show help message

## Requirements

- Node.js 16.9.0 or higher
- A Discord bot token
- FFmpeg (for audio processing)

## Notes

- The bot requires the user to be in a voice channel to use music commands
- Only YouTube URLs are supported
- The bot will automatically leave the voice channel when the queue is empty