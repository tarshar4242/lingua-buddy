# Lingua Buddy

Lingua Buddy 是一個自用手機英文學習 PWA。第一版重點不是考試題庫，而是把你正在讀的論文、英文演講稿、英文網頁內容，轉成可以累積、複習、跟讀的英文詞彙庫。

目前已接上 Supabase 雲端同步。沒有網路或 Supabase 沒設定時，仍會先存在手機瀏覽器本機。

## 目前適合的使用情境

- 讀 paper abstract、introduction、method、result、discussion
- 準備英文簡報或英文演講稿
- 閱讀英文技術文件、網頁、新聞或部落格
- 把不熟的英文詞彙加入複習
- 用重要句子做口說跟讀
- 在手機上接續之前的學習進度

## 功能

- 閱讀場景：論文、英文演講、英文網頁、簡報詞彙、考試輔助、自由輸入
- 內容輸入：貼上 paper 段落、演講稿、網頁文字或中文主題
- 詞彙抽取：自動抓長詞、學術詞、常見閱讀詞
- 中文提示：內建部分學術詞提示，例如 `retrieval`、`reliability`、`hallucination`
- 詞彙庫：把每次抽出的詞累積起來
- 錯題本：把不熟的詞或口說問題存起來
- 複習列表：根據錯題安排複習
- 口說跟讀：播放英文句子，用瀏覽器語音辨識做基礎比對
- Supabase 同步：課程、詞彙、錯題、進度會同步到雲端
- PWA：可加到手機主畫面

## 手機使用方式

部署到 GitHub Pages 後，用手機瀏覽器打開 GitHub Pages 網址。

建議使用：

- iPhone：Safari
- Android：Chrome

手機加入主畫面：

- iPhone Safari：分享按鈕 → 加入主畫面
- Android Chrome：右上選單 → 加到主畫面

語音功能注意：

- 語音播放通常可用
- 語音辨識依瀏覽器支援度不同，Chrome 通常比較穩
- 精準音素級發音評分尚未加入，目前只是文字辨識後比對完整度

## 本機預覽

在這個資料夾執行：

```bash
python3 -m http.server 5173
```

打開：

```text
http://localhost:5173
```

Supabase SQL 複製頁：

```text
http://localhost:5173/setup.html
```

## GitHub Pages 部署

這個專案是純靜態網站，可以直接用 GitHub Pages。

### 方法一：用 GitHub 網頁上傳

1. 到 GitHub 建立新 repository，例如 `lingua-buddy`
2. 把本資料夾所有檔案上傳到 repository 根目錄
3. 到 repository 的 `Settings`
4. 進入 `Pages`
5. `Build and deployment` 選：
   - Source：`Deploy from a branch`
   - Branch：`main`
   - Folder：`/root`
6. 按 Save
7. 等 1 到 3 分鐘，GitHub 會產生 Pages 網址

### 方法二：用 git 指令

如果你已經有 GitHub repo URL：

