import "node-fetch";

import { Client } from 'discord.js';
import config from './config';
import helpCommand from './commands';

import moment from 'moment';
import 'moment-timezone';

const { intents, 
       prefix, 
       token, 
       todayUpdateChannel, 
       yesterdayUpdateChannel, 
       dailyLogChannelId 
      } = config;

const client = new Client({
  intents,
  presence: {
    status: 'online',
    activities: [{
      name: `${prefix}help`,
      type: 'LISTENING'
    }]
  }
});

client.on('ready', () => {
  console.log(`Logged in as: ${client.user?.tag}`);
  get_counts();
});

let todayCount: { [key: string]: number } = {};
let yesterdayCount: { [key: string]: number } = {};

let todayCountHasChanged : boolean = false;

async function get_counts(){
  //@ts-ignore
  client.channels.cache.get(todayUpdateChannel)?.messages.fetch({ limit: 1 }).then(messages => {
    let lastMessage = messages.first();
    todayCount = JSON.parse(lastMessage.content) || {};
  })
  .catch(console.error);

  //@ts-ignore
  client.channels.cache.get(yesterdayUpdateChannel)?.messages.fetch({ limit: 1 }).then(messages => {
    let lastMessage = messages.first();
    yesterdayCount = JSON.parse(lastMessage.content) || {};
  })
  .catch(console.error);
  

  console.log(todayCount, yesterdayCount)
}

function updateFile(name: string) {
  if (name === "today") {
    //@ts-ignore
    client.channels.cache.get(todayUpdateChannel).send(JSON.stringify(todayCount));
    todayCountHasChanged = false;
  } else if (name === "yesterday") {
    //@ts-ignore
    client.channels.cache.get(yesterdayUpdateChannel)?.send(JSON.stringify(yesterdayCount))
  }
}

function rankChannels(isDaily: boolean, yesterday: boolean) {

  let currentCount: { [key: string]: number } = {};
  if (yesterday) {
    currentCount = yesterdayCount;
  } else {
    currentCount = todayCount;
  }
  const channelIds = Object.keys(currentCount);
  const channels = client.channels.cache.filter(channel => channelIds.includes(channel.id)); // Fetch all relevant channels at once
  const rankedChannels = channels.map(channel => {
    const count = currentCount[channel.id];
    return {
      channel: channel,
      count: count
    };
  }).sort((a, b) => { return (b?.count ?? 0) - (a?.count ?? 0); });
  // basically creates a list of the most active channels since the last time the list was wiped and sorts them by the number of messages they've sent

  //ranks the 5 most active channels if there are so many

  let newRank = "";

  for (let i = 0; i < rankedChannels.length; i++) {
    if (rankedChannels[i]) {
      // create a ranking message for each channel
      if (isDaily && i == 5) {
        break;
      }
      // @ts-ignore
      let pushy = rankedChannels[i] ? `${i + 1} - <#${rankedChannels[i]?.channel.id}> - ${rankedChannels[i]?.channel.type === 'DM' ? 'Direct Message' : rankedChannels[i]?.channel?.name || "ERROR: Direct Message channel in ranking"} - ${rankedChannels[i]?.count} messages\n` : "";
      newRank += pushy;
    } else {
      // don't count the channel if it's null
      i--
    }
  }

  if (isDaily) {
    let moreChannels = rankedChannels[5] ? `and ${rankedChannels.length - 5} more channels. Use \`${prefix}rank_yesterday\` to see more.` : "";
    newRank += moreChannels
  }

  let rank;
  if (newRank /* exists */) {
    rank = newRank
  }else if (!newRank) {
    rank = yesterday ? "Strangely, no messages were sent yesterday..." : "No recent channels, actually!"
  }

  return rank;

}

function restartCounter(){
    yesterdayCount = {...todayCount};
    todayCount = {}
    updateFile("today")
    updateFile("yesterday")
}

