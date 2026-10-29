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
/** 1コマンドあたりの最大文字数 */
const MAX_COMMAND_LENGTH = 256;
/** 改行などの制御文字（複数コマンドの注入に使われうる） */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
/** 数値座標（絶対 / ~相対 / ^ローカル）。指数表記や Infinity は受け付けない */
const COORD_PATTERN = /^[~^]?(-?\d+(\.\d+)?|-?\.\d+)?$/;
/** 実行者本人を指す唯一の許可ターゲット */
const SELF_TARGET = '@s';

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

  if (
    !Array.isArray(parsed.commands) ||
    !parsed.commands.every((c: unknown) => typeof c === 'string') ||
    typeof parsed.message !== 'string'
  ) {
    throw new Error('LLMの応答が期待する形式ではありません');
  }

  return {
    commands: parsed.commands,
    message: parsed.message,
  };
}

/**
 * 座標文字列（~10, ^-5, 100 など）を種別と数値に分解する。
 * ~ や ^ 単体は 0 として扱う。受け付けない形式（指数表記・文字列混在など）は null。
 */
function parseCoord(coord: string): { kind: '~' | '^' | ''; value: number } | null {
  if (!COORD_PATTERN.test(coord)) return null;
  const kind = coord.startsWith('~') ? '~' : coord.startsWith('^') ? '^' : '';
  const num = kind === '' ? coord : coord.slice(1);
  if (num === '') {
    // 絶対座標は数値が必須。~ / ^ 単体は 0
    return kind === '' ? null : { kind, value: 0 };
  }
  const value = Number(num);
  return Number.isFinite(value) ? { kind, value } : null;
}

/**
 * /fill コマンドの範囲が安全かチェックする。
 * /fill <x1> <y1> <z1> <x2> <y2> <z2> <block> ...
 * 範囲を確定できない座標（パース不能・軸内で相対と絶対が混在）は拒否する。
 */
function validateFillRange(args: string[]): { valid: boolean; reason?: string } {
  if (args.length < 7) {
    return { valid: false, reason: '/fill の引数が不足しています' };
  }

  const coords = args.slice(0, 6).map(parseCoord);
  if (coords.some((c) => c === null)) {
    return { valid: false, reason: '/fill の座標を解釈できません' };
  }

  const [x1, y1, z1, x2, y2, z2] = coords as NonNullable<(typeof coords)[number]>[];
  if (x1.kind !== x2.kind || y1.kind !== y2.kind || z1.kind !== z2.kind) {
    return { valid: false, reason: '/fill は各軸の2つの座標を同じ形式（絶対・~・^）で指定してください' };
  }

  const dx = Math.abs(x2.value - x1.value) + 1;
  const dy = Math.abs(y2.value - y1.value) + 1;
  const dz = Math.abs(z2.value - z1.value) + 1;

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

/** ターゲット引数を持つコマンドの、ターゲットの位置（args 内の添字）。 */
const TARGET_ARG_INDEX: Record<string, number> = {
  '/give': 0,
  '/effect': 0,
  '/enchant': 0,
  '/clear': 0,
  '/gamemode': 1,
  '/tp': 0,
};

/**
 * 影響対象を実行者本人（@s）に限定する。
 * LLM への「@e を使わない」指示だけでは、プロンプトインジェクションや誤生成で
 * 他プレイヤー・全エンティティへ作用するコマンドが通るため、実行前に機械的に検証する。
 */
function validateTargets(commandName: string, args: string[]): { valid: boolean; reason?: string } {
  const badSelector = args.find((a) => a.includes('@') && a !== SELF_TARGET);
  if (badSelector !== undefined) {
    return { valid: false, reason: `ターゲットは ${SELF_TARGET} のみ指定できます: ${commandName}` };
  }

  const index = TARGET_ARG_INDEX[commandName];
  if (index === undefined) return { valid: true };

  const target = args[index];
  if (target === undefined) return { valid: true }; // 省略時は実行者本人
  if (target === SELF_TARGET) return { valid: true };
  // /tp は先頭が座標なら実行者本人の移動
  if (commandName === '/tp' && COORD_PATTERN.test(target)) return { valid: true };
  return { valid: false, reason: `ターゲットは ${SELF_TARGET} のみ指定できます: ${commandName}` };
}

export function validateCommand(command: unknown): { valid: boolean; reason?: string } {
  if (typeof command !== 'string') {
    return { valid: false, reason: 'コマンドが文字列ではありません' };
  }
  const trimmed = command.trim();

  if (trimmed.length > MAX_COMMAND_LENGTH) {
    return { valid: false, reason: `コマンドが長すぎます (${trimmed.length}文字)` };
  }

  if (CONTROL_CHARS.test(trimmed)) {
    return { valid: false, reason: 'コマンドに改行などの制御文字は使えません' };
  }

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

  const targetResult = validateTargets(commandName, parts.slice(1));
  if (!targetResult.valid) return targetResult;

  // /fill の範囲チェック
  if (commandName === '/fill') {
    const fillResult = validateFillRange(parts.slice(1));
    if (!fillResult.valid) return fillResult;
  }

  return { valid: true };
}

export function validateCommands(commands: unknown[]): {
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
      validCommands.push((cmd as string).trim());
    } else {
      errors.push(result.reason!);
    }
  }

  return { validCommands, errors };
}
