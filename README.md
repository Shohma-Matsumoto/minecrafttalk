# MinecraftTalk

Minecraftのチャットに日本語で指示を打つだけでコマンドが実行されるツール。

Minecraft Bedrock Edition + LLM (Ollama / OpenAI / Gemini / Claude) + Node.js WebSocketサーバーで動作します。

## 動作の仕組み

```
プレイヤー ─→ Minecraft チャット ─→ WebSocket ─→ MinecraftTalk サーバー
                                                        │
                                                   LLM に送信
                                                   (Ollama等)
                                                        │
                                                   コマンド生成
                                                        │
プレイヤー ←─ Minecraft で実行 ←─── WebSocket ←────────┘
```

チャットに `!ダイヤモンドを64個ちょうだい` と打つと、LLM が `/give @s diamond 64` に変換して自動実行します。

---

## Windows セットアップ（ゼロから手順）

### 必要なもの

| ソフトウェア | 用途 |
|---|---|
| Minecraft Bedrock Edition | Windows 10/11 の Microsoft Store 版 |
| Node.js 20 以上 | サーバー実行環境 |
| Ollama | ローカル LLM（無料、APIキー不要） |
| Git | リポジトリのクローン |

---

### Step 1: Node.js をインストール

1. https://nodejs.org にアクセス
2. **LTS** (推奨版) をダウンロード
3. インストーラーを実行（デフォルト設定のまま「Next」で OK）
4. インストール確認:

```powershell
node --version
# v20.x.x 以上が表示されれば OK
npm --version
```

---

### Step 2: Git をインストール（未インストールの場合）

1. https://git-scm.com/download/win にアクセス
2. 「64-bit Git for Windows Setup」をダウンロード
3. インストーラーを実行（デフォルト設定のまま「Next」で OK）
4. インストール確認:

```powershell
git --version
```

---

### Step 3: Ollama をインストール

1. https://ollama.com/download にアクセス
2. 「Download for Windows」をクリック
3. `OllamaSetup.exe` をダウンロードして実行
4. インストールが完了すると、タスクトレイ（画面右下）に Ollama アイコンが表示される
5. インストール確認:

```powershell
ollama --version
# ollama version 0.x.x が表示されれば OK
```

6. モデルをダウンロード（初回のみ、約4.7GB）:

```powershell
ollama pull qwen2.5:7b
```

ダウンロードが完了したら Ollama の準備は OK。Ollama はバックグラウンドで自動起動するので、毎回手動で起動する必要はありません。

> **メモリが少ない PC（8GB 以下）の場合:**
> より軽量なモデルを使うこともできます:
> ```powershell
> ollama pull qwen2.5:3b
> ```
> この場合、`.env` で `LLM_MODEL=qwen2.5:3b` に設定してください。

---

### Step 4: MinecraftTalk をセットアップ

```powershell
# リポジトリをクローン
git clone https://github.com/Shohma-Matsumoto/minecrafttalk.git
cd minecrafttalk

# 依存パッケージをインストール
npm install

# 設定ファイルを作成
copy .env.example .env
```

`.env` はデフォルトで Ollama を使う設定になっています。Ollama を使う場合は編集不要です。

---

### Step 5: Windows ループバック制限を解除する（重要）

**Minecraft Bedrock Edition（Microsoft Store版）は、初期状態では `localhost` への接続がブロックされています。** この手順を飛ばすと `/connect` が失敗します。

PowerShell を **管理者として実行** し、以下のコマンドを入力:

```powershell
CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"
```

`OK.` と表示されれば成功です。**この作業は1回だけ行えば OK** です（PC再起動後も有効）。

> **なぜ必要？**
> Microsoft Store アプリ（UWP アプリ）はセキュリティ上、localhost への通信が制限されています。この制限を解除しないと、Minecraft から `ws://localhost:3000` に接続できません。

---

### Step 6: サーバーを起動

```powershell
npm start
```

以下が表示されたら準備完了:

```
[MinecraftTalk] サーバー起動: ws://localhost:3000
[MinecraftTalk] Minecraftで /connect ws://localhost:3000 を実行してください
```

