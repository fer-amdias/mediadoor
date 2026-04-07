import { Intents } from 'discord.js';

export default {
  prefix: '.',
  token: process.env.TOKEN,
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES
  ],
  dailyLogChannelId: '1242242162649993217',
  todayUpdateChannel: '1263624125596041226',
  yesterdayUpdateChannel: '1263625549847462121'
}
