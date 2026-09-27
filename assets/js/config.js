window.BENRI_CONFIG = {
  // Cloudflare Worker を公開したら URL を設定してください。
  // 例: "https://benri-counter.example.workers.dev"
  counterApiUrl: "",

  // 全国施設DB API。Cloudflare Worker 初回デプロイ時に自動設定されます。
  // 未設定時は従来のGitHub JSONを利用します。
  facilityApiUrl: "",

  // Googleフォーム作成後、公開URLを設定します。
  feedbackFormUrl: "",

  // PR掲載相談の受付先。現在はGitHub Issueを暫定窓口として使用します。
  // Googleフォーム等へ切り替える場合は、このURLだけ変更してください。
  advertisingContactUrl: "https://github.com/oioilll550-rgb/my-tools-site/issues/new?template=pr-listing.yml"
};
