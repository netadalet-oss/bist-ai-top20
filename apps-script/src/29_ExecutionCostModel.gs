/*
 * Execution-cost, spread, slippage and liquidity model.
 *
 * Monetary results remain explicit: grossReturnPct is never overwritten.
 * netReturnPct is derived from the immutable entry/exit prices and a declared
 * execution-cost policy. All percentages use percentage-point units (0.25 = 0.25%).
 */
var EXECUTION_COST_MODEL = (function () {
  'use strict';

  const VERSION = 'EXEC-COST-1.0.0';
  const DEFAULTS = Object.freeze({
    commissionBpsPerSide: 5,
    fixedSpreadBps: 10,
    baseSlippageBpsPerSide: 4,
    participationRate: 0.02,
    maxParticipationRate: 0.10,
    impactCoefficientBps: 35,
    minimumDailyTurnoverTry: 5000000,
    rejectIlliquid: true
  });

  function finite_(v) {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function clamp_(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function normalizePolicy_(policy) {
    const p = Object.assign({}, DEFAULTS, policy || {});
    ['commissionBpsPerSide','fixedSpreadBps','baseSlippageBpsPerSide','participationRate',
      'maxParticipationRate','impactCoefficientBps','minimumDailyTurnoverTry']
      .forEach(function (key) {
        const n = finite_(p[key]);
        if (n == null || n < 0) throw new Error('Geçersiz maliyet parametresi: ' + key);
        p[key] = n;
      });
    if (p.maxParticipationRate <= 0 || p.maxParticipationRate > 1) {
      throw new Error('maxParticipationRate 0-1 aralığında olmalıdır.');
    }
    if (p.participationRate > p.maxParticipationRate) {
      throw new Error('participationRate, maxParticipationRate değerini aşamaz.');
    }
    p.rejectIlliquid = p.rejectIlliquid !== false;
    return p;
  }

  function liquidity_(input, policy) {
    input = input || {};
    const turnover = finite_(input.dailyTurnoverTry || input.turnoverTry || input.turnover);
    const orderValue = finite_(input.orderValueTry || input.orderValue);
    const explicitParticipation = finite_(input.participationRate);
    let participation = explicitParticipation;
    if (participation == null && orderValue != null && turnover != null && turnover > 0) {
      participation = orderValue / turnover;
    }
    if (participation == null) participation = policy.participationRate;
    participation = Math.max(0, participation);
    const liquidEnough = turnover == null || turnover >= policy.minimumDailyTurnoverTry;
    const participationOk = participation <= policy.maxParticipationRate;
    return {
      dailyTurnoverTry: turnover,
      orderValueTry: orderValue,
      participationRate: participation,
      liquidEnough: liquidEnough,
      participationOk: participationOk,
      eligible: (!policy.rejectIlliquid || liquidEnough) && participationOk
    };
  }

  function estimate(input, policy) {
    input = input || {};
    const p = normalizePolicy_(policy);
    const liq = liquidity_(input, p);
    const spreadBps = finite_(input.spreadBps);
    const effectiveSpreadBps = spreadBps == null ? p.fixedSpreadBps : Math.max(0, spreadBps);
    const relativeParticipation = p.maxParticipationRate > 0
      ? clamp_(liq.participationRate / p.maxParticipationRate, 0, 1)
      : 1;
    const impactBpsPerSide = p.impactCoefficientBps * Math.sqrt(relativeParticipation);
    const slippageBpsPerSide = p.baseSlippageBpsPerSide + impactBpsPerSide;
    const commissionRoundTripBps = 2 * p.commissionBpsPerSide;
    const slippageRoundTripBps = 2 * slippageBpsPerSide;
    const totalRoundTripBps = commissionRoundTripBps + effectiveSpreadBps + slippageRoundTripBps;
    return {
      version: VERSION,
      policy: p,
      liquidity: liq,
      commissionRoundTripBps: commissionRoundTripBps,
      spreadBps: effectiveSpreadBps,
      slippageBpsPerSide: slippageBpsPerSide,
      slippageRoundTripBps: slippageRoundTripBps,
      totalRoundTripBps: totalRoundTripBps,
      totalRoundTripPct: totalRoundTripBps / 100,
      eligible: liq.eligible
    };
  }

  function apply(input, policy) {
    input = input || {};
    const entry = finite_(input.entryPrice);
    const exit = finite_(input.exitPrice || input.targetPrice);
    const gross = finite_(input.grossReturnPct != null
      ? input.grossReturnPct
      : (entry != null && entry > 0 && exit != null ? (exit / entry - 1) * 100 : null));
    const estimateResult = estimate(input, policy);
    const net = gross == null ? null : gross - estimateResult.totalRoundTripPct;
    return Object.assign({}, estimateResult, {
      entryPrice: entry,
      exitPrice: exit,
      grossReturnPct: gross,
      netReturnPct: net,
      economicallyPositive: net != null ? net > 0 : null
    });
  }

  return Object.freeze({
    VERSION: VERSION,
    DEFAULTS: DEFAULTS,
    estimate: estimate,
    apply: apply,
    normalizePolicy: normalizePolicy_
  });
})();

function estimateExecutionCost_(input, policy) {
  return EXECUTION_COST_MODEL.estimate(input, policy);
}

function applyExecutionCost_(input, policy) {
  return EXECUTION_COST_MODEL.apply(input, policy);
}
