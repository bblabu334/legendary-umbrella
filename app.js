/* =========================================================
 * 🔢 数字猜猜乐 —— 前端逻辑
 *
 * 后端约定（由 Java 执裁）：
 *   GET  /api/state          -> { playerScore, currentRound, totalRounds,
 *                                  targetNumber, attemptsUsed, maxAttempts,
 *                                  roundActive, comparison, hint,
 *                                  winRate, bestRecord, history:[...] }
 *   GET  /api/guess?n=数字    -> 提交猜测，返回更新后的完整 State
 *   GET  /api/reset           -> 重置整个游戏
 *   GET  /api/newround        -> 手动开始新一局
 *
 * ★ 重要：comparison（correct/too_big/too_small）和 hint（提示语）
 *   都是 Java 端 CaseCode.compareGuess() / getHint() 算好送过来的，
 *   前端只负责显示，不再自己判断大小 —— 做到"Java 执裁"。
 *   后端不可用时，前端自动回退到本地逻辑，保证可独立运行。
 * ========================================================= */

var API_BASE = "";                       // 同源部署留空
var guessing = false;                    // 是否正在等待结果

var el = {
  totalScore: document.getElementById("totalScore"),
  roundNum: document.getElementById("roundNum"),
  winRate: document.getElementById("winRate"),
  bestRecord: document.getElementById("bestRecord"),
  remaining: document.getElementById("remaining"),
  used: document.getElementById("used"),
  guessInput: document.getElementById("guessInput"),
  guessBtn: document.getElementById("guessBtn"),
  hintBox: document.getElementById("hintBox"),
  hintIcon: document.getElementById("hintIcon"),
  hintText: document.getElementById("hintText"),
  banner: document.getElementById("banner"),
  newRoundBtn: document.getElementById("newRoundBtn"),
  resetBtn: document.getElementById("resetBtn"),
  historyList: document.getElementById("historyList"),
  totalRoundsTag: document.getElementById("totalRoundsTag")
};

function init() {
  el.guessBtn.addEventListener("click", doGuess);
  el.guessInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter")doGuess();
  });
  el.newRoundBtn.addEventListener("click", doNewRound);
  el.resetBtn.addEventListener("click", doReset);
  loadState();
}

/* ---------- 拉取后端状态 ---------- */
function loadState() {
  fetch(API_BASE + "/api/state")
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(function () { render(localState()); });
}

/* ---------- 提交猜测 ---------- */
function doGuess() {
  if (guessing) return;
  var val = parseInt(el.guessInput.value, 10);
  if (isNaN(val) || val < 1 || val > 100) {
    showHint("level", "⚠️", "请输入 1 ~ 100 之间的数字！");
    return;
  }
  guessing = true;
  el.guessBtn.disabled = true;
  el.banner.classList.add("hidden");

  fetch(API_BASE + "/api/guess?n=" + val)
    .then(function (r) { return r.json(); })
    .then(function (data) { finishGuess(data, val); })
    .catch(function () { finishGuess(localGuess(val), val); });
}

function finishGuess(data, guessVal) {
  // ★ 大小判断由 Java 的 CaseCode.compareGuess() 完成，结果放在 data.comparison 里
  //   提示语同样来自 Java 的 getHint()（switch 分级），放在 data.hint 里。
  //   前端直接用，不再自己算 diff —— 这样才是"Java 执裁"。
  //   只有后端不可用（走本地兜底）时，才在前端自己比一次。
  var t = data.targetNumber || localTarget;
  var comparison = data.comparison ||
    (guessVal === t ? "correct" : guessVal > t ? "too_big" : "too_small");
  var hint = data.hint || getLocalHint(guessVal, t);

  // 显示提示
  if (comparison === "correct") {
    showHint("level", "🎯", "恭喜你！猜对了！");
  } else if (comparison === "too_big") {
    showHint("big", "📈", "太大了！往小了猜~  " + hint);
  } else {
    showHint("small", "📉", "太小了！往大了猜~  " + hint);
  }

  // 检查本局是否结束
  var roundOver = !data.roundActive;
  var lastResult = "";
  if (data.history && data.history.length > 0) {
    lastResult = data.history[data.history.length - 1].result;
  }
  if (roundOver && lastResult) {
    // 把答案一起传进去：本局结束后后端才会公布 targetNumber
    showBanner(lastResult, data.attemptsUsed, data.maxAttempts, data.targetNumber);
  }

  render(data);

  // 重置输入和状态
  el.guessInput.value = "";
  el.guessInput.focus();
  guessing = false;
  el.guessBtn.disabled = false;
}

/* ---------- 本地提示模拟（switch 级别） ---------- */
function getLocalHint(guess, target) {
  var d = Math.abs(guess - target);
  var level = Math.floor(d / 10);
  if (level > 9) level = 9;
  switch (level) {
    case 0: return "🔥 就在旁边！";
    case 1: return "✨ 很近了！";
    case 2: return "👍 有点接近！";
    case 3: return "🤔 继续努力！";
    case 4: return "📍 还有点远...";
    default: return "❄️ 差得很远哦";
  }
}
var localTarget = 50;

/* ---------- 显示提示框 ---------- */
function showHint(type, icon, text) {
  el.hintBox.className = "hint-box hint-" + type;
  el.hintIcon.textContent = icon;
  el.hintText.textContent = text;
}

/* ---------- 结果横幅 ---------- */
function showBanner(result, used, max, answer) {
  if (!result) return;
  var m;
  if (result === "win") {
    m = { cls: "win", text: "🎉 恭喜猜对！用了 " + used + " 次" };
  } else {
    m = { cls: "lose", text: "😢 机会用完了！答案是 " + (answer || localTarget || "?") };
  }
  el.banner.className = "banner " + m.cls;
  el.banner.textContent = m.text;
}

