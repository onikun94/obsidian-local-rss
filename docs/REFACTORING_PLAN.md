# リファクタリング設計書

## 概要

main.tsが950行に肥大化し、複数の責任を持つ状態になっているため、
Clean ArchitectureとSOLID原則に基づいてリファクタリングを実施する。

---

## 設計原則

- **Single Responsibility Principle (SRP)**: 各クラス・モジュールは1つの責任のみ
- **Dependency Inversion Principle (DIP)**: 具象ではなく抽象に依存
- **Open/Closed Principle (OCP)**: 拡張に開いて、修正に閉じる

---

## レイヤー構造

```
┌─────────────────────────────────────┐
│   UI Layer (UI)                     │  ← Modal, SettingTab
├─────────────────────────────────────┤
│   Use Cases (Orchestration)         │  ← UpdateFeeds, DeleteOldFiles
├─────────────────────────────────────┤
│   Domain Layer (Business Logic)     │  ← Services, Models
├─────────────────────────────────────┤
│   Adapters Layer (I/O)              │  ← Parsers, HTTP, File
└─────────────────────────────────────┘
```

---

## 最終ディレクトリ構造

```
src/
├── models/              # データモデル（エンティティ）
│   ├── Feed.ts         # フィード設定
│   ├── RssItem.ts      # RSS記事データ
│   └── Settings.ts     # プラグイン設定
│
├── services/            # ドメインサービス（ビジネスロジック）
│   ├── FeedProcessor.ts      # フィード処理のコアロジック
│   └── ImageExtractor.ts     # 画像抽出ロジック
│
├── adapters/            # 外部依存・I/O処理
│   ├── parsers/        # XMLパーサー
│   │   ├── RssFeedParser.ts
│   │   ├── AtomFeedParser.ts
│   │   └── XmlNormalizer.ts
│   ├── http/           # HTTP通信
│   │   └── FeedFetcher.ts
│   └── file/           # ファイル操作
│       └── MarkdownWriter.ts
│
├── usecases/            # ユースケース（アプリケーション層）
│   ├── UpdateFeeds.ts   # フィード更新処理
│   └── DeleteOldFiles.ts # 古いファイル削除処理
│
├── ui/                  # UI層
│   ├── modals/
│   │   └── AddFeedModal.ts
│   └── settings/
│       └── SettingTab.ts
│
├── utils/               # ユーティリティ
│   ├── htmlProcessor.ts     # 既存
│   ├── yamlFormatter.ts     # NEW: YAML処理
│   └── templateEngine.ts    # NEW: テンプレート処理
│
└── types/               # 型定義
    ├── RssFeed.ts      # RSS/Atom関連の型
    └── index.ts        # 型のエクスポート
```

---

## 主要クラスの責任分担

### 1. Models（データモデル）

#### `Feed.ts`
```typescript
export interface Feed {
  url: string;
  name: string;
  folder: string;
  enabled: boolean;
}
```

#### `RssItem.ts`
```typescript
export interface RssItem {
  title: string;
  description: string;
  content: string;
  link: string;
  pubDate: string;
  author: string;
  categories: string[];
  imageUrl: string;
  savedDate: string;
}
```

#### `Settings.ts`
```typescript
export interface Settings {
  feeds: Feed[];
  folderPath: string;
  template: string;
  // ... その他の設定
}
```

---

### 2. Services（ドメインサービス）

#### `FeedProcessor.ts`
**責任**: フィードアイテムを RssItem に変換するビジネスロジック

```typescript
export class FeedProcessor {
  constructor(
    private imageExtractor: ImageExtractor,
    private settings: Settings
  ) {}

  processRssItem(item: RssFeedItem, feed: Feed): RssItem {
    // RSS item を RssItem に変換
    // 画像抽出、カテゴリ正規化など
  }

  processAtomItem(item: AtomFeedItem, feed: AtomFeed): RssItem {
    // Atom item を RssItem に変換
  }
}
```