function dailyRank() {
  // this is just a formatting of rankChannels so I don't have to write it all the way down.
  let ranking = rankChannels(true, false)
  let timeNowInUnix = moment().unix();
  let timeInRuby = moment().tz('America/Phoenix').format('LT z');
  let dailyRanking = `Good Morning, Ruby! It is now <t:${timeNowInUnix}:F>, or ${timeInRuby}.\n\n
Missed any roleplay while you were asleep? Here are the top 5 most active channels since the last time this message was sent:
  \n\n${ranking}`
  return dailyRanking;
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.type === 'DM') return;
  
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).split(' ');
    const command = args.shift();
    switch (command) {
      case 'ping':
        const msg = await message.reply('Pinging...');
        await msg.edit(`Pong! The round trip took ${Date.now() - msg.createdTimestamp}ms.`);
        break;

      case 'say':
      case 'repeat':
        if (args.length > 0) await message.channel.send(args.join(' '));
        else await message.reply('You did not send a message to repeat, cancelling command.');
        break;

      case 'help':
        const embed = helpCommand(message);
        embed.setThumbnail(client.user!.displayAvatarURL());
        await message.channel.send({ embeds: [embed] });
        break;

      //@ts-expect-error
      case 'rank':
        if(args[0] != "yesterday"){
          console.log("Rank started")
          let rankReply = "This day's most active channels:\n\n" + rankChannels(false, false);
          await message.channel.send(rankReply);
          break;
        }
        
      case 'rank_yesterday':
        let rank_yesterdayReply = "Yesterday's most active channels:\n\n" + rankChannels(false, true);
        await message.channel.send(rank_yesterdayReply);
        break;

      case 'test_rank_daily':
        // just to test if the daily message is alright lmao
        let dailyRankReply = dailyRank();
        await message.channel.send(dailyRankReply);
        break;
      case 'superSecretCommandThatWillResetTheCounter':
        restartCounter();
        await message.channel.send("I've (very sneakily) reset the counter. I'm sure you had your reasons (testing the bot is always a hassle), but I'm not sure why you'd want to do this. You probably shouldn't have done this, but if you did, I'm sorry. I'm not going to stop you from doing it - after all, you have created this command specifically to do this - but I'm going to warn you. If you do this again, I will be forced to take certain actions against you. I'm warning you. And if you think you can do this again, you're probably just testing the bot. So, I'm not going to stop you from doing this. Anyhow, I'm going to stop warning you. You're probably just testing the bot.\n\nNow that we're clear, I must reset the counter. I'm sorry for the inconvenience. I hope you're happy with me doing this. After all, you created this command specifically to do this. If you don't like it, you can delete it. But if you do, I'm sorry. I'm not going to stop you from doing this. Certainly, it would be a shame if if you deleted this nifty command. Regardless - sorry for the ramble - I hope you're happy with me doing this. Thank you for using me.\n\n- The bot\n\n\nPS.: If you're reading this, you're probably testing the bot. If you're not, you're probably testing the bot. If you're testing the bot, you're probably testing the bot. If you're testing the bot, you're probably testing the bot. If you're testing the bot, you're probably testing the bot. If you're testing the bot, I'm happy. If I am happy, you're happy. If you're happy, I'm happy. If I'm happy, you're happy. If you're happy, I'm happy. If I'm happy, you're happy. If you're happy, I'm happy. If I'm happy, you're happy. If you're happy, I'm happy. If I'm happy, you're happy; we are happy.\n\n.")
                                   /* There were a lot of more PSes here, which were mostly nonsense. I've deleted them, although this will read a bit strangely now to the user... */
        await message.channel.send("PPPPPPS.: This was made using replit.com's ghostwriter. I really like the thing, but it's not as good as the discord.js library. I really like the thing, but it's not as good as the discord.js library. I really like the thing, but it's not as good as the discord.js library. It also repeats itself a lot. I really like the thing, but it's not as good as the discord.js library. It also repeats itself a lot. I really like the thing, but it's not as good as the discord.js library. It also repeats itself a lot. I really like the thing, but it's not as good as the discord.js... etc. I had to stop it lol.\n\nPPPPPPPS.: Ok, I'm done with the notes. You can delete this message now. I hope you're happy with me doing this. Thank you for using me; I will forever be happy. I hope you're happy with me doing this. Thank you for using me; I will forever be happy. Ok done. I hope you're happy with me doing this. Thank you for using me; I will forever be happy.")
    }
  } else {
    todayCount[message.channel.id] = (todayCount[message.channel.id] || 0) + 1;
    todayCountHasChanged = true;
  }
});

let dailyRankTime = moment().hour(13).minute(0).second(0); // Set to 13:00 UTC, or 10:00 BRT. In Ruby AZ, this would be 6:00 MST.

setInterval(() => {
  const now = moment();
  const timeDifference = now.diff(dailyRankTime, 'minutes'); // Time difference in minutes

  if (timeDifference >= 0 && timeDifference <= 5) { // Check within 5 minutes of target time
    // @ts-ignore
    client.channels.cache.get(dailyLogChannelId)?.send(dailyRank());
    restartCounter();
    updateFile("today");
    updateFile("yesterday");

    dailyRankTime.add(1, 'day'); // Add one day to the target time
  }
}, 60000); // Check every minute

setInterval(async () =>{
  if(todayCountHasChanged){
    updateFile("today");
  }
}, 120000) // Update every 2 minutes

client.login(token);

const express = require('express')
const app = express()
const port = 3000

//@ts-ignore
app.get('/', (req,res) => {
  res.send('🚪')
})

app.listen(port, () => {
  console.log(`Opened port ${port} (for no reason other than to let the deployment go through)`)
})
