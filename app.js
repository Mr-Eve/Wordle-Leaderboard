import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { startGateway } from './gateway.js';
import { askAI } from './openai.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

// Support both the repo's expected env var names and the "YOUR_*" names from .env.sample
const PUBLIC_KEY = process.env.PUBLIC_KEY || process.env.YOUR_PUBLIC_KEY;
const APP_ID = process.env.APP_ID || process.env.YOUR_APP_ID;
// Start a Gateway connection (so the bot appears "online") when a bot token is present.
// This is optional; the HTTP interactions endpoint still works without it.
startGateway().catch((err) => console.error('Failed to start Discord gateway client:', err));

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data, token } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "hello" command
    if (name === 'hello') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Hello world!',
        },
      });
    }

    // "ask" command (AI)
    if (name === 'ask') {
      const question =
        data &&
        data.options &&
        data.options[0] &&
        (data.options[0].value || data.options[0].value === '' ? data.options[0].value : '');

      // Acknowledge immediately to avoid the 3s timeout; we'll edit the original response later.
      res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

      (async () => {
        try {
          if (!APP_ID) throw new Error('Missing APP_ID (or YOUR_APP_ID) in .env');
          if (!token) throw new Error('Missing interaction token in request');

          const answer = await askAI(question);
          const endpoint = `webhooks/${APP_ID}/${token}/messages/@original`;
          await DiscordRequest(endpoint, {
            method: 'PATCH',
            omitAuth: true,
            body: {
              content: answer || '(No output)',
            },
          });
        } catch (err) {
          const message = err && err.message ? err.message : String(err);
          const endpoint = APP_ID && token ? `webhooks/${APP_ID}/${token}/messages/@original` : null;
          if (endpoint) {
            await DiscordRequest(endpoint, {
              method: 'PATCH',
              omitAuth: true,
              body: { content: `Error: ${message}` },
            }).catch(() => {});
          }
          console.error('ask command failed:', err);
        }
      })();

      return;
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
