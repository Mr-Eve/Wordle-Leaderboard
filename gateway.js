import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

/**
 * This project is primarily an Interactions (HTTP) app, which doesn't create a persistent
 * gateway connection, so Discord will usually show the bot as "offline".
 *
 * If a bot token is available, we also connect to the Gateway so the bot user appears online.
 */
export async function startGateway() {
  const token = process.env.DISCORD_TOKEN || process.env.YOUR_BOT_TOKEN;
  if (!token) return null;

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once('ready', () => {
    const userTag =
      (client.user && client.user.tag) ||
      (client.user && client.user.id) ||
      'unknown user';
    console.log(`Gateway connected as ${userTag}`);
    // Optional: explicitly set online presence.
    if (client.user) client.user.setPresence({ status: 'online' });
  });

  client.on('error', (err) => {
    console.error('Discord gateway client error:', err);
  });

  await client.login(token);
  return client;
}


