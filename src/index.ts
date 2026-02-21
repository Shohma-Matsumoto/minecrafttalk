import 'dotenv/config';
import Mcwss from 'mcwss';
import { translateToCommands } from './llm';
import { validateCommands } from './commands';

const PORT = Number(process.env.PORT) || 3000;
const PREFIX = '!';

const server = new Mcwss({ server: PORT });

server.on('connection', ({ client }) => {
  console.log('[MinecraftTalk] プレイヤーが接続しました');
  client.chat('[MinecraftTalk] 接続しました！チャットに !指示 と打つとコマンドを実行します');
});

server.on('player_message', async ({ body, client }) => {
  const { message, sender, type } = body;

  // コマンド出力やシステムメッセージは無視
  if (type !== 'chat') return;
  if (!message.startsWith(PREFIX)) return;

  const userInput = message.slice(PREFIX.length).trim();
  if (!userInput) return;

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
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    client.chat(`[MinecraftTalk] エラーが発生しました: ${errorMessage}`);
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
