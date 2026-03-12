// config.ts
// Feature flags and global configuration.
// All timing and model values live here.

export const FEATURES = {
  WELCOME_SCREEN: false,
}

// Ms per domain neuron reveal step (scales with how many domains were found)
export const MS_PER_DOMAIN = 1500

// Ms to wait after all neurons have been revealed before transitioning to chat
// Only applies in streaming mode -- non-streaming transitions as soon as output is ready
export const POST_REVEAL_HOLD_MS = 3000

// When true: once in chat mode, subsequent messages stream normally without
// re-triggering the neuron classification animation.
// When false: every new message fades the chat history, pops the neurons back
// up, runs classification + reveal, then returns to chat.
export const PERSIST_CHAT_MODE = false

// (streaming mode: during POST_REVEAL_HOLD_MS, non-streaming: while backend computes)
export const SCRAMBLE_DURING_WAIT = true

// Drift speed multiplier for the waiting scramble -- 1.0 = same as processing
export const WAIT_SCRAMBLE_SPEED = 0.60

// When true, revealed neurons from different domains also connect to each other.
// Each newly revealed domain's neuron links to all previously revealed neurons,
// building a growing web across the entire classification.
// Pairs naturally with NODES_PER_DOMAIN = 1 for a clean single-node-per-domain graph.
export const DOMAIN_NEURON_INTERLINKING = true

// true  = stream tokens as they arrive 
// false = wait for full response, then display it all at once
export const STREAMING_MODE = false


// Fast classifier model -- runs before the main response.
export const CLASSIFIER_MODEL = 'gemma3:4b'

// Main chat model
export const CHAT_MODEL = 'gemma3:4b'


// Classifier system prompt -- instructs the model to output only a JSON array.
export const CLASSIFIER_PROMPT = (userMessage: string): string => {
  const domainList = DOMAINS.map((d, i) => `${i}:${d}`).join(' ')
  return (
    `Domain classifier. Output ONLY a JSON array of matching domain indices. ` +
    `No explanation, no extra text, no markdown.\n` +
    `Domains: ${domainList}\n` +
    `Example output: [0,3,5]\n` +
    `User text: "${userMessage.slice(0, 400)}"` 
  )
}

// System prompt injected as the first message on every conversation.
export const SYSTEM_PROMPT =
  `You are a concise, knowledgeable chat assistant covering any domain. ` +
  `Keep responses short and focused. Use bullet points or numbered lists ` +
  `when listing items, steps, or comparisons. Avoid unnecessary preamble. ` +
  `Never repeat the user's question back to them.`


// Domain list -- index position = numeric ID used in the classifier prompt.
export const DOMAINS: string[] = [
  'Biology: 0',
  'Finance: 1',
  'Physics: 2',
  'Chemistry: 3',
  'Medicine: 4',
  'Mathematics: 5',
  'Computing: 6',
  'History: 7',
  'Philosophy: 8',
  'Literature: 9',
  'Psychology: 10',
  'Economics: 11',
  'Engineering: 12',
  'Astronomy: 13',
  'Law: 14',
  'Music: 15',
  'Art: 16',
  'Geography: 17',
  'Linguistics: 18',
  'Sociology: 19',
  'Politics: 20',
  'Ethics: 21',
  'Neuroscience: 22',
  'Climate: 23',
  'Nutrition: 24',
]