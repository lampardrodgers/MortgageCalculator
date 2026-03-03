const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const loanTypeLabels = {
  commercial: "商业房贷",
  combo: "组合贷",
  general: "普通贷款",
};

const repaymentMethodLabels = {
  "equal-installment": "等额本息",
  "equal-principal": "等额本金",
  "interest-only": "按月计息",
};

const scenarios = {
  "first-home": {
    loanType: "commercial",
    method: "equal-installment",
    termValue: 30,
    termUnit: "years",
    singleAmount: 120,
    singleRate: 3.65,
  },
  "combo-home": {
    loanType: "combo",
    method: "equal-installment",
    termValue: 30,
    termUnit: "years",
    comboCommercialAmount: 110,
    comboCommercialRate: 3.65,
    comboFundAmount: 70,
    comboFundRate: 2.85,
  },
  "general-short": {
    loanType: "general",
    method: "equal-principal",
    termValue: 36,
    termUnit: "months",
    singleAmount: 20,
    singleRate: 5.8,
  },
};

const state = {
  loanType: "commercial",
  repaymentMethod: "equal-installment",
};

const form = document.querySelector("#calculator-form");
const resetButton = document.querySelector("#reset-button");
const loanTypeSwitch = document.querySelector("#loan-type-switch");
const repaymentSwitch = document.querySelector("#repayment-switch");
const repaymentSection = repaymentSwitch.closest(".section-block");
const scenarioGrid = document.querySelector("#scenario-grid");
const loanTypeInput = document.querySelector("#loan-type-input");
const methodInput = document.querySelector("#method-input");
const formError = document.querySelector("#form-error");
const singleLoanFields = document.querySelector("#single-loan-fields");
const comboLoanFields = document.querySelector("#combo-loan-fields");
const singleAmountLabel = document.querySelector("#single-amount-label");
const singleRateLabel = document.querySelector("#single-rate-label");
const resultMeta = document.querySelector("#result-meta");
const summaryGrid = document.querySelector("#summary-grid");
const comparisonCard = document.querySelector("#comparison-card");
const yearlyBreakdown = document.querySelector("#yearly-breakdown");

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function formatPercent(value) {
  return `${percentageFormatter.format(value || 0)}%`;
}

function toggleLoanType(nextType) {
  state.loanType = nextType;
  loanTypeInput.value = nextType;

  loanTypeSwitch.querySelectorAll(".segmented__item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.loanType === nextType);
  });

  const singleMode = nextType !== "combo";
  singleLoanFields.classList.toggle("is-hidden", !singleMode);
  comboLoanFields.classList.toggle("is-hidden", singleMode);
  repaymentSection.classList.toggle("is-hidden", nextType === "general");

  if (nextType === "general") {
    singleAmountLabel.textContent = "贷款金额（万元）";
    singleRateLabel.textContent = "年利率（%）";
  } else {
    singleAmountLabel.textContent = "商业贷款金额（万元）";
    singleRateLabel.textContent = "商业贷款年利率（%）";
  }
}

function toggleRepaymentMethod(nextMethod) {
  state.repaymentMethod = nextMethod;
  methodInput.value = nextMethod;

  repaymentSwitch.querySelectorAll(".segmented__item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.method === nextMethod);
  });
}

function fillScenario(scenarioKey) {
  const scenario = scenarios[scenarioKey];
  if (!scenario) {
    return;
  }

  toggleLoanType(scenario.loanType);
  toggleRepaymentMethod(scenario.method);

  form.elements.termValue.value = scenario.termValue;
  form.elements.termUnit.value = scenario.termUnit;
  form.elements.singleAmount.value = scenario.singleAmount ?? "";
  form.elements.singleRate.value = scenario.singleRate ?? "";
  form.elements.comboCommercialAmount.value = scenario.comboCommercialAmount ?? "";
  form.elements.comboCommercialRate.value = scenario.comboCommercialRate ?? "";
  form.elements.comboFundAmount.value = scenario.comboFundAmount ?? "";
  form.elements.comboFundRate.value = scenario.comboFundRate ?? "";

  calculateAndRender();
}

function readPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getTermMonths(termValue, termUnit) {
  if (!Number.isInteger(termValue) || termValue <= 0) {
    throw new Error("贷款期限需要填写大于 0 的整数。");
  }

  const months = termUnit === "years" ? termValue * 12 : termValue;

  if (months > 600) {
    throw new Error("第一版暂时将贷款期限限制在 600 个月以内。");
  }

  return months;
}

function collectFormValues() {
  const loanType = form.elements.loanType.value;
  const repaymentMethod = loanType === "general" ? "interest-only" : form.elements.repaymentMethod.value;
  const termValue = readPositiveNumber(form.elements.termValue.value);
  const termUnit = form.elements.termUnit.value;
  const totalMonths = getTermMonths(termValue, termUnit);

  if (loanType === "combo") {
    const commercialAmount = readPositiveNumber(form.elements.comboCommercialAmount.value);
    const commercialRate = readPositiveNumber(form.elements.comboCommercialRate.value);
    const fundAmount = readPositiveNumber(form.elements.comboFundAmount.value);
    const fundRate = readPositiveNumber(form.elements.comboFundRate.value);

    if (
      !Number.isFinite(commercialAmount) ||
      !Number.isFinite(commercialRate) ||
      !Number.isFinite(fundAmount) ||
      !Number.isFinite(fundRate)
    ) {
      throw new Error("组合贷请完整填写商贷与公积金的金额和利率。");
    }

    if (commercialAmount <= 0 && fundAmount <= 0) {
      throw new Error("组合贷至少需要填写一项大于 0 的贷款金额。");
    }

    if (commercialRate < 0 || fundRate < 0) {
      throw new Error("利率不能为负数。");
    }

    const parts = [];

    if (commercialAmount > 0) {
      parts.push({
        key: "commercial",
        label: "商业贷款",
        principal: commercialAmount * 10000,
        annualRate: commercialRate,
      });
    }

    if (fundAmount > 0) {
      parts.push({
        key: "fund",
        label: "公积金贷款",
        principal: fundAmount * 10000,
        annualRate: fundRate,
      });
    }

    return {
      loanType,
      repaymentMethod,
      termValue,
      termUnit,
      totalMonths,
      parts,
    };
  }

  const singleAmount = readPositiveNumber(form.elements.singleAmount.value);
  const singleRate = readPositiveNumber(form.elements.singleRate.value);

  if (!Number.isFinite(singleAmount) || !Number.isFinite(singleRate)) {
    throw new Error("请完整填写贷款金额和年利率。");
  }

  if (singleAmount <= 0) {
    throw new Error("贷款金额需要大于 0。");
  }

  if (singleRate < 0) {
    throw new Error("利率不能为负数。");
  }

  return {
    loanType,
    repaymentMethod,
    termValue,
    termUnit,
    totalMonths,
    parts: [
      {
        key: loanType === "commercial" ? "commercial" : "general",
        label: loanType === "commercial" ? "商业贷款" : "普通贷款",
        principal: singleAmount * 10000,
        annualRate: singleRate,
      },
    ],
  };
}

function calculatePartSchedule(part, totalMonths, repaymentMethod) {
  if (repaymentMethod === "interest-only") {
    const monthlyRate = part.annualRate / 100 / 12;
    const monthlyInterest = part.principal * monthlyRate;

    return Array.from({ length: totalMonths }, (_, index) => ({
      month: index + 1,
      payment: monthlyInterest,
      principal: 0,
      interest: monthlyInterest,
      remaining: part.principal,
      breakdown: {
        [part.key]: {
          label: part.label,
          payment: monthlyInterest,
          principal: 0,
          interest: monthlyInterest,
          remaining: part.principal,
        },
      },
    }));
  }

  const monthlyRate = part.annualRate / 100 / 12;
  const powFactor = Math.pow(1 + monthlyRate, totalMonths);
  const equalInstallmentPayment =
    monthlyRate === 0
      ? part.principal / totalMonths
      : (part.principal * monthlyRate * powFactor) / (powFactor - 1);
  const equalPrincipalPart = part.principal / totalMonths;

  let remaining = part.principal;
  const schedule = [];

  for (let month = 1; month <= totalMonths; month += 1) {
    const interest = monthlyRate === 0 ? 0 : remaining * monthlyRate;
    const isLastMonth = month === totalMonths;
    const principal =
      repaymentMethod === "equal-installment"
        ? isLastMonth
          ? remaining
          : equalInstallmentPayment - interest
        : isLastMonth
          ? remaining
          : equalPrincipalPart;

    const payment =
      repaymentMethod === "equal-installment" && !isLastMonth
        ? equalInstallmentPayment
        : principal + interest;

    remaining = Math.max(0, remaining - principal);

    schedule.push({
      month,
      payment,
      principal,
      interest,
      remaining,
      breakdown: {
        [part.key]: {
          label: part.label,
          payment,
          principal,
          interest,
          remaining,
        },
      },
    });
  }

  return schedule;
}

