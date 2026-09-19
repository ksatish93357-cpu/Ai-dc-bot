# A normal AI chat Discord bot using the Groq AI API

Features:
- Groq AI chat with English/Hinglish responses.
- `/chat on` and `/chat off` for the current channel. Requires the Discord `Manage Server` permission.
- Chat can be enabled separately for each channel.
- When chat is ON, normal messages in that channel receive AI replies until `/chat off`.
- Bot mentions can be used for AI conversations.
- Recent conversation history.
- AI responses are sent as Discord embeds.
- Grand Mobile rule database loaded from `rules/`: GR, FW, GZ and LD/DEP.
- Rule-number and keyword/description-fragment matching across the supplied rule files.
- Rule answers are based on the supplied rule files and can include rule number, title, description, punishment, notes and category where available.
- New-server notifications with server details and invite link sent to the log channel and owner DM.
- Automatic minute-by-minute status update with India time, server time and server count.
- Bot activity status.
- Secrets and configuration are stored in `.env`.

## Setup 

1. Clone the repository:
   `git clone https://github.com/ksatish93357-cpu/Ai-dc-bot.git`
2. Enter the project directory:
   `cd Ai-dc-bot`
3. Create the environment file:
   `cp .env.example .env`
4. Edit `.env` and set `DISCORD_TOKEN`, `GROQ_API_KEY` and the required Discord IDs.
5. Install dependencies:
   `npm install`
6. Start the bot:
   `npm start`

## Discord

- Enable the `Message Content Intent`.
- Bot needs `View Channel`, `Send Messages`, `Embed Links` and `Read Message History`.
- `Create Invite` is required where the bot should create an invite for new-server notifications.
- `/chat` requires the Discord `Manage Server` permission.