#### `ImageExtractor.ts`
**責任**: 画像URLの抽出

```typescript
export class ImageExtractor {
  extractFromMediaElements(item: RssFeedItem | AtomFeedItem): string {
    // media:content, media:thumbnail, enclosure から抽出
  }

  extractFromHtmlContent(html: string): string {
    // HTMLコンテンツから <img> タグを抽出
  }

  async fetchFromUrl(url: string): Promise<string> {
    // OGP画像を取得
  }
}
```

---

### 3. Adapters（アダプター層）

#### `adapters/parsers/RssFeedParser.ts`
**責任**: RSS XMLをパース

```typescript
export class RssFeedParser {
  async parse(xml: string): Promise<RssFeed> {
    // xml2js でパース
    // RssFeed 形式に変換
  }
}
```

#### `adapters/parsers/AtomFeedParser.ts`
**責任**: Atom XMLをパース

```typescript
export class AtomFeedParser {
  async parse(xml: string): Promise<AtomFeed> {
    // xml2js でパース
    // AtomFeed 形式に変換
  }
}
```

#### `adapters/parsers/XmlNormalizer.ts`
**責任**: xml2jsの出力を正規化

```typescript
export class XmlNormalizer {
  normalizeValue(value: string | { _: string } | undefined): string {
    // xml2jsのオブジェクトを文字列に正規化
  }

  normalizeLink(link: { href: string } | { href: string }[] | undefined): string {
    // Atom の link を正規化
  }
}
```

#### `adapters/http/FeedFetcher.ts`
**責任**: フィードのHTTP取得

```typescript
export class FeedFetcher {
  async fetch(url: string): Promise<string> {
    // requestUrl を使って取得
  }
}
```

#### `adapters/file/MarkdownWriter.ts`
**責任**: Markdownファイルの作成

```typescript
export class MarkdownWriter {
  constructor(
    private vault: Vault,
    private settings: Settings
  ) {}

  async write(item: RssItem, folderPath: string): Promise<void> {
    // テンプレートを使ってMarkdownを生成
    // ファイル作成
  }

  async deleteOldFiles(folderPath: string, cutoffDate: number): Promise<void> {
    // 古いファイルを削除
  }
}
```

---

### 4. Use Cases（ユースケース）

#### `usecases/UpdateFeeds.ts`
**責任**: フィード更新処理のオーケストレーション

```typescript
export class UpdateFeeds {
  constructor(
    private fetcher: FeedFetcher,
    private rssParser: RssFeedParser,
    private atomParser: AtomFeedParser,
    private processor: FeedProcessor,
    private writer: MarkdownWriter
  ) {}

  async execute(feeds: Feed[]): Promise<void> {
    for (const feed of feeds) {
      // 1. フィードを取得
      const xml = await this.fetcher.fetch(feed.url);

      // 2. パース
      const parsed = await this.parseXml(xml);

      // 3. 処理
      const items = this.processor.process(parsed, feed);

      // 4. 保存
      for (const item of items) {
        await this.writer.write(item, feed.folder);
      }
    }
  }
}
```

#### `usecases/DeleteOldFiles.ts`
**責任**: 古いファイルの削除

```typescript
export class DeleteOldFiles {
  constructor(
    private writer: MarkdownWriter,
    private settings: Settings
  ) {}

  async execute(folderPath: string): Promise<void> {
    const cutoffDate = this.calculateCutoffDate();
    await this.writer.deleteOldFiles(folderPath, cutoffDate);
  }
}
```

---

### 5. UI Layer（UI層）

#### `ui/modals/AddFeedModal.ts`
**責任**: フィード追加モーダルの表示

```typescript
export class AddFeedModal extends Modal {
  // 現在の実装をそのまま移動
}
```

#### `ui/settings/SettingTab.ts`
**責任**: 設定画面の表示

```typescript
export class SettingTab extends PluginSettingTab {
  // 現在の実装をそのまま移動
}
```

---

### 6. Utils（ユーティリティ）