---

### Step 7: Minecraft から接続

1. **Minecraft Bedrock Edition** を起動
2. ワールドを作成 or 開く
   - **チートをオンにする**（ワールド設定 → チートの実行 → ON）
3. チャット画面を開いて（T キーまたは Enter）以下を入力:

```
/connect ws://localhost:3000
```

4. `[MinecraftTalk] 接続しました！チャットに !指示 と打つとコマンドを実行します` と表示されたら接続成功

---

### Step 8: 遊ぶ

チャットに `!` をつけて日本語で指示を入力:

```
!ダイヤモンドを64個ちょうだい
!目の前に石ブロックを10個並べて
!天気を晴れにして
!クリエイティブモードにして
!ニワトリを3匹呼んで
!足元に池を作って
!夜にして
!空を飛べるようにして
```

`!` をつけない通常のチャットはそのまま送信されます。

---

## 設定 (.env)

| 変数 | デフォルト | 説明 |
|---|---|---|
| `PORT` | `3000` | WebSocket サーバーのポート |
| `LLM_PROVIDER` | `ollama` | LLM プロバイダー (`ollama` / `openai` / `gemini` / `claude`) |
| `LLM_API_KEY` | — | API キー（ollama 以外で必要） |
| `LLM_MODEL` | プロバイダー依存 | 使用するモデル名 |
| `LLM_BASE_URL` | プロバイダー依存 | カスタムエンドポイント（省略可） |

### プロバイダー別の設定例

**Ollama（デフォルト、APIキー不要）:**
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

---

## トラブルシューティング

### `/connect` しても接続できない

1. **サーバーが起動しているか確認**: `npm start` で `サーバー起動` のメッセージが出ているか
2. **ループバック制限を解除したか確認**: [Step 5](#step-5-windows-ループバック制限を解除する重要) を実施済みか
3. **ファイアウォール**: Windows Defender ファイアウォールで Node.js の通信を許可する
   - 初回起動時に「アクセスを許可しますか？」のダイアログが出たら「許可」を選択
4. **チートがオンか確認**: ワールド設定でチートの実行が ON になっているか

### `ollama pull` でエラーが出る

- Ollama がインストールされているか確認: `ollama --version`
- タスクトレイに Ollama アイコンがあるか確認。なければ Ollama アプリを手動起動

### 「LLMからの応答が空でした」エラー

- Ollama が動いているか確認: ブラウザで http://localhost:11434 にアクセスし「Ollama is running」と表示されるか
- モデルがダウンロード済みか確認: `ollama list` で `qwen2.5:7b` が表示されるか

### レスポンスが遅い

- Ollama のローカル LLM は PC のスペック（特に RAM と GPU）に依存します
- 軽量モデル `qwen2.5:3b` に変更すると改善する場合があります
- 高速に使いたい場合は `openai` や `gemini` プロバイダーに切り替えてください（APIキーが必要）

---

## 対応コマンド

LLM が生成できるコマンドは安全のため以下に制限されています:

| コマンド | 用途 | 例 |
|---|---|---|
| `/setblock` | ブロック1つ設置 | `/setblock ~1 ~0 ~0 stone` |
| `/fill` | 範囲にブロック設置 | `/fill ~0 ~0 ~1 ~0 ~0 ~10 dirt` |
| `/give` | アイテム付与 | `/give @s diamond 64` |
| `/tp` | テレポート | `/tp @s ~0 ~10 ~0` |
| `/weather` | 天気変更 | `/weather clear` |
| `/time` | 時刻変更 | `/time set day` |
| `/summon` | エンティティ召喚 | `/summon pig ~2 ~0 ~0` |
| `/gamemode` | ゲームモード変更 | `/gamemode creative @s` |
| `/effect` | エフェクト付与 | `/effect @s speed 30 2` |
| `/clear` | アイテム削除 | `/clear @s` |
| `/enchant` | エンチャント | `/enchant @s sharpness 5` |

`/kick`、`/ban`、`/op` などの管理系コマンドはブロックされます。

---

## 開発

```powershell
# ファイル変更を監視して自動再起動
npm run dev
```
