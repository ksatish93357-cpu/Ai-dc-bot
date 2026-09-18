# A normal ai chat discord bot by using Groq AI api

Features:
- Groq AI chat in English/Hinglish.
- `/chat on` and `/chat off` in the current channel. Requires the Discord `Manage Server` permission.
- When chat is ON, normal messages in that channel receive AI replies until `/chat off`.
- Bot mentions also work when chat is enabled.
- Recent conversation history.
- AI and rule responses are sent as Discord embeds.
- Grand Mobile rule database loaded from `rules/`: GR, FW, GZ and LD/DEP.
- Rule-number and keyword/description-fragment matching.
- Rule answers are grounded in the supplied rule files and can include rule number, title, description, punishment, notes and category where present.
- New-server notification with server details and invite link to the log channel and owner DM.
- Minute-by-minute status update and server count.
- Secrets/configuration in `.env`.

Setup in Termux:
1. `cp .env.example .env`
2. Edit `.env` and set `DISCORD_TOKEN` and `GROQ_API_KEY`.
3. `npm install`
4. `npm start`

Discord:
- Enable Message Content Intent.
- Bot needs View Channel, Send Messages, Read Message History and Create Invite where invite creation is desired.
- `/chat` requires Manage Server.