function mergeSchedules(parts, totalMonths, repaymentMethod) {
  const schedules = parts.map((part) => ({
    part,
    schedule: calculatePartSchedule(part, totalMonths, repaymentMethod),
  }));

  const merged = [];

  for (let month = 1; month <= totalMonths; month += 1) {
    const monthItem = {
      month,
      payment: 0,
      principal: 0,
      interest: 0,
      remaining: 0,
      breakdown: {},
    };

    schedules.forEach(({ schedule, part }) => {
      const detail = schedule[month - 1];
      monthItem.payment += detail.payment;
      monthItem.principal += detail.principal;
      monthItem.interest += detail.interest;
      monthItem.remaining += detail.remaining;
      monthItem.breakdown[part.key] = detail.breakdown[part.key];
    });

    merged.push(monthItem);
  }

  return merged;
}

function groupByYear(schedule) {
  const years = [];

  for (let index = 0; index < schedule.length; index += 12) {
    const yearMonths = schedule.slice(index, index + 12);
    const paymentTotal = yearMonths.reduce((sum, item) => sum + item.payment, 0);
    const principalTotal = yearMonths.reduce((sum, item) => sum + item.principal, 0);
    const interestTotal = yearMonths.reduce((sum, item) => sum + item.interest, 0);
    const averageMonthlyPayment = paymentTotal / yearMonths.length;
    const interestShare = paymentTotal === 0 ? 0 : interestTotal / paymentTotal;

    years.push({
      yearIndex: years.length + 1,
      months: yearMonths,
      monthsCount: yearMonths.length,
      paymentTotal,
      principalTotal,
      interestTotal,
      averageMonthlyPayment,
      interestShare,
    });
  }

  return years;
}

function analyzeSchedule(schedule, parts, totalMonths, repaymentMethod) {
  const totalPayment = schedule.reduce((sum, item) => sum + item.payment, 0);
  const totalPrincipal = schedule.reduce((sum, item) => sum + item.principal, 0);
  const totalInterest = schedule.reduce((sum, item) => sum + item.interest, 0);
  const firstPayment = schedule[0]?.payment ?? 0;
  const lastPayment = schedule.at(-1)?.payment ?? 0;
  const maxPayment = Math.max(...schedule.map((item) => item.payment));
  const minPayment = Math.min(...schedule.map((item) => item.payment));
  const monthlyDecline =
    repaymentMethod === "equal-principal" && schedule.length > 1
      ? schedule[0].payment - schedule[1].payment
      : 0;

  return {
    parts,
    totalMonths,
    repaymentMethod,
    totalPayment,
    totalPrincipal,
    totalInterest,
    firstPayment,
    lastPayment,
    maxPayment,
    minPayment,
    monthlyDecline,
    yearlyBuckets: groupByYear(schedule),
    schedule,
  };
}

function calculateScenario(values, repaymentMethod) {
  const schedule = mergeSchedules(values.parts, values.totalMonths, repaymentMethod);
  return analyzeSchedule(schedule, values.parts, values.totalMonths, repaymentMethod);
}

