import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Simple "Hello world!" command
const HELLO_COMMAND = {
  name: 'hello',
  description: 'Prints Hello world!',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Ask an AI a question
const ASK_COMMAND = {
  name: 'ask',
  description: 'Ask the bot a question (AI)',
  options: [
    {
      type: 3,
      name: 'question',
      description: 'What do you want to ask?',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, HELLO_COMMAND, CHALLENGE_COMMAND, ASK_COMMAND];

// Support both the repo's expected env var names and the "YOUR_*" names from .env.sample
const APP_ID = process.env.APP_ID || process.env.YOUR_APP_ID;
InstallGlobalCommands(APP_ID, ALL_COMMANDS);
