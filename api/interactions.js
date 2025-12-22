import 'dotenv/config';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKey,
} from 'discord-interactions';
import { askAI } from '../openai.js';
import { DiscordRequest } from '../utils.js';

function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Method Not Allowed');
  }

  const publicKey = getEnv('PUBLIC_KEY', 'YOUR_PUBLIC_KEY');
  const appId = getEnv('APP_ID', 'YOUR_APP_ID');

  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  if (!publicKey || !signature || !timestamp) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Missing signature headers or PUBLIC_KEY');
  }

  const rawBody = await readRawBody(req);
  const isValid = verifyKey(rawBody, signature, timestamp, publicKey);
  if (!isValid) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Bad request signature');
  }

  let interaction;
  try {
    interaction = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Invalid JSON');
  }

  const type = interaction.type;

  // PING (required)
  if (type === InteractionType.PING) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ type: InteractionResponseType.PONG }));
  }

  if (type !== InteractionType.APPLICATION_COMMAND) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'unknown interaction type' }));
  }

  const data = interaction.data || {};
  const name = data.name;

  if (name === 'test') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: 'hello world',
            },
          ],
        },
      })
    );
  }

  if (name === 'ask') {
    // Acknowledge immediately; we will edit the original message later.
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE }));

    const token = interaction.token;
    const options = Array.isArray(data.options) ? data.options : [];
    const questionOpt = options.find((o) => o && o.name === 'question');
    const question = questionOpt ? questionOpt.value : '';

    try {
      if (!appId) throw new Error('Missing APP_ID (or YOUR_APP_ID) in environment');
      if (!token) throw new Error('Missing interaction token');

      const answer = await askAI(question);
      const endpoint = `webhooks/${appId}/${token}/messages/@original`;
      await DiscordRequest(endpoint, {
        method: 'PATCH',
        omitAuth: true,
        body: { content: answer || '(No output)' },
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      if (appId && token) {
        const endpoint = `webhooks/${appId}/${token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          omitAuth: true,
          body: { content: `Error: ${message}` },
        }).catch(() => {});
      }
      console.error('ask command failed:', err);
    }

    return;
  }

  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'unknown command' }));
}


