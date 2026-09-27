window.BENRI_CONFIG = {
  // Cloudflare Worker を公開したら URL を設定してください。
  // 例: "https://benri-counter.example.workers.dev"
  counterApiUrl: "",

  // 全国施設DB API。Cloudflare Worker 初回デプロイ時に自動設定されます。
  // 未設定時は従来のGitHub JSONを利用します。
  facilityApiUrl: "",

  // Googleフォーム作成後、公開URLを設定します。
  feedbackFormUrl: ""
};
