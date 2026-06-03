export const SUPPORTED_LOCALES = ["zh-TW", "en-US", "ja-JP"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-TW";

export const LOCALE_LABELS: Record<Locale, string> = {
  "zh-TW": "繁體中文",
  "en-US": "English",
  "ja-JP": "日本語"
};

/**
 * zh-TW is the source of truth: its keys define the full translation contract.
 * Other locales must provide the same key set (enforced by the typed dictionary).
 */
const zhTW = {
  "app.brand": "HTML 簡報生成器",
  "app.title": "生成可預覽的 HTML 簡報",
  "app.language": "語言",

  "form.heading": "簡報設定",
  "form.intro": "提供內容與簡報需求，調整設計方向後即可生成。",
  "form.charCount": "{count} 字",

  "form.source.step": "01",
  "form.source.title": "內容來源",
  "form.source.label": "原始內容",
  "form.source.placeholder": "在此貼上報告、逐字稿、會議記錄或任何想轉成簡報的文字……",
  "form.source.upload": "上傳檔案",
  "form.source.uploadHint": "支援 .txt、.md、.csv 純文字檔",
  "form.source.clear": "清除",

  "form.brief.step": "02",
  "form.brief.title": "簡報需求",
  "form.brief.purpose": "簡報用途",
  "form.brief.purposePlaceholder": "例如：季度營運回顧",
  "form.brief.audience": "目標受眾",
  "form.brief.audiencePlaceholder": "例如：產品與工程主管",
  "form.brief.language": "簡報語言",

  "form.design.step": "03",
  "form.design.title": "設計方向",
  "form.design.stylePreset": "風格預設",
  "form.design.styleDirection": "風格方向（自訂）",
  "form.design.styleDirectionPlaceholder": "描述想要的視覺風格或語氣",
  "form.design.chartEmphasis": "圖表強調（自訂）",
  "form.design.chartEmphasisPlaceholder": "想突顯的數據重點",
  "form.design.chartPreset": "圖表預設",

  "form.planning.step": "04",
  "form.planning.title": "分段規劃",
  "form.planning.segmentation": "分段指引",
  "form.planning.segmentationPlaceholder": "例如：依主題分段、每頁聚焦單一重點",

  "form.submit": "生成簡報",
  "form.submitting": "生成中…",

  "preset.style.professional": "專業商務",
  "preset.style.warm": "溫暖親切",
  "preset.style.vibrant": "活潑繽紛",
  "preset.style.elegant": "優雅高級",
  "preset.style.tech": "科技新創",
  "preset.style.minimal": "簡約俐落",
  "preset.chart.none": "不指定",
  "preset.chart.comparison": "比較",
  "preset.chart.trend": "趨勢",
  "preset.chart.metric": "指標",

  "error.generic": "簡報生成失敗，請稍後再試。",

  "results.title": "生成結果",
  "results.download": "下載 HTML",
  "results.empty.title": "尚未生成簡報",
  "results.empty.body": "在左側填入內容與需求，按下「生成簡報」後，預覽與分析會顯示在這裡。",

  "preview.heading": "簡報預覽",
  "preview.iframeTitle": "生成的 HTML 簡報",
  "preview.hint": "可在預覽中使用方向鍵切換頁面。",

  "design.heading": "設計規劃",
  "design.theme": "主題",
  "design.density": "視覺密度",
  "design.chartStyle": "圖表風格",
  "design.pattern": "版面樣式",
  "design.issues": "一致性問題",

  "validation.heading": "HTML 驗證",
  "validation.status": "狀態",
  "validation.selfContained": "自足內容",
  "validation.speakerNotes": "講者備註已隱藏",
  "validation.keyboardNav": "支援鍵盤導覽",
  "validation.fallback": "使用備援",
  "validation.externalIssues": "外部資源問題",
  "validation.contentIssues": "內容問題",
  "validation.designIssues": "設計問題",

  "summary.heading": "產生摘要",
  "summary.slides": "簡報頁數",
  "summary.sourceFacts": "來源事實",
  "summary.chartIntents": "圖表意圖",
  "summary.uncertainClaims": "不確定陳述",

  "review.heading": "審閱報告",
  "review.assumptions": "假設",
  "review.omitted": "省略或壓縮的內容",
  "review.uncertain": "不確定的陳述",
  "review.humanNotes": "人工審閱備註",
  "review.none": "無",

  "json.heading": "簡報 JSON",

  "common.yes": "是",
  "common.no": "否"
} as const;

export type TranslationKey = keyof typeof zhTW;

type Dictionary = Record<TranslationKey, string>;

const enUS: Dictionary = {
  "app.brand": "HTML Slides Agent",
  "app.title": "Generate Previewable HTML Slides",
  "app.language": "Language",

  "form.heading": "Deck setup",
  "form.intro": "Provide your content and deck brief, tune the design direction, then generate.",
  "form.charCount": "{count} chars",

  "form.source.step": "01",
  "form.source.title": "Source",
  "form.source.label": "Source content",
  "form.source.placeholder":
    "Paste a report, transcript, meeting notes, or any text you want turned into slides…",
  "form.source.upload": "Upload file",
  "form.source.uploadHint": "Plain text .txt, .md, .csv",
  "form.source.clear": "Clear",

  "form.brief.step": "02",
  "form.brief.title": "Brief",
  "form.brief.purpose": "Purpose",
  "form.brief.purposePlaceholder": "e.g. Quarterly operations review",
  "form.brief.audience": "Audience",
  "form.brief.audiencePlaceholder": "e.g. Product and engineering leads",
  "form.brief.language": "Deck language",

  "form.design.step": "03",
  "form.design.title": "Design direction",
  "form.design.stylePreset": "Style preset",
  "form.design.styleDirection": "Style direction (custom)",
  "form.design.styleDirectionPlaceholder": "Describe the visual style or tone you want",
  "form.design.chartEmphasis": "Chart emphasis (custom)",
  "form.design.chartEmphasisPlaceholder": "Data points you want to highlight",
  "form.design.chartPreset": "Chart preset",

  "form.planning.step": "04",
  "form.planning.title": "Planning",
  "form.planning.segmentation": "Segmentation guidance",
  "form.planning.segmentationPlaceholder": "e.g. Split by topic, one key point per slide",

  "form.submit": "Generate",
  "form.submitting": "Generating…",

  "preset.style.professional": "Professional",
  "preset.style.warm": "Warm & friendly",
  "preset.style.vibrant": "Vibrant",
  "preset.style.elegant": "Elegant",
  "preset.style.tech": "Tech",
  "preset.style.minimal": "Minimal",
  "preset.chart.none": "No preference",
  "preset.chart.comparison": "Comparison",
  "preset.chart.trend": "Trend",
  "preset.chart.metric": "Metric",

  "error.generic": "Preview generation failed. Please try again.",

  "results.title": "Generated artifacts",
  "results.download": "Download HTML",
  "results.empty.title": "No slides yet",
  "results.empty.body":
    "Fill in your content and brief on the left, then press Generate to see the preview and analysis here.",

  "preview.heading": "Preview",
  "preview.iframeTitle": "Generated HTML slides",
  "preview.hint": "Use the arrow keys inside the preview to move between slides.",

  "design.heading": "Design Planning",
  "design.theme": "Theme",
  "design.density": "Visual density",
  "design.chartStyle": "Chart style",
  "design.pattern": "Pattern",
  "design.issues": "Consistency issues",

  "validation.heading": "HTML Validation",
  "validation.status": "Status",
  "validation.selfContained": "Self contained",
  "validation.speakerNotes": "Speaker notes hidden",
  "validation.keyboardNav": "Keyboard navigation",
  "validation.fallback": "Fallback used",
  "validation.externalIssues": "External resource issues",
  "validation.contentIssues": "Content issues",
  "validation.designIssues": "Design issues",

  "summary.heading": "Generation Summary",
  "summary.slides": "Slides",
  "summary.sourceFacts": "Source facts",
  "summary.chartIntents": "Chart intents",
  "summary.uncertainClaims": "Uncertain claims",

  "review.heading": "Review Report",
  "review.assumptions": "Assumptions",
  "review.omitted": "Omitted or compressed",
  "review.uncertain": "Uncertain claims",
  "review.humanNotes": "Human review notes",
  "review.none": "None",

  "json.heading": "Slide JSON",

  "common.yes": "yes",
  "common.no": "no"
};

const jaJP: Dictionary = {
  "app.brand": "HTML スライド生成",
  "app.title": "プレビュー可能な HTML スライドを生成",
  "app.language": "言語",

  "form.heading": "デッキ設定",
  "form.intro": "コンテンツとデッキの概要を入力し、デザイン方針を調整して生成します。",
  "form.charCount": "{count} 文字",

  "form.source.step": "01",
  "form.source.title": "ソース",
  "form.source.label": "ソースコンテンツ",
  "form.source.placeholder":
    "レポート、文字起こし、議事録など、スライドにしたいテキストを貼り付けてください…",
  "form.source.upload": "ファイルをアップロード",
  "form.source.uploadHint": "テキスト .txt、.md、.csv",
  "form.source.clear": "クリア",

  "form.brief.step": "02",
  "form.brief.title": "概要",
  "form.brief.purpose": "目的",
  "form.brief.purposePlaceholder": "例：四半期の業績レビュー",
  "form.brief.audience": "対象者",
  "form.brief.audiencePlaceholder": "例：プロダクト・エンジニアリング責任者",
  "form.brief.language": "デッキの言語",

  "form.design.step": "03",
  "form.design.title": "デザイン方針",
  "form.design.stylePreset": "スタイルプリセット",
  "form.design.styleDirection": "スタイルの方向性（カスタム）",
  "form.design.styleDirectionPlaceholder": "希望する視覚スタイルやトーンを記述",
  "form.design.chartEmphasis": "チャートの強調（カスタム）",
  "form.design.chartEmphasisPlaceholder": "強調したいデータポイント",
  "form.design.chartPreset": "チャートプリセット",

  "form.planning.step": "04",
  "form.planning.title": "プランニング",
  "form.planning.segmentation": "分割の指針",
  "form.planning.segmentationPlaceholder": "例：トピックごとに分割、1ページ1ポイント",

  "form.submit": "生成",
  "form.submitting": "生成中…",

  "preset.style.professional": "プロフェッショナル",
  "preset.style.warm": "温かみ",
  "preset.style.vibrant": "鮮やか",
  "preset.style.elegant": "エレガント",
  "preset.style.tech": "テック",
  "preset.style.minimal": "ミニマル",
  "preset.chart.none": "指定なし",
  "preset.chart.comparison": "比較",
  "preset.chart.trend": "トレンド",
  "preset.chart.metric": "指標",

  "error.generic": "プレビューの生成に失敗しました。もう一度お試しください。",

  "results.title": "生成結果",
  "results.download": "HTML をダウンロード",
  "results.empty.title": "スライドはまだありません",
  "results.empty.body":
    "左側にコンテンツと概要を入力し、「生成」を押すと、ここにプレビューと分析が表示されます。",

  "preview.heading": "プレビュー",
  "preview.iframeTitle": "生成された HTML スライド",
  "preview.hint": "プレビュー内で矢印キーを使ってスライドを切り替えます。",

  "design.heading": "デザインプランニング",
  "design.theme": "テーマ",
  "design.density": "視覚密度",
  "design.chartStyle": "チャートスタイル",
  "design.pattern": "パターン",
  "design.issues": "一貫性の問題",

  "validation.heading": "HTML 検証",
  "validation.status": "ステータス",
  "validation.selfContained": "自己完結",
  "validation.speakerNotes": "スピーカーノート非表示",
  "validation.keyboardNav": "キーボード操作",
  "validation.fallback": "フォールバック使用",
  "validation.externalIssues": "外部リソースの問題",
  "validation.contentIssues": "コンテンツの問題",
  "validation.designIssues": "デザインの問題",

  "summary.heading": "生成サマリー",
  "summary.slides": "スライド数",
  "summary.sourceFacts": "ソース事実",
  "summary.chartIntents": "チャート意図",
  "summary.uncertainClaims": "不確実な主張",

  "review.heading": "レビューレポート",
  "review.assumptions": "前提",
  "review.omitted": "省略・圧縮された内容",
  "review.uncertain": "不確実な主張",
  "review.humanNotes": "人手レビューメモ",
  "review.none": "なし",

  "json.heading": "スライド JSON",

  "common.yes": "はい",
  "common.no": "いいえ"
};

export const translations: Record<Locale, Dictionary> = {
  "zh-TW": zhTW,
  "en-US": enUS,
  "ja-JP": jaJP
};
