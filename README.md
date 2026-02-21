# MinecraftTalk

Minecraftのチャットに日本語で指示を打つだけでコマンドが実行されるツール。

Minecraft Bedrock Edition + LLM (Ollama / OpenAI / Gemini / Claude) + Node.js WebSocketサーバーで動作します。

## 必要なもの

- Node.js 20以上
- Minecraft Bedrock Edition（Windows 10/11、iOS、Android など）
- LLMプロバイダー（以下のいずれか）:
  - [Ollama](https://ollama.com)（ローカルLLM、デフォルト）
  - [OpenAI](https://platform.openai.com/) APIキー
  - [Google Gemini](https://ai.google.dev/) APIキー
  - [Anthropic Claude](https://console.anthropic.com/) APIキー

## セットアップ

### 1. Ollama をインストール

https://ollama.com からダウンロードしてインストール。

### 2. モデルをダウンロード

```bash
ollama pull qwen2.5:7b
```

### 3. このプロジェクトをセットアップ

```bash
npm install
cp .env.example .env
```

### 4. サーバーを起動

```bash
npm start
```

`[MinecraftTalk] サーバー起動: ws://localhost:3000` と表示されたら準備完了。

### 5. Minecraft から接続

1. Minecraftを起動してワールドに入る（**チートをオンにする**）
2. チャット画面を開いて以下を入力:

```
/connect ws://localhost:3000
```

`[MinecraftTalk] 接続しました！` と表示されたら接続成功。

## 使い方

チャットに `!` をつけて日本語で指示を入力します。

```
!ダイヤモンドを64個ちょうだい
!目の前に石ブロックを10個並べて
!天気を晴れにして
!クリエイティブモードにして
!ニワトリを3匹呼んで
```

`!` をつけない通常のチャットはそのまま送信されます。

## 設定 (.env)

| 変数 | デフォルト | 説明 |
|---|---|---|
| `PORT` | `3000` | WebSocketサーバーのポート |
| `LLM_PROVIDER` | `ollama` | LLMプロバイダー (`ollama` / `openai` / `gemini` / `claude`) |
| `LLM_API_KEY` | — | APIキー（ollama以外で必要） |
| `LLM_MODEL` | プロバイダー依存 | 使用するモデル名 |
| `LLM_BASE_URL` | プロバイダー依存 | カスタムエンドポイント（省略可） |

### プロバイダー別の設定例

**Ollama（デフォルト）:**
```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b
```

**OpenAI:**
```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

**Gemini:**
```env
LLM_PROVIDER=gemini
LLM_API_KEY=AIza...
LLM_MODEL=gemini-2.0-flash
```

**Claude:**
```env
LLM_PROVIDER=claude
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-20250514
```
