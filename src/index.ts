import 'dotenv/config';
import Mcwss from 'mcwss';
import { WebSocketServer, type VerifyClientCallbackSync } from 'ws';
import { translateToCommands } from './llm';
import { validateCommands } from './commands';

const PORT = Number(process.env.PORT) || 3000;
// 認証のない WebSocket のため、既定ではこの PC 内（ループバック）からの接続だけを受け付ける
const ALLOW_REMOTE_CLIENTS = process.env.ALLOW_REMOTE_CLIENTS === 'true';
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const PREFIX = '!';
/** 1回の指示の最大文字数（LLM へのコスト濫用対策） */
const MAX_INPUT_LENGTH = 200;
/** 同一プレイヤーの連続リクエスト最小間隔（ミリ秒） */
const COOLDOWN_MS = 3000;
/** 指示を受け付けるプレイヤー名（カンマ区切り）。未設定なら接続中の全プレイヤー */
const ALLOWED_PLAYERS = (process.env.ALLOWED_PLAYERS || '')
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name !== '');

const lastRequestAt = new Map<string, number>();

const verifyClient: VerifyClientCallbackSync = ({ req }) =>
  ALLOW_REMOTE_CLIENTS || LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? '');

const wss = new WebSocketServer({ port: PORT, verifyClient });
const server = new Mcwss({ server: wss });

server.on('connection', ({ client }) => {
  console.log('[MinecraftTalk] プレイヤーが接続しました');
  client.chat('[MinecraftTalk] 接続しました！チャットに !指示 と打つとコマンドを実行します');
});

server.on('player_message', async ({ body, client }) => {
  const { message, sender, type } = body;

  // コマンド出力やシステムメッセージは無視
  if (type !== 'chat') return;
  if (!message.startsWith(PREFIX)) return;

  if (ALLOWED_PLAYERS.length > 0 && !ALLOWED_PLAYERS.includes(sender)) return;

  const userInput = message.slice(PREFIX.length).trim();
  if (!userInput) return;

  if (userInput.length > MAX_INPUT_LENGTH) {
    client.chat(`[MinecraftTalk] 指示は${MAX_INPUT_LENGTH}文字以内にしてください`);
    return;
  }

  const now = Date.now();
  if (now - (lastRequestAt.get(sender) ?? 0) < COOLDOWN_MS) {
    client.chat('[MinecraftTalk] 少し待ってからもう一度指示してください');
    return;
  }
  lastRequestAt.set(sender, now);

  console.log(`[MinecraftTalk] ${sender}: ${userInput}`);
  client.chat('[MinecraftTalk] 考え中...');

  try {
    const llmResponse = await translateToCommands(userInput);

    if (llmResponse.commands.length === 0) {
      client.chat(`[MinecraftTalk] ${llmResponse.message}`);
      return;
    }

    const { validCommands, errors } = validateCommands(llmResponse.commands);

    for (const error of errors) {
      console.log(`[MinecraftTalk] コマンド拒否: ${error}`);
    }

    for (const cmd of validCommands) {
      console.log(`[MinecraftTalk] 実行: ${cmd}`);
      client.run(cmd);
    }

    client.chat(`[MinecraftTalk] ${llmResponse.message}`);

    if (errors.length > 0) {
      client.chat(`[MinecraftTalk] ${errors.length}件のコマンドがブロックされました`);
    }
  } catch (error) {
    console.error('[MinecraftTalk] エラー:', error);
    // SDK のエラー文には API キーの一部などが含まれうるため、チャットには詳細を出さない
    client.chat('[MinecraftTalk] エラーが発生しました。サーバーのログを確認してください');
  }
});

server.on('close', () => {
  console.log('[MinecraftTalk] プレイヤーが切断しました');
});

server.on('error', ({ error }) => {
  console.error('[MinecraftTalk] サーバーエラー:', error);
});

server.on('ready', () => {
  console.log(`[MinecraftTalk] サーバー起動: ws://localhost:${PORT}`);
  console.log(`[MinecraftTalk] Minecraftで /connect ws://localhost:${PORT} を実行してください`);
});

server.start();
