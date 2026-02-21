const ALLOWED_COMMANDS = [
  '/fill',
  '/setblock',
  '/give',
  '/tp',
  '/weather',
  '/time',
  '/summon',
  '/gamemode',
  '/effect',
  '/clear',
  '/enchant',
];

const BLOCKED_COMMANDS = [
  '/kick',
  '/ban',
  '/op',
  '/deop',
  '/stop',
  '/whitelist',
  '/pardon',
  '/ban-ip',
  '/save-all',
  '/save-off',
  '/save-on',
];

export interface LLMResponse {
  commands: string[];
  message: string;
}

export function parseLLMResponse(raw: string): LLMResponse {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('LLMの応答からJSONを抽出できませんでした');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.commands) || typeof parsed.message !== 'string') {
    throw new Error('LLMの応答が期待する形式ではありません');
  }

  return {
    commands: parsed.commands,
    message: parsed.message,
  };
}

export function validateCommand(command: string): { valid: boolean; reason?: string } {
  const trimmed = command.trim();

  if (!trimmed.startsWith('/')) {
    return { valid: false, reason: `コマンドは / で始まる必要があります: ${trimmed}` };
  }

  const commandName = trimmed.split(/\s+/)[0].toLowerCase();

  if (BLOCKED_COMMANDS.includes(commandName)) {
    return { valid: false, reason: `禁止されたコマンドです: ${commandName}` };
  }

  if (!ALLOWED_COMMANDS.includes(commandName)) {
    return { valid: false, reason: `許可されていないコマンドです: ${commandName}` };
  }

  return { valid: true };
}

export function validateCommands(commands: string[]): {
  validCommands: string[];
  errors: string[];
} {
  const validCommands: string[] = [];
  const errors: string[] = [];

  for (const cmd of commands) {
    const result = validateCommand(cmd);
    if (result.valid) {
      validCommands.push(cmd.trim());
    } else {
      errors.push(result.reason!);
    }
  }

  return { validCommands, errors };
}
