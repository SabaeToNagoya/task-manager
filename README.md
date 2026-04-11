# ガントチャート付きタスク管理アプリ

React + Vite + Supabase 製の個人向けタスク管理アプリ。  
GitHub → Vercel の CI/CD で自動デプロイ対応。

---

## 🚀 デプロイ手順 (GitHub + Vercel)

### ステップ 1 — Supabase テーブル作成

Supabase ダッシュボード → **SQL Editor** を開き、
`schema.sql` の内容をすべて貼り付けて **Run** をクリック。

---

### ステップ 2 — GitHub にプッシュ

**ターミナル** (macOS) または **コマンドプロンプト** (Windows) で:

```bash
# 1. このフォルダに移動
cd gantt-task-app

# 2. Git を初期化
git init
git add .
git commit -m "first commit"

# 3. GitHub で新しいリポジトリを作成後、以下を実行
#    (GitHub の画面に表示されるコマンドに置き換えてください)
git remote add origin https://github.com/あなたのID/リポジトリ名.git
git branch -M main
git push -u origin main
```

> GitHub Desktop を使う場合は「Add Local Repository」からフォルダを追加して Push するだけでも OK です。

---

### ステップ 3 — Vercel に接続

1. https://vercel.com にログイン（GitHub アカウントで OK）
2. **Add New Project** → 作成したリポジトリを選択
3. **Framework Preset** が `Vite` になっていることを確認
4. **Environment Variables** に以下の 2 つを追加:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://dfimsizjzoxwrtfglwzd.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_dttRmQGiyOJ2JpPv-5nGqg_7WEcnD75` |

5. **Deploy** ボタンをクリック → 約1分でデプロイ完了 ✅

以降は `git push` するたびに自動デプロイされます。

---

## 📁 ファイル構成

```
gantt-task-app/
├── src/
│   ├── App.jsx        # 全コンポーネント・ロジック
│   ├── App.css        # ダークテーマCSS
│   ├── supabase.js    # Supabase クライアント
│   └── main.jsx       # エントリーポイント
├── index.html
├── vite.config.js
├── vercel.json        # Vercel SPA リダイレクト設定
├── schema.sql         # Supabase テーブル作成SQL
├── .env.example       # 環境変数のサンプル
└── package.json
```

## 機能一覧

- ガントチャート (月単位、横スクロール)
- 土日ハイライト・今日の列ハイライト
- タスク追加・編集・削除
- 進捗バー・状態バッジ
- メモ (自動保存)
- 工数入力 (日別・月合計)
- ダークテーマ
- iPhone / iPad / PC レスポンシブ対応