function buildComparisonNarrative(selectedResult, alternativeResult) {
  const interestGap = selectedResult.totalInterest - alternativeResult.totalInterest;
  const firstPaymentGap = selectedResult.firstPayment - alternativeResult.firstPayment;
  const selectedLabel = repaymentMethodLabels[selectedResult.repaymentMethod];
  const alternativeLabel = repaymentMethodLabels[alternativeResult.repaymentMethod];

  const interestText =
    interestGap > 0
      ? `${alternativeLabel}比当前方案少付 ${formatCurrency(Math.abs(interestGap))} 利息`
      : interestGap < 0
        ? `${alternativeLabel}比当前方案多付 ${formatCurrency(Math.abs(interestGap))} 利息`
        : `${alternativeLabel}与当前方案总利息相同`;

  const paymentText =
    firstPaymentGap > 0
      ? `但首月月供会少 ${formatCurrency(Math.abs(firstPaymentGap))}`
      : firstPaymentGap < 0
        ? `但首月月供会多 ${formatCurrency(Math.abs(firstPaymentGap))}`
        : "首月月供保持不变";

  return `${selectedLabel}已作为当前明细方案展示；如果改成 ${alternativeLabel}，${interestText}，${paymentText}。`;
}

function renderSummary(values, result) {
  const totalPrincipal = values.parts.reduce((sum, part) => sum + part.principal, 0);
  const termLabel =
    values.termUnit === "years"
      ? `${values.termValue} 年，共 ${values.totalMonths} 期`
      : `${values.termValue} 期`;

  if (values.loanType === "general") {
    const annualRate = values.parts[0].annualRate;
    const yearlyAverageInterest =
      result.yearlyBuckets.length === 0 ? 0 : result.totalInterest / result.yearlyBuckets.length;

    const cards = [
      {
        label: "贷款金额",
        value: formatCurrency(totalPrincipal),
        hint: `普通贷款 · ${termLabel}`,
      },
      {
        label: "每月利息",
        value: formatCurrency(result.firstPayment),
        hint: "当前按固定本金逐月计息，不做等额摊还",
      },
      {
        label: "累计利息",
        value: formatCurrency(result.totalInterest),
        hint: `共计 ${values.totalMonths} 个月利息`,
      },
      {
        label: "年均利息",
        value: formatCurrency(yearlyAverageInterest),
        hint: "按年度汇总后的平均利息",
      },
      {
        label: "年利率",
        value: formatPercent(annualRate),
        hint: `月利率约 ${formatPercent(annualRate / 12)}`,
      },
      {
        label: "计息方式",
        value: repaymentMethodLabels[result.repaymentMethod],
        hint: "当前版本普通贷款不展示等额本金 / 等额本息",
      },
    ];

    summaryGrid.innerHTML = cards
      .map(
        (card) => `
          <article class="summary-card">
            <span class="summary-card__label">${card.label}</span>
            <strong class="summary-card__value">${card.value}</strong>
            <span class="summary-card__hint">${card.hint}</span>
          </article>
        `,
      )
      .join("");

    return;
  }

  const rangeLabel =
    result.repaymentMethod === "equal-installment"
      ? "月供固定"
      : `月供从 ${formatCurrency(result.maxPayment)} 递减到 ${formatCurrency(result.minPayment)}`;
  const declineHint =
    result.repaymentMethod === "equal-principal"
      ? `相邻两期约减少 ${formatCurrency(result.monthlyDecline)}`
      : "每月本金占比逐步提升";

  const cards = [
    {
      label: "贷款总额",
      value: formatCurrency(totalPrincipal),
      hint: `${loanTypeLabels[values.loanType]} · ${termLabel}`,
    },
    {
      label: "总还款额",
      value: formatCurrency(result.totalPayment),
      hint: "本金 + 利息累计支出",
    },
    {
      label: "总利息",
      value: formatCurrency(result.totalInterest),
      hint: "用于衡量整体融资成本",
    },
    {
      label: "首月月供",
      value: formatCurrency(result.firstPayment),
      hint: result.repaymentMethod === "equal-principal" ? "压力峰值出现在第一期" : "等额本息通常更平滑",
    },
    {
      label: "最后一期月供",
      value: formatCurrency(result.lastPayment),
      hint: rangeLabel,
    },
    {
      label: "还款节奏",
      value: repaymentMethodLabels[result.repaymentMethod],
      hint: declineHint,
    },
  ];

  summaryGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <span class="summary-card__label">${card.label}</span>
          <strong class="summary-card__value">${card.value}</strong>
          <span class="summary-card__hint">${card.hint}</span>
        </article>
      `,
    )
    .join("");
}

function renderComparison(selectedResult, alternativeResult) {
  comparisonCard.innerHTML = `
    <h3>另一种还款方式对比</h3>
    <p>${buildComparisonNarrative(selectedResult, alternativeResult)}</p>
    <div class="comparison-grid">
      <div class="comparison-metric">
        <span class="comparison-metric__label">${repaymentMethodLabels[alternativeResult.repaymentMethod]}总利息</span>
        <strong class="comparison-metric__value">${formatCurrency(alternativeResult.totalInterest)}</strong>
      </div>
      <div class="comparison-metric">
        <span class="comparison-metric__label">总利息差额</span>
        <strong class="comparison-metric__value">${formatCurrency(
          Math.abs(selectedResult.totalInterest - alternativeResult.totalInterest),
        )}</strong>
      </div>
      <div class="comparison-metric">
        <span class="comparison-metric__label">${repaymentMethodLabels[alternativeResult.repaymentMethod]}首月月供</span>
        <strong class="comparison-metric__value">${formatCurrency(alternativeResult.firstPayment)}</strong>
      </div>
    </div>
  `;
}

function renderYearlyBreakdown(result, loanType) {
  const isGeneralLoan = loanType === "general";
  yearlyBreakdown.innerHTML = result.yearlyBuckets
    .map((year, index) => {
      const principalRatio = isGeneralLoan ? 0 : Math.max(0, 100 - year.interestShare * 100);
      const monthRows = year.months
        .map((item) => {
          const breakdownText =
            loanType === "combo"
              ? Object.values(item.breakdown)
                  .map(
                    (part) => `
                      <div class="month-table__subnote">
                        <span class="breakdown-badge">${part.label}</span>
                        本金 ${formatCurrency(part.principal)}，利息 ${formatCurrency(part.interest)}
                      </div>
                    `,
                  )
                  .join("")
              : `<span class="muted">${Object.values(item.breakdown)[0].label}</span>`;

          return `
            <tr>
              <td>第 ${item.month} 期</td>
              <td>${formatCurrency(item.payment)}</td>
              <td>${isGeneralLoan ? "—" : formatCurrency(item.principal)}</td>
              <td>${formatCurrency(item.interest)}</td>
              <td>${formatCurrency(item.remaining)}</td>
              <td>${breakdownText}</td>
            </tr>
          `;
        })
        .join("");

      const topMeta = isGeneralLoan
        ? `月均利息 ${formatCurrency(year.averageMonthlyPayment)}`
        : `年均月供 ${formatCurrency(year.averageMonthlyPayment)}`;
      const yearMetrics = isGeneralLoan
        ? `
            <div class="year-grid__item">
              <span class="year-grid__label">计息月数</span>
              <strong class="year-grid__value">${year.monthsCount} 个月</strong>
            </div>
            <div class="year-grid__item">
              <span class="year-grid__label">月均利息</span>
              <strong class="year-grid__value">${formatCurrency(year.averageMonthlyPayment)}</strong>
            </div>
            <div class="year-grid__item">
              <span class="year-grid__label">年度利息</span>
              <strong class="year-grid__value">${formatCurrency(year.interestTotal)}</strong>
            </div>
            <div class="year-grid__item">
              <span class="year-grid__label">参考本金</span>
              <strong class="year-grid__value">${formatCurrency(year.months[0]?.remaining ?? 0)}</strong>
            </div>
          `
        : `
            <div class="year-grid__item">
              <span class="year-grid__label">年度还款</span>
              <strong class="year-grid__value">${formatCurrency(year.paymentTotal)}</strong>
            </div>
            <div class="year-grid__item">
              <span class="year-grid__label">归还本金</span>
              <strong class="year-grid__value">${formatCurrency(year.principalTotal)}</strong>
            </div>
            <div class="year-grid__item">
              <span class="year-grid__label">支付利息</span>
              <strong class="year-grid__value">${formatCurrency(year.interestTotal)}</strong>
            </div>
            <div class="year-grid__item">
              <span class="year-grid__label">本金占比</span>
              <strong class="year-grid__value">${formatPercent(principalRatio)}</strong>
            </div>
          `;

      return `
        <details class="accordion" ${index === 0 ? "open" : ""}>
          <summary class="accordion__summary">
            <div class="accordion__topline">
              <div class="accordion__title">
                <strong>第 ${year.yearIndex} 年</strong>
                <span>${year.monthsCount} 个月</span>
              </div>
              <span class="accordion__meta">${topMeta}</span>
            </div>

            <div class="year-grid">${yearMetrics}</div>

            ${isGeneralLoan
              ? ""
              : `
                <div class="ratio-bar">
                  <div class="ratio-bar__principal" style="width: ${principalRatio}%"></div>
                </div>
              `}
          </summary>

          <div class="accordion__content">
            <div class="table-scroll">
              <table class="month-table">
                <thead>
                  <tr>
                    <th>期数</th>
                    <th>${isGeneralLoan ? "月利息" : "月供"}</th>
                    <th>本金</th>
                    <th>利息</th>
                    <th>剩余本金</th>
                    <th>${loanType === "combo" ? "组合拆分" : "贷款类型"}</th>
                  </tr>
                </thead>
                <tbody>${monthRows}</tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    })
    .join("");
}