```bash
git init
git add .
git commit -m "Initial Lingua Buddy PWA"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

再到 GitHub repo 的 `Settings` → `Pages` 啟用。

## Supabase 設定

目前已使用：

```text
Project URL:
https://vmxhfkmhvscylfheovtr.supabase.co
```

設定檔在：

```text
supabase-config.js
```

目前格式：

```js
window.LINGUA_BUDDY_SUPABASE = {
  enabled: true,
  url: "https://vmxhfkmhvscylfheovtr.supabase.co",
  anonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  ownerId: "my-phone-learning",
};
```

注意：

- 可以放 `anon public key` 或 publishable key
- 不可以放 `service_role` key
- 不可以放 database password

## Supabase SQL

到 Supabase：

`SQL Editor` → `New query` → 貼上以下 SQL → `Run`

```sql
create table if not exists public.learning_states (
  owner_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.learning_states enable row level security;

drop policy if exists "single owner read" on public.learning_states;
drop policy if exists "single owner write" on public.learning_states;
drop policy if exists "single owner update" on public.learning_states;

create policy "single owner read"
on public.learning_states
for select
to anon
using (owner_id = 'my-phone-learning');

create policy "single owner write"
on public.learning_states
for insert
to anon
with check (owner_id = 'my-phone-learning');

create policy "single owner update"
on public.learning_states
for update
to anon
using (owner_id = 'my-phone-learning')
with check (owner_id = 'my-phone-learning');
```

同一份 SQL 也放在：

```text
supabase-schema.sql
```

手機不好複製 SQL 時，可以打開：

```text
setup.html
```

裡面有「複製 SQL」按鈕。

## 資料存在哪裡

資料分兩層保存。

### 1. 手機本機

存在瀏覽器 `localStorage`。

優點：

- 不用登入
- 沒網路也能先用
- 速度快

缺點：

- 換手機不會自動帶過去
- 清除瀏覽器資料會消失
- Safari 和 Chrome 是不同資料

### 2. Supabase 雲端

存在 Supabase `learning_states` 表。

目前第一版用一筆 JSON 保存全部狀態，欄位是：

```text
owner_id: my-phone-learning
state: JSON learning state
updated_at: last sync time
```

`state` 裡包含：

- `lessons`：閱讀任務與課程內容
- `vocabulary`：詞彙庫
- `mistakes`：錯題本
- `sessions`：學習進度紀錄
- `sentences`：跟讀句
- `sourceType`：目前來源類型，例如 paper、talk、web
- `streak`：連續練習天數
- `lastPracticeDate`：最後練習日期

## 同步狀態說明

畫面右上角會顯示同步狀態：

- `本機保存`：只存在手機本機，沒有連 Supabase
- `雲端同步中`：正在寫入 Supabase
- `雲端已同步`：已成功寫入 Supabase
- `雲端連線失敗`：讀取 Supabase 失敗
- `雲端同步失敗`：寫入 Supabase 失敗
- `雲端套件未載入`：Supabase CDN 沒載入，通常是網路或擋 CDN

## 隱私與安全注意

這是自用版，不是多人正式產品。

目前 Supabase policy 使用固定：

```text
owner_id = my-phone-learning
```

代表這個 GitHub Pages 網址如果公開給別人，別人也可能使用同一份資料狀態。自用時不要把網址公開散播。

正式多人版本應改成：

- Supabase Auth 登入
- 每個使用者一個 `user_id`
- Row Level Security 用 `auth.uid()` 隔離資料
- 不再用固定 `ownerId`

## 目前限制

- 目前是規則式詞彙抽取，不是 AI 完整語意分析
- 中文提示只內建一小批常見學術詞
- 不能直接貼 URL 自動抓網頁，手機第一版先採用「複製網頁文字貼上」
- 口說回饋是語音辨識文字比對，不是精準發音評分
- Supabase 資料目前是一筆 JSON，之後可拆正式表

## 未來可加功能

- OpenAI 分析：摘要、翻譯、例句、同義詞、用法
- OpenAI Realtime：真正英文對話陪練
- Azure Pronunciation Assessment：音素級發音糾正
- URL 抓取：貼英文網頁網址後自動讀內容
- PDF 匯入：上傳論文 PDF 後抽 abstract 和重點段落
- 正式資料表：拆成 `materials`、`vocabulary`、`mistakes`、`reviews`、`sessions`
- 登入同步：Google login 或 email magic link

## 檔案說明

```text
index.html              主畫面
styles.css              視覺樣式與手機版排版
app.js                  學習流程、詞彙抽取、口說比對、Supabase 同步
supabase-config.js      Supabase URL 和 publishable/anon key
supabase-schema.sql     Supabase 資料表與 RLS policy
setup.html              手機複製 SQL 用頁面
manifest.webmanifest    PWA 設定
sw.js                   Service Worker 快取
icon.svg                PWA 圖示
.nojekyll               GitHub Pages 靜態檔案設定
```

## 快速檢查

部署後請檢查：

1. 手機打開 GitHub Pages 網址
2. 右上角是否顯示 `雲端已同步`
3. 到「輸入」貼上論文段落
4. 按「分析並加入詞彙」
5. 到「詞彙」確認有詞彙卡
6. 按「加入複習」
7. 到「複習」確認該詞出現
8. 到 Supabase Table Editor 確認 `learning_states` 有更新時間