#### `utils/yamlFormatter.ts`
**責任**: YAML値のエスケープとフォーマット

```typescript
export function escapeYamlValue(value: string): string {
  // YAML特殊文字のエスケープ
}
```

#### `utils/templateEngine.ts`
**責任**: テンプレート処理

```typescript
export class TemplateEngine {
  render(template: string, data: RssItem): string {
    // {{title}}, {{content}} などを置換
  }

  prepareTemplate(template: string, item: RssItem): string {
    // 画像がない場合は {{image}} 行を削除
  }
}
```

---

### 7. Plugin本体（main.ts）

**責任**: DIコンテナ + ユースケースの呼び出し

```typescript
export default class LocalRssPlugin extends Plugin {
  settings: Settings;

  // Use Cases
  private updateFeedsUseCase: UpdateFeeds;
  private deleteOldFilesUseCase: DeleteOldFiles;

  async onload() {
    await this.loadSettings();

    // 依存性の注入
    this.initializeUseCases();

    // コマンド登録
    this.addCommand({
      id: 'update-rss-feeds',
      name: 'Update RSS Feeds',
      callback: () => this.updateFeedsUseCase.execute(this.settings.feeds)
    });

    // UI登録
    this.addSettingTab(new SettingTab(this.app, this));
  }

  private initializeUseCases() {
    // サービス・アダプターの初期化
    const fetcher = new FeedFetcher();
    const rssParser = new RssFeedParser();
    const atomParser = new AtomFeedParser();
    const imageExtractor = new ImageExtractor();
    const processor = new FeedProcessor(imageExtractor, this.settings);
    const writer = new MarkdownWriter(this.app.vault, this.settings);

    // ユースケースの初期化
    this.updateFeedsUseCase = new UpdateFeeds(
      fetcher,
      rssParser,
      atomParser,
      processor,
      writer
    );

    this.deleteOldFilesUseCase = new DeleteOldFiles(writer, this.settings);
  }
}
```

---

## リファクタリングのステップ

### Phase 1: 型定義の分離 ✅
1. `src/types/` ディレクトリ作成
2. インターフェースを移動
3. `types/index.ts` で再エクスポート

### Phase 2: ユーティリティの分離 ✅
1. `utils/yamlFormatter.ts` 作成
2. `utils/templateEngine.ts` 作成
3. YAML/テンプレート処理を移動

### Phase 3: アダプター層の作成 🔄
1. `adapters/parsers/XmlNormalizer.ts` 作成
2. `adapters/parsers/RssFeedParser.ts` 作成
3. `adapters/parsers/AtomFeedParser.ts` 作成
4. `adapters/http/FeedFetcher.ts` 作成
5. `adapters/file/MarkdownWriter.ts` 作成

### Phase 4: ドメインサービスの抽出 🔄
1. `services/ImageExtractor.ts` 作成
2. `services/FeedProcessor.ts` 作成
3. ビジネスロジックを移動

### Phase 5: ユースケースの抽出 🔄
1. `usecases/UpdateFeeds.ts` 作成
2. `usecases/DeleteOldFiles.ts` 作成

### Phase 6: UI層の分離 🔄
1. `ui/modals/AddFeedModal.ts` 作成
2. `ui/settings/SettingTab.ts` 作成

### Phase 7: main.tsの簡素化 🔄
1. DIコンテナとして再構成
2. 薄いレイヤーに

---

## テスト戦略

各レイヤーでテスタビリティを確保：

- **Models**: 型定義なのでテスト不要
- **Services**: 単体テスト可能（依存注入）
- **Adapters**: モック化してテスト
- **Use Cases**: 統合テスト
- **UI**: E2Eテスト（手動）

---

## 移行戦略

1. **段階的移行**: 一度に全部変えない
2. **既存機能を維持**: 各Phaseでビルド・動作確認
3. **コミット単位**: 各Phase完了時にコミット
4. **ブランチ戦略**: `refactor/architecture` ブランチで作業

---

## 参考資料

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
