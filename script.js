let retireData = null;

// JSON読み込み
fetch("./retire_data.json")
  .then((res) => {
    if (!res.ok) {
      throw new Error("退職金データの読み込みに失敗しました。");
    }
    return res.json();
  })
  .then((json) => {
    retireData = json.data || [];
  })
  .catch((err) => {
    console.error(err);
    const errorEl = document.getElementById("errorMessage");
    if (errorEl) {
      errorEl.textContent = "内部データの読み込みに失敗しました。時間をおいて再度お試しください。";
    }
  });

// 勤続年数 → 階級
function mapTenureToYearsClass(tenure) {
  const n = Number(tenure);
  if (Number.isNaN(n) || n <= 0) return null;

  if (n < 10) return "10-14";
  if (n <= 14) return "10-14";
  if (n <= 19) return "15-19";
  if (n <= 24) return "20-24";
  if (n <= 29) return "25-29";
  if (n <= 34) return "30-34";
  return "35plus";
}

// 学歴
function mapGakuInput(value) {
  if (value === "kousotsu") return "kousotsu";
  // auto / daigaku → 大卒扱い
  return "daigaku";
}

// 退職理由ラベル
function reasonLabel(key) {
  switch (key) {
    case "teinen":
      return "定年退職";
    case "jikotsugou":
      return "自己都合退職";
    case "kaisya":
      return "会社都合・早期退職";
    default:
      return "";
  }
}

// 規模ラベル
function scaleLabel(key) {
  return key === "large" ? "大企業（1,000人以上）" : "中小企業（30〜999人）";
}

// 学歴ラベル
function gakuLabel(key) {
  return key === "kousotsu" ? "高校卒" : "大学・大学院卒";
}

// years ラベル
function yearsLabel(yearsKey) {
  if (yearsKey === "35plus") return "35年以上";
  const parts = yearsKey.split("-");
  if (parts.length === 2) return `${parts[0]}〜${parts[1]}年`;
  return yearsKey;
}

// 指定条件で avg を取得
function findAvg(gaku, yearsClass, reason, scale) {
  if (!retireData) return null;
  const record = retireData.find(
    (r) =>
      r.gaku === gaku &&
      r.years === yearsClass &&
      r.reason === reason &&
      r.scale === scale
  );
  return record ? Number(record.avg) : null;
}

// 範囲計算
function calculateRange(avg, reasonKey) {
  if (!avg || avg <= 0) return null;

  let lower = avg * 0.85;
  let upper = avg * 1.15;

  // 会社都合はぶれが大きい想定でレンジ拡大
  if (reasonKey === "kaisya") {
    lower = avg * 0.8;
    upper = avg * 1.2;
  }

  return {
    lower: Math.round(lower),
    upper: Math.round(upper),
  };
}

// 月給何か月分か
function calculateMonths(avg, salary) {
  const s = Number(salary);
  if (!avg || !s || s <= 0) return null;
  const months = avg / s;
  return Math.round(months * 10) / 10; // 小数1桁
}

// 数字フォーマット（万円）
function formatManYen(value) {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
}

// イベント登録
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("calcButton");
  const errorEl = document.getElementById("errorMessage");
  const resultCard = document.getElementById("resultCard");
  const resultContent = document.getElementById("resultContent");

  if (!btn) return;

  btn.addEventListener("click", () => {
    if (errorEl) errorEl.textContent = "";

    const tenureInput = document.getElementById("tenure");
    const salaryInput = document.getElementById("salary");
    const gakuInput = document.getElementById("gaku");

    const tenure = tenureInput ? tenureInput.value.trim() : "";
    if (!tenure) {
      errorEl.textContent = "勤続年数を入力してください。";
      resultCard.classList.add("hidden");
      return;
    }

    const yearsClass = mapTenureToYearsClass(tenure);
    if (!yearsClass) {
      errorEl.textContent = "勤続年数の入力が正しくありません。";
      resultCard.classList.add("hidden");
      return;
    }

    // 理由
    const reasonRadio = document.querySelector('input[name="reason"]:checked');
    const reasonKey = reasonRadio ? reasonRadio.value : "teinen";

    // 規模
    const scaleRadio = document.querySelector('input[name="scale"]:checked');
    const scaleKey = scaleRadio ? scaleRadio.value : "small";

    // 学歴
    const gakuKey = mapGakuInput(gakuInput ? gakuInput.value : "auto");

    // 平均値取得
    const avg = findAvg(gakuKey, yearsClass, reasonKey, scaleKey);
    if (!avg) {
      errorEl.textContent =
        "この条件に対応する統計データが見つかりませんでした。データを追加する必要があります。";
      resultCard.classList.add("hidden");
      return;
    }

    const range = calculateRange(avg, reasonKey);
    if (!range) {
      errorEl.textContent = "相場レンジの計算に失敗しました。";
      resultCard.classList.add("hidden");
      return;
    }

    const salaryVal = salaryInput ? salaryInput.value.trim() : "";
    const months = salaryVal ? calculateMonths(avg, salaryVal) : null;

    // 帯グラフ位置
    const centerPos =
      ((avg - range.lower) / (range.upper - range.lower)) * 100;

    // 結果HTML組み立て
    const html = `
      <div class="result-main">
        <p class="result-range">
          推定相場：
          <strong>${formatManYen(range.lower)}万〜${formatManYen(
      range.upper
    )}万円</strong>
          <span class="unit">（中央値：${formatManYen(avg)}万円）</span>
        </p>
        <p class="result-center">
          モデル：
          ${scaleLabel(scaleKey)} ／
          ${gakuLabel(gakuKey)} ／
          ${yearsLabel(yearsClass)} ／
          ${reasonLabel(reasonKey)}
        </p>
      </div>

      <div class="range-wrapper">
        <div class="range-labels">
          <span>${formatManYen(range.lower)}万</span>
          <span>${formatManYen(range.upper)}万</span>
        </div>
        <div class="range-bar">
          <div class="range-bar-inner"></div>
          <div class="range-marker" style="left: ${centerPos}%;"></div>
        </div>
        <div class="range-marker-label">
          ● 現在の条件に近い相場の中央値（${formatManYen(avg)}万円）付近を示しています。
        </div>
      </div>

      ${
        months
          ? `<p class="result-meta">
               退職直前の月給を ${Number(
                 salaryVal
               )}万円とした場合、おおよそ <strong>${months}ヶ月分</strong> 相当です。
             </p>`
          : ""
      }

      <div class="result-meta">
        <p>
          実際の退職金は、会社ごとの退職金規程や企業年金制度、役職・評価・業種などにより、
          ここでの相場から大きく前後することがあります。
        </p>
        <p>
          具体的な金額の確認には、勤務先の人事部門や退職金規程を必ずご確認ください。
        </p>
      </div>

      <div class="form-actions" style="margin-top: 12px;">
        <button type="button" onclick="goToTaxTool(${avg}, ${tenure})">
          この金額で手取り額を試算する
        </button>
      </div>
    `;

    resultContent.innerHTML = html;
    resultCard.classList.remove("hidden");
  });
});

// 手取り計算ツールへの連携フック
function goToTaxTool(amountMan, tenureYears) {
  // 将来、自前 / 外部ツールに差し替える想定
  // 例）/retire-tax/?amount=金額（万円）&tenure=年数
  const baseUrl = "./retire-tax/index.html"; // 仮URL（あとで調整）
  const url = `${baseUrl}?amount=${encodeURIComponent(
    amountMan
  )}&tenure=${encodeURIComponent(tenureYears)}`;
  window.location.href = url;
}