/* ---------- 渲染状态 ---------- */
function render(data) {
  el.totalScore.textContent = data.playerScore || 0;
  el.roundNum.textContent = data.currentRound || 1;
  el.winRate.textContent = (data.winRate || 0) + "%";
  el.bestRecord.textContent = data.bestRecord || "-";
  el.remaining.textContent = Math.max(0, (data.maxAttempts || 7) - (data.attemptsUsed || 0));
  el.used.textContent = data.attemptsUsed || 0;

  if (data.targetNumber) localTarget = data.targetNumber;
  el.totalRoundsTag.textContent = "共 " + (data.totalRounds || 0) + " 局";

  // 历史列表
  var list = data.history || [];
  el.historyList.innerHTML = "";
  if (list.length === 0) {
    el.historyList.innerHTML = '<li class="empty-hint">暂无记录，开始猜测吧！</li>';
    return;
  }
  // 倒序展示最近 10 条
  var recent = list.slice(-10).reverse();
  recent.forEach(function (h) {
    var li = document.createElement("li");
    var isWin = h.result === "win";
    var resCls = isWin ? "r-res-win" : "r-res-lose";
    var resTxt = isWin ? "胜" : "负";
    li.innerHTML =
      '<span class="r-no">#' + h.round + '</span>' +
      '<span class="r-target">答案: ' + h.target + '</span>' +
      '<span class="r-attempts">' + h.attempts + '次</span>' +
      '<span class="r-score ' + (isWin ? 'r-win' : 'r-lose') + '">' + (h.score || 0) + '分</span>' +
      '<span class="r-result ' + resCls + '">' + resTxt + '</span>';
    el.historyList.appendChild(li);
  });
}

/* ---------- 新一局 ---------- */
function doNewRound() {
  if (guessing) return;
  fetch(API_BASE + "/api/newround")
    .then(function (r) { return r.json(); })
    .then(function (data) { afterNewRound(data); })
    .catch(function () { afterNewRound(localNewRound()); });
}
function afterNewRound(data) {
  render(data);
  el.guessInput.value = "";
  el.hintBox.classList.add("hidden");
  el.banner.classList.add("hidden");
  el.guessInput.focus();
  localTarget = Math.floor(Math.random() * 100) + 1;
}

/* ---------- 重置 ---------- */
function doReset() {
  if (guessing) return;
  fetch(API_BASE + "/api/reset")
    .then(function (r) { return r.json(); })
    .then(function (d) { afterReset(d); })
    .catch(function () { afterReset(localReset()); });
}
function afterReset(data) {
  render(data);
  el.guessInput.value = "";
  el.hintBox.classList.add("hidden");
  el.banner.classList.add("hidden");
  el.guessInput.focus();
  localTarget = Math.floor(Math.random() * 100) + 1;
}

/* =========================================================
 * 本地兜底逻辑（仅在后端不可用时启用）
 * ========================================================= */
var mem = {
  playerScore: 0, currentRound: 1, totalRounds: 0,
  targetNumber: 50, attemptsUsed: 0, maxAttempts: 7, roundActive: true,
  history: []
};

function localState() {
  return {
    playerScore: mem.playerScore, currentRound: mem.currentRound,
    totalRounds: mem.totalRounds, targetNumber: mem.targetNumber,
    attemptsUsed: mem.attemptsUsed, maxAttempts: mem.maxAttempts,
    roundActive: mem.roundActive, winRate: localWinRate(),
    bestRecord: localBest(), history: mem.history
  };
}

function localGuess(n) {
  if (!mem.roundActive) { mem.targetNumber = Math.floor(Math.random() * 100) + 1; mem.attemptsUsed = 0; mem.roundActive = true; }
  mem.attemptsUsed++;
  var result = "";
  if (n === mem.targetNumber) {
    result = "win"; mem.roundActive = false;
    var sc = mem.attemptsUsed <= 2 ? 100 : mem.attemptsUsed <= 4 ? 70 : mem.attemptsUsed <= 6 ? 40 : 10;
    mem.playerScore += sc;
    mem.history.push({ round: mem.totalRounds + 1, score: sc, attempts: mem.attemptsUsed, target: mem.targetNumber, result: "win" });
    mem.totalRounds++; mem.currentRound++;
  } else if (mem.attemptsUsed >= mem.maxAttempts) {
    result = "lose"; mem.roundActive = false;
    mem.history.push({ round: mem.totalRounds + 1, score: 0, attempts: mem.attemptsUsed, target: mem.targetNumber, result: "lose" });
    mem.totalRounds++; mem.currentRound++;
  }
  return localState();
}

function localNewRound() {
  mem.targetNumber = Math.floor(Math.random() * 100) + 1;
  mem.attemptsUsed = 0; mem.roundActive = true;
  return localState();
}

function localReset() {
  mem = { playerScore: 0, currentRound: 1, totalRounds: 0, targetNumber: 50, attemptsUsed: 0, maxAttempts: 7, roundActive: true, history: [] };
  return localState();
}

function localWinRate() {
  if (mem.history.length === 0) return 0;
  var w = 0;
  for (var i = 0; i < mem.history.length; i++) { if (mem.history[i].result === "win") w++; }
  return Math.floor((w / mem.history.length) * 100);
}

function localBest() {
  var best = 999, br = 0;
  for (var i = 0; i < mem.history.length; i++) {
    if (mem.history[i].result !== "win") continue;
    if (mem.history[i].attempts < best) { best = mem.history[i].attempts; br = i + 1; }
    if (best === 1) break;
  }
  return br > 0 ? "第" + br + "局最佳," + best + "次" : "-";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else { init(); }
