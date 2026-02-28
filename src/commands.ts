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
  // サーバー管理
  '/kick', '/ban', '/ban-ip', '/pardon',
  '/op', '/deop', '/stop',
  '/whitelist', '/setmaxplayers', '/changesetting',
  '/save-all', '/save-off', '/save-on',
  // ホワイトリストを迂回できるメタコマンド
  '/execute', '/function', '/scriptevent', '/reload',
  // WebSocket / 接続操作（Windows環境への影響防止）
  '/connect', '/wsserver', '/closewebsocket',
  // 破壊的コマンド
  '/kill', '/damage',
  // ワールド設定の改変
  '/gamerule', '/difficulty',
  '/worldbuilder', '/wb',
  // 大規模ワールド操作（フリーズ・クラッシュの原因）
  '/clone', '/spreadplayers', '/structure',
  // プレイヤー入力の奪取
  '/inputpermission',
  // なりすまし・ソーシャルエンジニアリング
  '/tell', '/msg', '/w', '/say', '/me',
  '/title', '/titleraw', '/tellraw',
  // スコアボード・タグ操作
  '/tag', '/scoreboard',
];

/** /fill コマンドの1軸あたりの最大ブロック数 */
const MAX_FILL_AXIS = 50;
/** /fill コマンドの最大ブロック数（体積） */
const MAX_FILL_VOLUME = 10000;
/** 1リクエストあたりの最大コマンド数 */
const MAX_COMMANDS_PER_REQUEST = 20;

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

/**
 * 座標文字列（~10, ^-5, 100 など）から数値を抽出する。
 * ~ や ^ 単体は 0 として扱う。パース不能なら null。
 */
function parseCoordValue(coord: string): number | null {
  if (coord.startsWith('~') || coord.startsWith('^')) {
    const num = coord.slice(1);
    if (num === '' || num === '0') return 0;
    const v = parseFloat(num);
    return isNaN(v) ? null : v;
  }
  const v = parseFloat(coord);
  return isNaN(v) ? null : v;
}

/**
 * /fill コマンドの範囲が安全かチェックする。
 * /fill <x1> <y1> <z1> <x2> <y2> <z2> <block> ...
 */
function validateFillRange(args: string[]): { valid: boolean; reason?: string } {
  if (args.length < 7) {
    return { valid: false, reason: '/fill の引数が不足しています' };
  }

  const coords = args.slice(0, 6).map(parseCoordValue);

  // 座標がすべてパースできた場合のみ範囲チェック
  if (coords.some((c) => c === null)) {
    return { valid: true }; // パース不能な座標は通す（Minecraft側でエラーになる）
  }

  const [x1, y1, z1, x2, y2, z2] = coords as number[];
  const dx = Math.abs(x2 - x1) + 1;
  const dy = Math.abs(y2 - y1) + 1;
  const dz = Math.abs(z2 - z1) + 1;

  if (dx > MAX_FILL_AXIS || dy > MAX_FILL_AXIS || dz > MAX_FILL_AXIS) {
    return {
      valid: false,
      reason: `/fill の範囲が大きすぎます (${dx}x${dy}x${dz})。各軸${MAX_FILL_AXIS}ブロック以内にしてください`,
    };
  }

  const volume = dx * dy * dz;
  if (volume > MAX_FILL_VOLUME) {
    return {
      valid: false,
      reason: `/fill の体積が大きすぎます (${volume}ブロック)。${MAX_FILL_VOLUME}ブロック以内にしてください`,
    };
  }

  return { valid: true };
}

export function validateCommand(command: string): { valid: boolean; reason?: string } {
  const trimmed = command.trim();

  if (!trimmed.startsWith('/')) {
    return { valid: false, reason: `コマンドは / で始まる必要があります: ${trimmed}` };
  }

  const parts = trimmed.split(/\s+/);
  const commandName = parts[0].toLowerCase();

  if (BLOCKED_COMMANDS.includes(commandName)) {
    return { valid: false, reason: `禁止されたコマンドです: ${commandName}` };
  }

  if (!ALLOWED_COMMANDS.includes(commandName)) {
    return { valid: false, reason: `許可されていないコマンドです: ${commandName}` };
  }

  // /fill の範囲チェック
  if (commandName === '/fill') {
    const fillResult = validateFillRange(parts.slice(1));
    if (!fillResult.valid) return fillResult;
  }

  return { valid: true };
}

export function validateCommands(commands: string[]): {
  validCommands: string[];
  errors: string[];
} {
  const validCommands: string[] = [];
  const errors: string[] = [];

  if (commands.length > MAX_COMMANDS_PER_REQUEST) {
    errors.push(
      `コマンド数が多すぎます (${commands.length}件)。1回のリクエストで${MAX_COMMANDS_PER_REQUEST}件までです`
    );
    return { validCommands, errors };
  }

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