function renderMeta(values, result) {
  const partSummary = values.parts
    .map((part) => `${part.label} ${formatNumber(part.principal / 10000)} 万 · ${formatPercent(part.annualRate)}`)
    .join("<br />");
  const methodText =
    values.loanType === "general"
      ? `${repaymentMethodLabels[result.repaymentMethod]} · ${values.totalMonths} 个月`
      : `${repaymentMethodLabels[result.repaymentMethod]} · ${values.totalMonths} 期`;

  resultMeta.innerHTML = `
    <div>${partSummary}</div>
    <div>${methodText}</div>
  `;
}

function clearResults() {
  resultMeta.textContent = "";
  summaryGrid.innerHTML = "";
  comparisonCard.innerHTML = "";
  yearlyBreakdown.innerHTML = "";
}

function calculateAndRender() {
  try {
    const values = collectFormValues();
    const selectedResult = calculateScenario(values, values.repaymentMethod);

    formError.textContent = "";
    renderMeta(values, selectedResult);
    renderSummary(values, selectedResult);
    if (values.loanType === "general") {
      comparisonCard.innerHTML = `
        <h3>普通贷款说明</h3>
        <p>普通贷款当前按固定本金逐月计息展示，只计算每个月利息，不参与等额本息 / 等额本金对比。</p>
      `;
    } else {
      const alternativeMethod =
        values.repaymentMethod === "equal-installment" ? "equal-principal" : "equal-installment";
      const alternativeResult = calculateScenario(values, alternativeMethod);
      renderComparison(selectedResult, alternativeResult);
    }
    renderYearlyBreakdown(selectedResult, values.loanType);
  } catch (error) {
    formError.textContent = error.message;
    clearResults();
  }
}

loanTypeSwitch.addEventListener("click", (event) => {
  const target = event.target.closest("[data-loan-type]");
  if (!target) {
    return;
  }

  toggleLoanType(target.dataset.loanType);
  calculateAndRender();
});

repaymentSwitch.addEventListener("click", (event) => {
  const target = event.target.closest("[data-method]");
  if (!target) {
    return;
  }

  toggleRepaymentMethod(target.dataset.method);
  calculateAndRender();
});

scenarioGrid.addEventListener("click", (event) => {
  const target = event.target.closest("[data-scenario]");
  if (!target) {
    return;
  }

  fillScenario(target.dataset.scenario);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateAndRender();
});

form.addEventListener("change", (event) => {
  if (event.target.matches("input, select")) {
    calculateAndRender();
  }
});

resetButton.addEventListener("click", () => {
  fillScenario("first-home");
});

toggleLoanType(state.loanType);
toggleRepaymentMethod(state.repaymentMethod);
fillScenario("first-home");
