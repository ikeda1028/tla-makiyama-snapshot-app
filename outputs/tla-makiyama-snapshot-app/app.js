const initialState = {
  members: [
    { id: "m1", name: "牧山", wallet: "0xMakiyama", role: "プロジェクトオーナー", joinStatus: "初期", joinedAt: "2026-06-24" },
    { id: "m2", name: "TLA企画", wallet: "0xTLAPlan", role: "企画・設計", joinStatus: "初期", joinedAt: "2026-06-24" },
    { id: "m3", name: "現場伴走", wallet: "0xField", role: "現場調整", joinStatus: "初期", joinedAt: "2026-06-24" },
    { id: "m4", name: "広報編集", wallet: "0xMedia", role: "発信・編集", joinStatus: "初期", joinedAt: "2026-06-24" }
  ],
  contributions: [
    { id: "c1", memberId: "m1", category: "戦略", title: "6月プロジェクト方針の整理", points: 28, date: "2026-06-24" },
    { id: "c2", memberId: "m2", category: "調査", title: "関係者ヒアリング設計", points: 18, date: "2026-06-25" },
    { id: "c3", memberId: "m3", category: "調整", title: "現場会議の論点回収", points: 22, date: "2026-06-26" },
    { id: "c4", memberId: "m4", category: "発信", title: "活動報告の構成案", points: 14, date: "2026-06-27" },
    { id: "c5", memberId: "m1", category: "実装", title: "意思決定フローのたたき台", points: 20, date: "2026-06-28" }
  ],
  proposals: [
    {
      id: "p1",
      title: "7月の優先テーマを地域連携に置く",
      body: "リソース配分を調査よりも現場連携と関係者調整へ寄せる。",
      threshold: 60,
      status: "open",
      createdAt: "2026-06-28",
      votes: { m1: "yes", m2: "yes", m3: "abstain" }
    },
    {
      id: "p2",
      title: "月次レポートをSnapshot公開用に整える",
      body: "貢献ログと決定理由を毎月1回、外部説明可能な形で出力する。",
      threshold: 55,
      status: "open",
      createdAt: "2026-06-29",
      votes: { m4: "yes" }
    }
  ],
  settings: {
    spaceId: "tla-makiyama.eth",
    networkId: "137",
    useContributionWeight: true,
    asanaApiBase: "",
    asanaWorkspaceGid: "",
    asanaProjectGid: "",
    cloudWorkspaceKey: "tla-makiyama-main"
  },
  project: {
    name: "TLA・牧山チーム PPM導入",
    summary: "Snapshotを使い、TLA・牧山チームのプロジェクト貢献度、意思決定、価値づけを透明に管理する。",
    model: "gpt-5.5",
    analysis: null
  }
};

const storageKey = "tla-makiyama-snapshot-governance";
let state = loadState();
let activeFilter = "all";

const memberDirectory = [
  { name: "牧山", identity: "makiyama.eth", role: "プロジェクトオーナー" },
  { name: "TLA企画", identity: "tla-planning.eth", role: "企画・設計" },
  { name: "現場伴走", identity: "field-support.eth", role: "現場調整" },
  { name: "広報編集", identity: "media-editor.eth", role: "発信・編集" },
  { name: "会計管理", identity: "accounting.tla.eth", role: "会計・精算" },
  { name: "外部連携", identity: "partner-relations.eth", role: "渉外" }
];

const views = {
  overview: "概況",
  contribution: "貢献度",
  decision: "意思決定",
  snapshot: "Snapshot"
};

const ppmFramework = {
  planningSteps: ["IMAGE PLANNING", "PILOT PLANNING", "MASTER PLANNING", "IMPLEMENTATION PLANNING"],
  parameters: [
    "MARKETING",
    "TECHNOLOGY",
    "STAKEHOLDERS ANALYSIS",
    "INVESTMENT & FINANCE",
    "REGULATION",
    "HUMAN RESOURCE",
    "PROCESS MANAGEMENT",
    "DECISION MAKING SYSTEM"
  ]
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(initialState);
  try {
    return mergeState(structuredClone(initialState), JSON.parse(saved));
  } catch {
    return structuredClone(initialState);
  }
}

function mergeState(base, saved) {
  const baseMembersById = Object.fromEntries((base.members ?? []).map((member) => [member.id, member]));
  const members = (saved.members ?? base.members ?? []).map((member) => ({
    ...(baseMembersById[member.id] ?? {}),
    ...member,
    role: member.role ?? baseMembersById[member.id]?.role ?? "",
    joinStatus: member.joinStatus ?? baseMembersById[member.id]?.joinStatus ?? "初期",
    joinedAt: member.joinedAt ?? baseMembersById[member.id]?.joinedAt ?? ""
  }));
  return {
    ...base,
    ...saved,
    members,
    settings: { ...base.settings, ...(saved.settings ?? {}) },
    project: { ...base.project, ...(saved.project ?? {}) }
  };
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  const saveState = document.querySelector("#saveState");
  saveState.textContent = "保存中";
  window.setTimeout(() => {
    saveState.textContent = "保存済み";
  }, 280);
}

function setCloudState(message, mode = "") {
  const element = document.querySelector("#cloudState");
  element.textContent = message;
  element.className = `api-state ${mode}`;
}

function memberName(id) {
  return state.members.find((member) => member.id === id)?.name ?? "未設定";
}

function contributionTotals() {
  const totals = Object.fromEntries(state.members.map((member) => [member.id, 0]));
  for (const item of state.contributions) {
    totals[item.memberId] = (totals[item.memberId] ?? 0) + Number(item.points);
  }
  return totals;
}

function votingPower() {
  const totals = contributionTotals();
  const totalPoints = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    state.members.map((member) => {
      const points = totals[member.id] ?? 0;
      const power = totalPoints === 0 ? 0 : Math.round((points / totalPoints) * 1000) / 10;
      return [member.id, power];
    })
  );
}

function proposalScore(proposal) {
  const powers = votingPower();
  const score = { yes: 0, no: 0, abstain: 0, total: 0 };
  for (const member of state.members) {
    const choice = proposal.votes[member.id];
    if (!choice) continue;
    const weight = state.settings.useContributionWeight ? powers[member.id] : 100 / state.members.length;
    score[choice] += weight;
    score.total += weight;
  }
  const yesRatio = score.yes + score.no === 0 ? 0 : (score.yes / (score.yes + score.no)) * 100;
  return {
    yes: Math.round(score.yes * 10) / 10,
    no: Math.round(score.no * 10) / 10,
    abstain: Math.round(score.abstain * 10) / 10,
    total: Math.round(score.total * 10) / 10,
    yesRatio: Math.round(yesRatio),
    passed: score.total >= 50 && yesRatio >= proposal.threshold
  };
}

function renderSelects() {
  const memberOptions = state.members
    .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`)
    .join("");
  document.querySelector("#contributionMember").innerHTML = memberOptions;
  document.querySelector("#voteMember").innerHTML = memberOptions;

  const proposalOptions = state.proposals
    .filter((proposal) => proposal.status === "open")
    .map((proposal) => `<option value="${proposal.id}">${escapeHtml(proposal.title)}</option>`)
    .join("");
  document.querySelector("#voteProposal").innerHTML = proposalOptions || `<option value="">進行中の提案なし</option>`;
}

function renderMetrics() {
  const totalPoints = state.contributions.reduce((sum, item) => sum + Number(item.points), 0);
  const openProposals = state.proposals.filter((proposal) => proposal.status === "open");
  const decided = state.proposals.filter((proposal) => proposal.status === "closed");
  const passed = state.proposals.filter((proposal) => proposalScore(proposal).passed);

  document.querySelector("#totalPoints").textContent = totalPoints;
  document.querySelector("#memberCount").textContent = state.members.length;
  document.querySelector("#openProposalCount").textContent = openProposals.length;
  document.querySelector("#consensusRate").textContent = decided.length === 0 ? `${Math.round((passed.length / state.proposals.length) * 100)}%` : `${Math.round((passed.length / decided.length) * 100)}%`;
}

function renderProjectPlanner() {
  const project = state.project ?? initialState.project;
  document.querySelector("#projectName").value = project.name ?? "";
  document.querySelector("#projectSummary").value = project.summary ?? "";
  document.querySelector("#openAiModel").value = project.model ?? "gpt-5.5";
  renderPpmResult(project.analysis);
}

function renderPpmResult(analysis) {
  const container = document.querySelector("#ppmResult");
  if (!analysis) {
    container.innerHTML = `<div class="ppm-empty">プロジェクト名と概要を入力して、AI設計またはPPM雛形を実行してください。</div>`;
    return;
  }
  const tasks = Array.isArray(analysis.tasks) ? analysis.tasks : [];
  ensureTaskIds(tasks);
  const risks = Array.isArray(analysis.risks) ? analysis.risks : [];
  const decisions = Array.isArray(analysis.decision_points) ? analysis.decision_points : [];
  container.innerHTML = `
    <div class="ppm-summary">
      <article class="ppm-card">
        <h4>${escapeHtml(analysis.project_name ?? state.project.name)}</h4>
        <p class="subtle">${escapeHtml(analysis.overview ?? "概要は未生成です。")}</p>
        <div class="ppm-task-meta">
          ${(analysis.ppm_stages ?? ppmFramework.planningSteps).map((stage) => `<span class="pill">${escapeHtml(stage)}</span>`).join("")}
        </div>
      </article>
      <article class="ppm-value">
        <span>総合価値</span>
        <strong>${Number(analysis.value_score ?? 0)}</strong>
        <small>/ 100</small>
      </article>
    </div>
    <div class="ppm-task-grid">
      ${tasks.map((task, index) => `
        <article class="ppm-task">
          <div class="rank-top">
            <span class="title-line">${index + 1}. ${escapeHtml(task.title ?? "未設定タスク")}</span>
            <span class="pill ${task.priority === "高" ? "coral" : task.priority === "中" ? "amber" : ""}">${escapeHtml(task.priority ?? "中")}</span>
          </div>
          <p class="subtle">${escapeHtml(task.description ?? "")}</p>
          <div class="ppm-task-meta">
            <span class="pill">${escapeHtml(task.ppm_stage ?? "PPM")}</span>
            <span class="pill amber">${escapeHtml(task.parameter ?? "PARAM")}</span>
            <span class="pill">${Number(task.workload_points ?? 10)} pt</span>
          </div>
          <div class="subtle">担当: ${escapeHtml(taskAssigneeName(task))} · 成果物: ${escapeHtml(task.deliverable ?? "未設定")}</div>
        </article>
      `).join("")}
    </div>
    <div class="split-layout">
      <article class="ppm-card">
        <h4>リスクと依存関係</h4>
        ${risks.map((risk) => `<p class="subtle">・${escapeHtml(risk)}</p>`).join("") || `<p class="subtle">未設定</p>`}
      </article>
      <article class="ppm-card">
        <h4>意思決定ポイント</h4>
        ${decisions.map((decision) => `<p class="subtle">・${escapeHtml(decision)}</p>`).join("") || `<p class="subtle">未設定</p>`}
      </article>
    </div>
  `;
}

function renderTaskEditor() {
  const tasks = state.project.analysis?.tasks ?? [];
  ensureTaskIds(tasks);
  const container = document.querySelector("#taskEditorList");
  renderTaskPointSummary(tasks);
  renderAsanaSummary(tasks);
  if (!tasks.length) {
    container.innerHTML = `<div class="task-editor-empty">AI設計またはPPM雛形を実行すると、詳細タスクを編集できます。</div>`;
    return;
  }
  container.innerHTML = tasks.map((task, index) => `
    <article class="task-edit-card" data-task-index="${index}">
      <div class="task-edit-head">
        <label>
          タスク名
          <input data-task-field="title" type="text" maxlength="80" value="${escapeHtml(task.title ?? "")}">
        </label>
        <label>
          担当者
          <select data-task-field="assignee_member_id">
            ${taskAssigneeOptions(task.assignee_member_id)}
          </select>
        </label>
        <label>
          作業量pt
          <input data-task-field="workload_points" type="number" min="1" max="100" value="${Number(task.workload_points ?? 10)}">
        </label>
        <button class="icon-button" data-task-action="delete" type="button" title="削除" aria-label="削除">×</button>
      </div>
      <div class="task-edit-grid">
        <label>
          PPM段階
          <select data-task-field="ppm_stage">
            ${ppmFramework.planningSteps.map((stage) => `<option value="${escapeHtml(stage)}" ${stage === task.ppm_stage ? "selected" : ""}>${escapeHtml(stage)}</option>`).join("")}
          </select>
        </label>
        <label>
          パラメータ
          <select data-task-field="parameter">
            ${ppmFramework.parameters.map((parameter) => `<option value="${escapeHtml(parameter)}" ${parameter === task.parameter ? "selected" : ""}>${escapeHtml(parameter)}</option>`).join("")}
          </select>
        </label>
        <label>
          優先度
          <select data-task-field="priority">
            ${["高", "中", "低"].map((priority) => `<option value="${priority}" ${priority === task.priority ? "selected" : ""}>${priority}</option>`).join("")}
          </select>
        </label>
        <label>
          価値pt
          <input data-task-field="value_points" type="number" min="0" max="100" value="${Number(task.value_points ?? task.workload_points ?? 10)}">
        </label>
      </div>
      <div class="task-result-grid">
        <label>
          Asana状態
          <select data-task-field="status">
            ${["未着手", "進行中", "完了"].map((status) => `<option value="${status}" ${status === (task.status ?? "未着手") ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        <label>
          実績pt
          <input data-task-field="actual_points" type="number" min="0" max="100" value="${Number(task.actual_points ?? 0)}">
        </label>
        <label>
          Asana ID
          <input data-task-field="asana_gid" type="text" maxlength="80" value="${escapeHtml(task.asana_gid ?? "")}" placeholder="Asana側のTask ID">
        </label>
      </div>
      <label>
        成果物
        <input data-task-field="deliverable" type="text" maxlength="96" value="${escapeHtml(task.deliverable ?? "")}">
      </label>
      <label>
        説明
        <textarea data-task-field="description" maxlength="260">${escapeHtml(task.description ?? "")}</textarea>
      </label>
      <label>
        成果メモ
        <textarea data-task-field="result_note" maxlength="300" placeholder="Asanaから取り込んだ成果・完了メモ">${escapeHtml(task.result_note ?? "")}</textarea>
      </label>
    </article>
  `).join("");
}

function ensureTaskIds(tasks) {
  tasks.forEach((task, index) => {
    if (!task.id) task.id = `ppm-${Date.now()}-${index + 1}`;
    if (!task.assignee_member_id || !state.members.some((member) => member.id === task.assignee_member_id)) {
      task.assignee_member_id = state.members[index % Math.max(state.members.length, 1)]?.id ?? "";
    }
    if (!task.status) task.status = "未着手";
    if (task.actual_points == null) task.actual_points = 0;
    if (task.result_note == null) task.result_note = "";
    if (task.asana_gid == null) task.asana_gid = "";
  });
}

function taskAssigneeOptions(selectedId = "") {
  const empty = `<option value="" ${selectedId ? "" : "selected"}>未設定</option>`;
  return [
    empty,
    ...state.members.map((member) => `
      <option value="${escapeHtml(member.id)}" ${member.id === selectedId ? "selected" : ""}>
        ${escapeHtml(member.name)}${member.joinStatus === "途中参加" ? "（途中参加）" : ""}
      </option>
    `)
  ].join("");
}

function taskAssignee(task) {
  return state.members.find((member) => member.id === task.assignee_member_id) ?? null;
}

function taskAssigneeName(task) {
  return taskAssignee(task)?.name ?? "未設定";
}

function renderTaskPointSummary(tasks) {
  const container = document.querySelector("#taskPointSummary");
  const workload = tasks.reduce((sum, task) => sum + Number(task.workload_points ?? 0), 0);
  const value = tasks.reduce((sum, task) => sum + Number(task.value_points ?? task.workload_points ?? 0), 0);
  const highPriority = tasks.filter((task) => task.priority === "高").length;
  const unassigned = tasks.filter((task) => !task.assignee_member_id).length;
  const average = tasks.length ? Math.round((workload / tasks.length) * 10) / 10 : 0;
  container.innerHTML = `
    <div class="task-point-box"><span>タスク数</span><strong>${tasks.length}</strong></div>
    <div class="task-point-box"><span>作業量合計</span><strong>${workload} pt</strong></div>
    <div class="task-point-box"><span>価値合計</span><strong>${value} pt</strong></div>
    <div class="task-point-box"><span>平均作業量 / 高優先</span><strong>${average} / ${highPriority}</strong></div>
    <div class="task-point-box"><span>担当未設定</span><strong>${unassigned}</strong></div>
  `;
}

function taskProgress(tasks) {
  const total = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "完了");
  const completed = completedTasks.length;
  const plannedPoints = tasks.reduce((sum, task) => sum + Number(task.workload_points ?? 0), 0);
  const completedPoints = completedTasks.reduce((sum, task) => sum + Number(task.value_points ?? task.workload_points ?? 0), 0);
  return { total, completed, completedTasks, plannedPoints, completedPoints };
}

function workflowState(tasks) {
  if (!state.project.analysis || !tasks.length) {
    return {
      stage: "設計前",
      current: 0,
      next: "プロジェクト概要を入れて、AI設計またはPPM雛形を作成します。"
    };
  }
  const progress = taskProgress(tasks);
  if (!tasks.some((task) => task.asana_gid)) {
    return {
      stage: "Asanaへ出力",
      current: 1,
      next: "Asana CSV出力を押して、Asanaにタスクをインポートします。"
    };
  }
  if (progress.completed === 0) {
    return {
      stage: "成果待ち",
      current: 2,
      next: "Asanaでタスクを進め、完了・成果・実績を更新します。"
    };
  }
  const openResultProposal = state.proposals.some((proposal) => proposal.status === "open" && proposal.title.includes("成果承認"));
  if (!openResultProposal) {
    return {
      stage: "承認前",
      current: 3,
      next: "Asana成果CSVを読み込んだので、Snapshot承認用の提案を作成します。"
    };
  }
  return {
    stage: "Snapshot準備",
    current: 4,
    next: "SnapshotタブでPayloadをコピーし、スペースへ提案を投げます。"
  };
}

function renderWorkflow() {
  const tasks = state.project.analysis?.tasks ?? [];
  const stateNow = workflowState(tasks);
  const stage = document.querySelector("#workflowStage");
  const steps = document.querySelector("#workflowSteps");
  const next = document.querySelector("#asanaNextAction");
  if (!stage || !steps) return;
  stage.textContent = stateNow.stage;
  const items = [
    ["PPM設計", "概要からタスク・作業量・価値ptを作る"],
    ["Asanaへ渡す", "Asana CSV出力で実行管理に移す"],
    ["成果を受け取る", "AsanaからCSVを書き出して成果CSVとして読む"],
    ["成果を承認する", "完了タスクと価値ptをSnapshot提案にする"],
    ["Snapshotに投げる", "Payloadをコピーして投票・意思決定へ進む"]
  ];
  steps.innerHTML = items.map(([title, body], index) => `
    <article class="workflow-step ${index < stateNow.current ? "done" : index === stateNow.current ? "active" : ""}">
      <span>${index + 1}</span>
      <div>
        <strong>${title}</strong>
        <p>${body}</p>
      </div>
    </article>
  `).join("");
  if (next) next.textContent = `次にやること: ${stateNow.next}`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportTaskCsv() {
  const tasks = state.project.analysis?.tasks ?? [];
  if (!tasks.length) return showToast("出力できる詳細タスクがありません");
  ensureTaskIds(tasks);
  const header = ["No", "タスク名", "担当者", "担当者ID", "PPM段階", "パラメータ", "優先度", "作業量pt", "価値pt", "成果物", "説明"];
  const rows = tasks.map((task, index) => [
    index + 1,
    task.title,
    taskAssigneeName(task),
    task.assignee_member_id,
    task.ppm_stage,
    task.parameter,
    task.priority,
    Number(task.workload_points ?? 0),
    Number(task.value_points ?? task.workload_points ?? 0),
    task.deliverable,
    task.description
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.project.name || "ppm-task-list"}-tasks.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("詳細タスク一覧をCSV出力しました");
}

function exportAsanaCsv() {
  const tasks = state.project.analysis?.tasks ?? [];
  if (!tasks.length) return showToast("Asanaへ出力できるタスクがありません");
  ensureTaskIds(tasks);
  const header = [
    "Name",
    "Notes",
    "Section/Column",
    "Tags",
    "Assignee",
    "Due Date",
    "PPM Task ID",
    "Workload Points",
    "Value Points",
    "PPM Stage",
    "PPM Parameter",
    "Status"
  ];
  const rows = tasks.map((task, index) => {
    const dueDay = new Date();
    dueDay.setDate(dueDay.getDate() + Math.max(2, Math.ceil(Number(task.workload_points ?? 10) / 4)) + index);
    const assignee = taskAssignee(task);
    return [
      task.title,
      [
        `PPM Task ID: ${task.id}`,
        `Assignee: ${assignee?.name ?? "未設定"}`,
        `Assignee Member ID: ${task.assignee_member_id ?? ""}`,
        `Assignee Identity: ${assignee?.wallet ?? ""}`,
        `PPM Stage: ${task.ppm_stage}`,
        `Parameter: ${task.parameter}`,
        `Workload: ${Number(task.workload_points ?? 0)} pt`,
        `Value: ${Number(task.value_points ?? task.workload_points ?? 0)} pt`,
        "",
        task.description ?? "",
        "",
        `Deliverable: ${task.deliverable ?? ""}`
      ].join("\n"),
      task.ppm_stage,
      `PPM,${task.priority ?? "中"},${task.parameter ?? ""}`,
      assignee?.name ?? "",
      dueDay.toISOString().slice(0, 10),
      task.id,
      Number(task.workload_points ?? 0),
      Number(task.value_points ?? task.workload_points ?? 0),
      task.ppm_stage,
      task.parameter,
      task.status ?? "未着手"
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.project.name || "ppm"}-asana-import.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  persist();
  showToast("Asanaインポート用CSVを出力しました");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim().toLowerCase();
}

function rowValue(row, headers, names) {
  for (const name of names) {
    const index = headers.findIndex((header) => header === normalizeHeader(name));
    if (index >= 0) return row[index] ?? "";
  }
  return "";
}

function isCompletedValue(value) {
  return ["true", "yes", "1", "complete", "completed", "完了", "済"].includes(String(value ?? "").trim().toLowerCase());
}

function extractPpmTaskId(row, headers) {
  const direct = rowValue(row, headers, ["PPM Task ID", "ppm_task_id", "Task ID"]);
  if (direct) return direct.trim();
  const notes = rowValue(row, headers, ["Notes", "Description", "説明", "メモ"]);
  return notes.match(/PPM Task ID:\s*([^\s]+)/)?.[1] ?? "";
}

async function handleAsanaResultUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setAsanaStatus(`${file.name} を読み込み中...`, "warn");
  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("CSVにタスク行がありません");
    const headers = rows[0].map(normalizeHeader);
    const tasks = state.project.analysis?.tasks ?? [];
    ensureTaskIds(tasks);
    let matched = 0;
    rows.slice(1).forEach((row) => {
      const ppmId = extractPpmTaskId(row, headers);
      const name = rowValue(row, headers, ["Name", "Task Name", "タスク名"]);
      const task = tasks.find((item) => item.id === ppmId || item.title === name);
      if (!task) return;
      matched += 1;
      const completed = rowValue(row, headers, ["Completed", "Complete", "完了"]);
      const status = rowValue(row, headers, ["Status", "状態"]);
      const actual = rowValue(row, headers, ["Actual Points", "実績pt", "実績ポイント"]);
      const result = rowValue(row, headers, ["Result", "成果", "Result Note", "成果メモ", "Notes"]);
      const asanaGid = rowValue(row, headers, ["Task ID", "GID", "Asana ID"]);
      task.status = isCompletedValue(completed) || isCompletedValue(status) ? "完了" : status || task.status || "進行中";
      if (actual && !Number.isNaN(Number(actual))) task.actual_points = Number(actual);
      if (result) task.result_note = result;
      if (asanaGid) task.asana_gid = asanaGid;
    });
    persist();
    render();
    setAsanaStatus(`${file.name} から ${matched} 件の成果を取り込みました`, "ready");
    showToast("Asana成果CSVを取り込みました");
  } catch (error) {
    setAsanaStatus(`読み込み失敗: ${error.message}`, "error");
  }
}

function setAsanaStatus(message, mode = "") {
  const element = document.querySelector("#asanaStatus");
  element.textContent = message;
  element.className = mode;
}

function syncAsanaApiSettings() {
  state.settings.asanaApiBase = document.querySelector("#asanaApiBase").value.trim().replace(/\/$/, "");
  state.settings.asanaWorkspaceGid = document.querySelector("#asanaWorkspaceGid").value.trim();
  state.settings.asanaProjectGid = document.querySelector("#asanaProjectGid").value.trim();
}

function setAsanaApiState(message, mode = "") {
  const element = document.querySelector("#asanaApiState");
  element.textContent = message;
  element.className = `api-state ${mode}`;
}

function appApiBase() {
  syncAsanaApiSettings();
  const fallbackBase = window.location.protocol.startsWith("http") ? window.location.origin : "";
  return state.settings.asanaApiBase || fallbackBase;
}

async function callAppApi(path, options = {}) {
  const apiBase = appApiBase();
  if (!apiBase) throw new Error("APIサーバーURLを入力してください。Vercel公開URLでは空欄でも使えます");
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `APIエラー: ${response.status}`);
  return data;
}

async function callAsanaApi(path, options = {}) {
  return callAppApi(path, options);
}

async function checkAsanaApiConnection() {
  setAsanaApiState("Asana APIへ接続確認中...", "warn");
  try {
    const data = await callAsanaApi("/api/asana/me");
    persist();
    setAsanaApiState(`接続OK: ${data.name || data.email || "Asanaユーザー"}`, "ready");
  } catch (error) {
    setAsanaApiState(error.message, "error");
  }
}

async function loadAsanaWorkspaces() {
  setAsanaApiState("Asana Workspaceを取得中...", "warn");
  try {
    const data = await callAsanaApi("/api/asana/workspaces");
    const workspaces = data.workspaces ?? [];
    const select = document.querySelector("#asanaWorkspaceSelect");
    select.innerHTML = workspaces.length
      ? workspaces.map((workspace) => `<option value="${escapeHtml(workspace.gid)}">${escapeHtml(workspace.name)} / ${escapeHtml(workspace.gid)}</option>`).join("")
      : `<option value="">Workspaceが見つかりません</option>`;
    if (workspaces.length) {
      state.settings.asanaWorkspaceGid = workspaces[0].gid;
      document.querySelector("#asanaWorkspaceGid").value = workspaces[0].gid;
      select.value = workspaces[0].gid;
      persist();
      setAsanaApiState(`Workspace取得OK: ${workspaces[0].name}`, "ready");
    } else {
      setAsanaApiState("Workspaceが見つかりませんでした", "error");
    }
  } catch (error) {
    setAsanaApiState(error.message, "error");
  }
}

function asanaTaskPayload() {
  const tasks = state.project.analysis?.tasks ?? [];
  ensureTaskIds(tasks);
  if (!tasks.length) throw new Error("送信できるタスクがありません");
  return tasks.map((task, index) => {
    const dueDay = new Date();
    dueDay.setDate(dueDay.getDate() + Math.max(2, Math.ceil(Number(task.workload_points ?? 10) / 4)) + index);
    const assignee = taskAssignee(task);
    return {
      local_id: task.id,
      name: task.title,
      notes: [
        `PPM Task ID: ${task.id}`,
        `Assignee: ${assignee?.name ?? "未設定"}`,
        `Assignee Member ID: ${task.assignee_member_id ?? ""}`,
        `Assignee Identity: ${assignee?.wallet ?? ""}`,
        `PPM Stage: ${task.ppm_stage}`,
        `Parameter: ${task.parameter}`,
        `Workload: ${Number(task.workload_points ?? 0)} pt`,
        `Value: ${Number(task.value_points ?? task.workload_points ?? 0)} pt`,
        "",
        task.description ?? "",
        "",
        `Deliverable: ${task.deliverable ?? ""}`
      ].join("\n"),
      assignee_member_id: task.assignee_member_id ?? "",
      assignee_name: assignee?.name ?? "",
      assignee_identity: assignee?.wallet ?? "",
      section_name: task.ppm_stage,
      due_on: dueDay.toISOString().slice(0, 10)
    };
  });
}

async function createAsanaProjectViaApi() {
  setAsanaApiState("Asanaプロジェクトを作成中...", "warn");
  try {
    syncProjectFromForm();
    syncAsanaApiSettings();
    const workspaceGid = state.settings.asanaWorkspaceGid;
    if (!workspaceGid) throw new Error("Workspace GIDを入力してください");
    const data = await callAsanaApi("/api/asana/projects", {
      method: "POST",
      body: JSON.stringify({
        workspace_gid: workspaceGid,
        name: state.project.name || "PPM Project",
        notes: state.project.summary || ""
      })
    });
    state.settings.asanaProjectGid = data.gid;
    document.querySelector("#asanaProjectGid").value = data.gid;
    persist();
    setAsanaApiState(`作成OK: Project GID ${data.gid}`, "ready");
  } catch (error) {
    setAsanaApiState(error.message, "error");
  }
}

async function pushTasksToAsanaViaApi() {
  setAsanaApiState("Asanaへタスク送信中...", "warn");
  try {
    syncAsanaApiSettings();
    const projectGid = state.settings.asanaProjectGid;
    if (!projectGid) throw new Error("Project GIDを入力してください");
    const data = await callAsanaApi("/api/asana/tasks/bulk", {
      method: "POST",
      body: JSON.stringify({
        project_gid: projectGid,
        tasks: asanaTaskPayload()
      })
    });
    const tasks = state.project.analysis?.tasks ?? [];
    data.tasks?.forEach((item) => {
      const task = tasks.find((candidate) => candidate.id === item.local_id);
      if (task) task.asana_gid = item.gid;
    });
    persist();
    render();
    setAsanaApiState(`${data.tasks?.length ?? 0}件をAsanaへ送信しました`, "ready");
  } catch (error) {
    setAsanaApiState(error.message, "error");
  }
}

async function pullAsanaResultsViaApi() {
  setAsanaApiState("Asanaから成果を同期中...", "warn");
  try {
    syncAsanaApiSettings();
    const projectGid = state.settings.asanaProjectGid;
    if (!projectGid) throw new Error("Project GIDを入力してください");
    const data = await callAsanaApi(`/api/asana/tasks?project_gid=${encodeURIComponent(projectGid)}`);
    const tasks = state.project.analysis?.tasks ?? [];
    let matched = 0;
    data.tasks?.forEach((asanaTask) => {
      const ppmId = asanaTask.ppm_task_id || asanaTask.notes?.match(/PPM Task ID:\s*([^\s]+)/)?.[1] || "";
      const task = tasks.find((candidate) => candidate.asana_gid === asanaTask.gid || candidate.id === ppmId || candidate.title === asanaTask.name);
      if (!task) return;
      matched += 1;
      task.asana_gid = asanaTask.gid;
      task.status = asanaTask.completed ? "完了" : task.status || "進行中";
      task.result_note = asanaTask.notes || task.result_note || "";
    });
    persist();
    render();
    setAsanaApiState(`${matched}件の成果を同期しました`, "ready");
  } catch (error) {
    setAsanaApiState(error.message, "error");
  }
}

function renderAsanaSummary(tasks) {
  const container = document.querySelector("#asanaSummary");
  const progress = taskProgress(tasks);
  const actual = tasks.reduce((sum, task) => sum + Number(task.actual_points ?? 0), 0);
  container.innerHTML = `
    <div class="asana-summary-box"><span>完了タスク</span><strong>${progress.completed} / ${tasks.length}</strong></div>
    <div class="asana-summary-box"><span>実績pt / 計画pt</span><strong>${actual} / ${progress.plannedPoints}</strong></div>
    <div class="asana-summary-box"><span>承認対象価値pt</span><strong>${progress.completedPoints}</strong></div>
  `;
}

function createSnapshotProposalFromResults() {
  const tasks = state.project.analysis?.tasks ?? [];
  const progress = taskProgress(tasks);
  if (!tasks.length) return showToast("先にPPMタスクを作成してください");
  if (!progress.completedTasks.length) return showToast("完了タスクがまだありません");
  const alreadyOpen = state.proposals.find((proposal) => proposal.status === "open" && proposal.title.includes("成果承認"));
  if (alreadyOpen) return showToast("承認用の提案はすでに作成済みです");
  const topTasks = progress.completedTasks
    .slice(0, 6)
    .map((task) => `・${task.title} / 担当: ${taskAssigneeName(task)}（${Number(task.value_points ?? task.workload_points ?? 0)}pt）`)
    .join("\n");
  state.proposals.push({
    id: `p${Date.now()}`,
    title: `${state.project.name || "プロジェクト"} 成果承認`,
    body: [
      `Asanaから取り込んだ完了成果を承認する提案です。`,
      `完了タスク: ${progress.completed} / ${progress.total}`,
      `承認対象価値pt: ${progress.completedPoints}`,
      "",
      topTasks,
      "",
      "承認後、この成果をSnapshotの意思決定・配分・次フェーズ判断に使います。"
    ].join("\n"),
    threshold: 60,
    status: "open",
    createdAt: today(),
    votes: {}
  });
  persist();
  render();
  showToast("Snapshot承認用の提案を作成しました");
}

function ganttRows(tasks) {
  const stageOffsets = new Map();
  const rows = tasks.map((task, index) => {
    const duration = Math.max(2, Math.ceil(Number(task.workload_points ?? 10) / 4));
    const stage = task.ppm_stage ?? "MASTER PLANNING";
    const currentOffset = stageOffsets.get(stage) ?? index * 2;
    stageOffsets.set(stage, currentOffset + duration + 1);
    return {
      task,
      start: currentOffset,
      duration,
      end: currentOffset + duration
    };
  });
  const totalDays = Math.max(...rows.map((row) => row.end), 1);
  return { rows, totalDays };
}

function renderGanttChart() {
  const tasks = state.project.analysis?.tasks ?? [];
  ensureTaskIds(tasks);
  const container = document.querySelector("#ganttChart");
  if (!tasks.length) {
    container.innerHTML = `<div class="gantt-empty">AI設計またはPPM雛形を実行すると、ガントチャートを表示します。</div>`;
    return;
  }
  const { rows, totalDays } = ganttRows(tasks);
  const scaleMarks = [0, 25, 50, 75, 100].map((percent) => {
    const day = Math.round((totalDays * percent) / 100);
    return `<span style="position:absolute;left:${percent}%;transform:translateX(-50%);">D${day}</span>`;
  }).join("");
  container.innerHTML = `
    <div class="gantt-scale">
      <span>タスク</span>
      <div class="gantt-track">${scaleMarks}</div>
      <span>期間</span>
    </div>
    ${rows.map((row, index) => {
      const left = (row.start / totalDays) * 100;
      const width = Math.max((row.duration / totalDays) * 100, 3);
      const stageIndex = ppmFramework.planningSteps.indexOf(row.task.ppm_stage);
      return `
        <div class="gantt-row">
          <div>
            <div class="gantt-title">${escapeHtml(row.task.title ?? "未設定タスク")}</div>
            <div class="gantt-meta">${escapeHtml(row.task.ppm_stage ?? "")} · ${escapeHtml(row.task.priority ?? "中")} · 担当 ${escapeHtml(taskAssigneeName(row.task))}</div>
          </div>
          <div class="gantt-track">
            <span class="gantt-bar stage-${Math.max(stageIndex, 0)}" style="left:${left}%;width:${width}%;"></span>
          </div>
          <span class="gantt-meta">${row.duration}日 / ${Number(row.task.workload_points ?? 0)}pt</span>
        </div>
      `;
    }).join("")}
  `;
}

function recalculateProjectValue() {
  const tasks = state.project.analysis?.tasks ?? [];
  if (!tasks.length) return;
  const totalValue = tasks.reduce((sum, task) => sum + Number(task.value_points ?? task.workload_points ?? 0), 0);
  const maxValue = Math.max(tasks.length * 30, 1);
  state.project.analysis.value_score = Math.max(0, Math.min(100, Math.round((totalValue / maxValue) * 100)));
}

function updateTaskField(card, field, value) {
  const index = Number(card.dataset.taskIndex);
  const task = state.project.analysis?.tasks?.[index];
  if (!task) return;
  task[field] = field === "workload_points" || field === "value_points" || field === "actual_points" ? Number(value) : value;
  recalculateProjectValue();
  persist();
  renderPpmResult(state.project.analysis);
  renderGanttChart();
  renderSnapshotPayload();
}

function addManualTask() {
  if (!state.project.analysis) {
    syncProjectFromForm();
    state.project.analysis = buildLocalPpmAnalysis();
  }
  state.project.analysis.tasks.push({
    title: "新規タスク",
    ppm_stage: "MASTER PLANNING",
    parameter: "PROCESS MANAGEMENT",
    description: "タスク内容を入力してください。",
    deliverable: "成果物を入力",
    workload_points: 10,
    value_points: 10,
    assignee_member_id: state.members[0]?.id ?? "",
    actual_points: 0,
    status: "未着手",
    result_note: "",
    asana_gid: "",
    priority: "中"
  });
  recalculateProjectValue();
  persist();
  renderPpmResult(state.project.analysis);
  renderTaskEditor();
  renderGanttChart();
  renderSnapshotPayload();
  showToast("タスクを追加しました");
}

function deleteTask(card) {
  const index = Number(card.dataset.taskIndex);
  state.project.analysis?.tasks?.splice(index, 1);
  recalculateProjectValue();
  persist();
  renderPpmResult(state.project.analysis);
  renderTaskEditor();
  renderGanttChart();
  renderSnapshotPayload();
  showToast("タスクを削除しました");
}

function syncProjectFromForm() {
  state.project.name = document.querySelector("#projectName").value.trim();
  state.project.summary = document.querySelector("#projectSummary").value.trim();
  state.project.model = document.querySelector("#openAiModel").value.trim() || "gpt-5.5";
}

function setAiState(message, mode = "") {
  const element = document.querySelector("#aiState");
  element.textContent = message;
  element.className = `ai-state ${mode}`;
}

function setFileStatus(message, mode = "") {
  const element = document.querySelector("#fileStatus");
  element.textContent = message;
  element.className = mode;
}

function clipSummary(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 900);
}

function stripXmlTags(xmlText) {
  return xmlText
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

async function readDocxText(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const marker = new TextEncoder().encode("word/document.xml");
  let markerIndex = -1;
  for (let i = 0; i <= bytes.length - marker.length; i += 1) {
    let matched = true;
    for (let j = 0; j < marker.length; j += 1) {
      if (bytes[i + j] !== marker[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      markerIndex = i;
      break;
    }
  }
  if (markerIndex < 0) throw new Error("DOCX本文を見つけられませんでした");
  const tail = bytes.slice(markerIndex);
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(tail);
  const xmlStart = decoded.indexOf("<?xml");
  const documentEnd = decoded.indexOf("</w:document>");
  if (xmlStart < 0 || documentEnd < 0) throw new Error("DOCX本文の簡易抽出に失敗しました");
  return stripXmlTags(decoded.slice(xmlStart, documentEnd + "</w:document>".length));
}

async function readProjectFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".docx")) return readDocxText(file);
  return file.text();
}

async function handleProjectFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setFileStatus(`${file.name} を読み込み中...`, "warn");
  try {
    const text = await readProjectFile(file);
    const summary = clipSummary(text);
    if (!summary) throw new Error("読み取れるテキストがありませんでした");
    document.querySelector("#projectSummary").value = summary;
    if (!document.querySelector("#projectName").value.trim()) {
      document.querySelector("#projectName").value = file.name.replace(/\.[^.]+$/, "");
    }
    syncProjectFromForm();
    persist();
    renderSnapshotPayload();
    setFileStatus(`${file.name} から概要を読み込みました`, "ready");
    showToast("概要ファイルを読み込みました");
  } catch (error) {
    setFileStatus(`読み込み失敗: ${error.message}`, "error");
  }
}

function buildLocalPpmAnalysis() {
  const name = state.project.name || "未命名プロジェクト";
  const summary = state.project.summary || "プロジェクト概要が未入力です。";
  const taskSeeds = [
    ["ミッション・ビジョン定義", "IMAGE PLANNING", "STAKEHOLDERS ANALYSIS", "目的、スコープ、期待成果、主要ステークホルダーを整理する。", "ミッション/ビジョン定義書", 18, "高"],
    ["ステークホルダー影響分析", "PILOT PLANNING", "STAKEHOLDERS ANALYSIS", "関係者の期待、影響力、関与度を整理し、合意形成ルートを設計する。", "RACI/影響度マップ", 16, "高"],
    ["WBSと作業量見積", "MASTER PLANNING", "PROCESS MANAGEMENT", "成果物単位で作業を分解し、担当・工数・依存関係を初期設定する。", "WBS/工数表", 24, "高"],
    ["技術・運用方式の設計", "MASTER PLANNING", "TECHNOLOGY", "利用ツール、データ管理、セキュリティ、運用手順を決める。", "運用設計メモ", 14, "中"],
    ["投資対効果と価値評価", "MASTER PLANNING", "INVESTMENT & FINANCE", "費用、便益、社会的価値、継続性をスコアリングする。", "価値評価シート", 18, "高"],
    ["意思決定ルールの確定", "IMPLEMENTATION PLANNING", "DECISION MAKING SYSTEM", "提案、投票、可決ライン、エスカレーション、決定ログの運用を決める。", "意思決定ルール", 12, "中"]
  ];
  return {
    project_name: name,
    overview: `${summary} 牧山式PPMに基づき、構想、検証、全体計画、実行計画の順で価値と作業量を設計します。`,
    ppm_stages: ppmFramework.planningSteps,
    value_score: 76,
    tasks: taskSeeds.map(([title, ppm_stage, parameter, description, deliverable, workload_points, priority]) => ({
      title,
      ppm_stage,
      parameter,
      description,
      deliverable,
      workload_points,
      value_points: workload_points,
      priority
    })),
    risks: [
      "ステークホルダー期待値が初期段階で揃わず、合意形成に時間がかかる。",
      "価値評価の基準が曖昧なままだと、貢献ポイントと意思決定重みの納得感が落ちる。",
      "Snapshot連携前にWallet/ENS管理と重複排除を固める必要がある。"
    ],
    decision_points: [
      "総合価値スコアを何点以上で推進判断にするか。",
      "貢献度を投票重みに使う範囲と、補正ルールをどうするか。",
      "月次で見直す指標、タスク、貢献ログの責任者を誰にするか。"
    ]
  };
}

function ppmPrompt() {
  return [
    "あなたは牧山式PROJECT PROCESS MANAGEMENT(PPM)を使うプロジェクト設計AIです。",
    "入力されたプロジェクト名と概要から、発生するタスク、作業量、全体価値、リスク、意思決定ポイントを日本語で設計してください。",
    `PLANNING STEP: ${ppmFramework.planningSteps.join(", ")}`,
    `PARAMETER: ${ppmFramework.parameters.join(", ")}`,
    "作業量は貢献度ポイントに転用できるよう、各タスクに workload_points を 5〜40 の整数で付けてください。",
    "value_score は実現可能性、社会的/事業的価値、関係者合意、継続性を総合した 0〜100 の整数にしてください。",
    "出力は指定JSONスキーマに厳密に従ってください。"
  ].join("\n");
}

function ppmSchema() {
  const task = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      ppm_stage: { type: "string", enum: ppmFramework.planningSteps },
      parameter: { type: "string", enum: ppmFramework.parameters },
      description: { type: "string" },
      deliverable: { type: "string" },
      workload_points: { type: "integer" },
      value_points: { type: "integer" },
      priority: { type: "string", enum: ["高", "中", "低"] }
    },
    required: ["title", "ppm_stage", "parameter", "description", "deliverable", "workload_points", "value_points", "priority"]
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      project_name: { type: "string" },
      overview: { type: "string" },
      ppm_stages: { type: "array", items: { type: "string" } },
      value_score: { type: "integer" },
      tasks: { type: "array", minItems: 5, maxItems: 10, items: task },
      risks: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
      decision_points: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } }
    },
    required: ["project_name", "overview", "ppm_stages", "value_score", "tasks", "risks", "decision_points"]
  };
}

async function generatePpmPlanWithOpenAi() {
  syncProjectFromForm();
  if (!state.project.name || !state.project.summary) {
    showToast("プロジェクト名と概要を入力してください");
    return;
  }
  const apiKey = document.querySelector("#openAiKey").value.trim();

  setAiState("OpenAI APIでPPM設計中です...", "loading");
  const payload = {
    model: state.project.model || "gpt-5.5",
    instructions: ppmPrompt(),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `プロジェクト名: ${state.project.name}\n概要: ${state.project.summary}`
          }
        ]
      }
    ],
    reasoning: { effort: "medium" },
    text: {
      format: {
        type: "json_schema",
        name: "ppm_project_design",
        strict: true,
        schema: ppmSchema()
      }
    }
  };

  try {
    const data = await callAppApi("/api/openai/ppm-plan", {
      method: "POST",
      body: JSON.stringify({
        project_name: state.project.name,
        summary: state.project.summary,
        model: state.project.model || "gpt-5.5"
      })
    });
    state.project.analysis = data.analysis;
    recalculateProjectValue();
    persist();
    render();
    setAiState("サーバー側OpenAI APIによるPPM設計が完了しました。", "ready");
    showToast("AI設計が完了しました");
  } catch (serverError) {
    if (!apiKey) {
      state.project.analysis = buildLocalPpmAnalysis();
      persist();
      render();
      setAiState(`サーバー側AIを使えないため、PPM雛形を表示しました: ${serverError.message}`, "ready");
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText.slice(0, 240));
    }
    const data = await response.json();
    const outputText = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).find((part) => part.type === "output_text")?.text;
    if (!outputText) throw new Error("AI出力を読み取れませんでした");
    state.project.analysis = JSON.parse(outputText);
    recalculateProjectValue();
    persist();
    render();
    setAiState("OpenAI APIによるPPM設計が完了しました。", "ready");
    showToast("AI設計が完了しました");
    } catch (clientError) {
      state.project.analysis = buildLocalPpmAnalysis();
      persist();
      render();
      setAiState(`API呼び出しに失敗したため、PPM雛形を表示しました: ${clientError.message}`, "ready");
    }
  }
}

function addAiTasksToContributionLog() {
  const tasks = state.project.analysis?.tasks ?? [];
  if (tasks.length === 0) return showToast("追加できるAIタスクがありません");
  const defaultMember = state.members[0]?.id;
  if (!defaultMember) return showToast("先にメンバーを追加してください");
  tasks.slice(0, 6).forEach((task, index) => {
    state.contributions.push({
      id: `c${Date.now()}-${index}`,
      memberId: task.assignee_member_id || defaultMember,
      category: task.parameter === "DECISION MAKING SYSTEM" ? "戦略" : task.parameter === "PROCESS MANAGEMENT" ? "調整" : "調査",
      title: task.title,
      points: Number(task.workload_points ?? 10),
      date: today()
    });
  });
  persist();
  render();
  showToast("主要タスクを貢献ログへ追加しました");
}

function renderRanking() {
  const totals = contributionTotals();
  const powers = votingPower();
  const sorted = [...state.members].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));
  document.querySelector("#rankingList").innerHTML = sorted.map((member, index) => {
    const points = totals[member.id] ?? 0;
    const power = powers[member.id] ?? 0;
    return `
      <article class="rank-item">
        <div class="rank-top">
          <span class="title-line">${index + 1}. ${escapeHtml(member.name)}</span>
          <span class="pill">${power}%</span>
        </div>
        <div class="subtle">${points} pt · ${escapeHtml(member.wallet)}</div>
        <div class="bar"><span style="width:${Math.min(power, 100)}%"></span></div>
      </article>
    `;
  }).join("");
}

function renderProposalSummary() {
  const proposals = state.proposals.filter((proposal) => proposal.status === "open");
  document.querySelector("#proposalList").innerHTML = proposals.map((proposal) => {
    const score = proposalScore(proposal);
    return `
      <article class="proposal-item">
        <div class="proposal-top">
          <span class="title-line">${escapeHtml(proposal.title)}</span>
          <span class="pill ${score.passed ? "" : "amber"}">${score.passed ? "可決圏" : "審議中"}</span>
        </div>
        <div class="subtle">賛成 ${score.yes}% · 反対 ${score.no}% · 棄権 ${score.abstain}%</div>
        <div class="bar"><span style="width:${Math.min(score.yesRatio, 100)}%"></span></div>
      </article>
    `;
  }).join("") || `<div class="subtle">進行中の提案はありません。</div>`;
}

function renderMembers() {
  const powers = votingPower();
  document.querySelector("#memberTable").innerHTML = state.members.map((member) => `
    <article class="member-item">
      <div class="member-top">
        <span class="title-line">${escapeHtml(member.name)}</span>
        <span class="pill">${powers[member.id] ?? 0}%</span>
      </div>
      <div class="subtle">${escapeHtml(member.role || "役割未設定")} · ${escapeHtml(member.joinStatus || "初期")} ${escapeHtml(member.joinedAt || "日付未設定")} · ${escapeHtml(member.wallet)}</div>
    </article>
  `).join("");
}

function renderOverviewMembers() {
  const totals = contributionTotals();
  const powers = votingPower();
  document.querySelector("#overviewMemberTable").innerHTML = state.members.map((member) => `
    <tr data-member-id="${escapeHtml(member.id)}">
      <td>
        <input data-overview-member-field="name" type="text" maxlength="24" value="${escapeHtml(member.name)}" aria-label="${escapeHtml(member.name)}の名前">
      </td>
      <td>
        <input data-overview-member-field="wallet" type="text" maxlength="64" value="${escapeHtml(member.wallet)}" aria-label="${escapeHtml(member.name)}のID">
      </td>
      <td>
        <select data-overview-member-field="joinStatus" aria-label="${escapeHtml(member.name)}の参加区分">
          <option value="初期" ${member.joinStatus === "初期" ? "selected" : ""}>初期</option>
          <option value="途中参加" ${member.joinStatus === "途中参加" ? "selected" : ""}>途中参加</option>
        </select>
      </td>
      <td>
        <input data-overview-member-field="joinedAt" type="date" value="${escapeHtml(member.joinedAt || "")}" aria-label="${escapeHtml(member.name)}の参加日">
      </td>
      <td>
        <input data-overview-member-field="role" type="text" maxlength="40" value="${escapeHtml(member.role || "")}" placeholder="例：企画・設計" aria-label="${escapeHtml(member.name)}の役割">
      </td>
      <td class="numeric-cell">${totals[member.id] ?? 0}</td>
      <td class="numeric-cell">${powers[member.id] ?? 0}%</td>
      <td>
        <button class="icon-button danger-button" data-overview-member-action="delete" type="button" title="削除" aria-label="${escapeHtml(member.name)}を削除">×</button>
      </td>
    </tr>
  `).join("");
}

function renderContributionLog() {
  const items = activeFilter === "all"
    ? state.contributions
    : state.contributions.filter((item) => item.category === activeFilter);

  document.querySelector("#contributionLog").innerHTML = [...items].reverse().map((item) => `
    <article class="log-item">
      <div class="log-top">
        <span class="title-line">${escapeHtml(item.title)}</span>
        <span class="pill ${item.category === "調整" ? "amber" : ""}">${Number(item.points)} pt</span>
      </div>
      <div class="subtle">${escapeHtml(memberName(item.memberId))} · ${escapeHtml(item.category)} · ${escapeHtml(item.date)}</div>
    </article>
  `).join("") || `<div class="subtle">該当するログはありません。</div>`;
}

function renderDecisionList() {
  document.querySelector("#decisionList").innerHTML = state.proposals.map((proposal) => {
    const score = proposalScore(proposal);
    const votes = Object.entries(proposal.votes)
      .map(([memberId, choice]) => `${memberName(memberId)}:${choiceLabel(choice)}`)
      .join(" / ");
    return `
      <article class="decision-item">
        <div class="decision-top">
          <span class="title-line">${escapeHtml(proposal.title)}</span>
          <span class="pill ${score.passed ? "" : "amber"}">${proposal.status === "closed" ? "確定" : score.passed ? "可決圏" : "審議中"}</span>
        </div>
        <p class="subtle">${escapeHtml(proposal.body)}</p>
        <div class="score-grid">
          <div class="score-box"><span class="subtle">賛成</span><strong>${score.yes}%</strong></div>
          <div class="score-box"><span class="subtle">反対</span><strong>${score.no}%</strong></div>
          <div class="score-box"><span class="subtle">棄権</span><strong>${score.abstain}%</strong></div>
        </div>
        <div class="subtle">可決ライン ${proposal.threshold}% · ${escapeHtml(votes || "投票なし")}</div>
      </article>
    `;
  }).join("");
}

function renderVotePreview() {
  const proposal = state.proposals.find((item) => item.id === document.querySelector("#voteProposal").value);
  const member = state.members.find((item) => item.id === document.querySelector("#voteMember").value);
  if (!proposal || !member) {
    document.querySelector("#votePreview").textContent = "投票対象を選択してください。";
    return;
  }
  const powers = votingPower();
  const score = proposalScore(proposal);
  const current = proposal.votes[member.id] ? choiceLabel(proposal.votes[member.id]) : "未投票";
  document.querySelector("#votePreview").textContent = `${member.name}の投票重みは${powers[member.id] ?? 0}%。現在は${current}。提案の賛成比率は${score.yesRatio}%です。`;
}

function renderSnapshotPayload() {
  const powers = votingPower();
  const payload = {
    space: state.settings.spaceId,
    network: state.settings.networkId,
    strategy: state.settings.useContributionWeight ? "contribution-weighted" : "one-member-one-vote",
    generatedAt: new Date().toISOString(),
    project: {
      name: state.project.name,
      summary: state.project.summary,
      ppmAnalysis: state.project.analysis
    },
    members: state.members.map((member) => ({
      name: member.name,
      address: member.wallet,
      role: member.role || "",
      joinStatus: member.joinStatus || "初期",
      joinedAt: member.joinedAt || "",
      votingPower: powers[member.id] ?? 0
    })),
    proposals: state.proposals.map((proposal) => ({
      title: proposal.title,
      body: proposal.body,
      choices: ["賛成", "反対", "棄権"],
      threshold: proposal.threshold,
      status: proposal.status,
      score: proposalScore(proposal)
    }))
  };
  document.querySelector("#snapshotPayload").textContent = JSON.stringify(payload, null, 2);
  return payload;
}

function syncSettingsFromForm() {
  state.settings.spaceId = document.querySelector("#spaceId").value.trim() || initialState.settings.spaceId;
  state.settings.networkId = document.querySelector("#networkId").value;
  state.settings.useContributionWeight = document.querySelector("#useContributionWeight").checked;
  state.settings.cloudWorkspaceKey = document.querySelector("#cloudWorkspaceKey").value.trim() || initialState.settings.cloudWorkspaceKey;
  syncAsanaApiSettings();
}

function cloudKey() {
  syncSettingsFromForm();
  return state.settings.cloudWorkspaceKey || initialState.settings.cloudWorkspaceKey;
}

async function saveStateToCloud() {
  setCloudState("クラウドDBへ保存中...", "warn");
  try {
    syncProjectFromForm();
    syncSettingsFromForm();
    const data = await callAppApi("/api/state", {
      method: "POST",
      body: JSON.stringify({
        key: cloudKey(),
        state
      })
    });
    persist();
    setCloudState(`保存OK: ${new Date(data.savedAt).toLocaleString("ja-JP")}`, "ready");
    showToast("クラウドDBへ保存しました");
  } catch (error) {
    setCloudState(error.message, "error");
  }
}

async function loadStateFromCloud() {
  setCloudState("クラウドDBから読込中...", "warn");
  try {
    const data = await callAppApi(`/api/state?key=${encodeURIComponent(cloudKey())}`);
    if (!data.state) {
      setCloudState("この保存キーにはまだデータがありません", "warn");
      return;
    }
    state = mergeState(structuredClone(initialState), data.state);
    persist();
    document.querySelector("#cloudWorkspaceKey").value = state.settings.cloudWorkspaceKey ?? initialState.settings.cloudWorkspaceKey;
    document.querySelector("#spaceId").value = state.settings.spaceId;
    document.querySelector("#networkId").value = state.settings.networkId;
    document.querySelector("#useContributionWeight").checked = state.settings.useContributionWeight;
    document.querySelector("#asanaApiBase").value = state.settings.asanaApiBase ?? "";
    document.querySelector("#asanaWorkspaceGid").value = state.settings.asanaWorkspaceGid ?? "";
    document.querySelector("#asanaProjectGid").value = state.settings.asanaProjectGid ?? "";
    render();
    setCloudState(`読込OK: ${data.savedAt ? new Date(data.savedAt).toLocaleString("ja-JP") : "保存日時なし"}`, "ready");
    showToast("クラウドDBから読み込みました");
  } catch (error) {
    setCloudState(error.message, "error");
  }
}

function render() {
  renderSelects();
  renderMetrics();
  renderWorkflow();
  renderProjectPlanner();
  renderTaskEditor();
  renderGanttChart();
  renderRanking();
  renderProposalSummary();
  renderOverviewMembers();
  renderMembers();
  renderContributionLog();
  renderDecisionList();
  renderVotePreview();
  renderSnapshotPayload();
}

function choiceLabel(choice) {
  return { yes: "賛成", no: "反対", abstain: "棄権" }[choice] ?? choice;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeIdentity(value) {
  return value.trim().toLowerCase();
}

function identityKind(value) {
  const identity = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(identity)) return { ok: true, type: "wallet", label: "Wallet形式OK" };
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(identity)) return { ok: true, type: "ens", label: "ENS形式OK" };
  if (/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,47}$/.test(identity)) return { ok: true, type: "temporary", label: "仮IDとして登録" };
  return { ok: false, type: "invalid", label: "ID形式を確認してください" };
}

function candidateIdentityFromName(name) {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return ascii.length >= 3 ? `${ascii}.eth` : "";
}

function memberSuggestions(name) {
  const query = name.trim().toLowerCase();
  const existingNames = state.members.map((member) => ({
    name: member.name,
    identity: member.wallet,
    role: "登録済み"
  }));
  const inferred = candidateIdentityFromName(name)
    ? [{ name: name.trim(), identity: candidateIdentityFromName(name), role: "入力から推測" }]
    : [];
  const pool = [...memberDirectory, ...existingNames, ...inferred];
  const seen = new Set();
  return pool
    .filter((candidate) => {
      const key = `${candidate.name}:${candidate.identity}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      if (!query) return memberDirectory.includes(candidate);
      return candidate.name.toLowerCase().includes(query) || candidate.identity.toLowerCase().includes(query);
    })
    .slice(0, 6);
}

function renderMemberSuggestions() {
  const name = document.querySelector("#memberName").value;
  const suggestions = memberSuggestions(name);
  document.querySelector("#memberSuggestions").innerHTML = suggestions.map((candidate) => `
    <button class="suggestion-chip" type="button" data-name="${escapeHtml(candidate.name)}" data-identity="${escapeHtml(candidate.identity)}">
      ${escapeHtml(candidate.name)} · ${escapeHtml(candidate.role)}
    </button>
  `).join("");
}

function renderIdentityStatus() {
  const walletInput = document.querySelector("#memberWallet");
  const status = document.querySelector("#identityStatus");
  const value = walletInput.value.trim();
  if (!value) {
    status.textContent = "Wallet、ENS、または仮IDを入力してください";
    status.className = "identity-status";
    return;
  }
  const kind = identityKind(value);
  const duplicate = state.members.some((member) => normalizeIdentity(member.wallet) === normalizeIdentity(value));
  status.textContent = duplicate ? "このIDは既に登録済みです" : kind.label;
  status.className = `identity-status ${duplicate || !kind.ok ? "error" : kind.type === "temporary" ? "warn" : "valid"}`;
}

function validateMemberValues(name, identity, currentMemberId = "") {
  if (!name || !identity) return "名前とIDを入力してください";
  if (state.members.some((member) => member.id !== currentMemberId && member.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    return "同じ名前の参加者が既にいます";
  }
  if (state.members.some((member) => member.id !== currentMemberId && normalizeIdentity(member.wallet) === normalizeIdentity(identity))) {
    return "同じIDの参加者が既にいます";
  }
  if (!identityKind(identity).ok) return "ID形式を確認してください";
  return "";
}

function validateMemberInput(name, identity) {
  return validateMemberValues(name, identity);
}

function updateOverviewMember(row, field, value) {
  const member = state.members.find((item) => item.id === row.dataset.memberId);
  if (!member) return;
  const next = {
    ...member,
    [field]: value.trim()
  };
  if (["role", "joinStatus", "joinedAt"].includes(field)) {
    member.role = next.role;
    member.joinStatus = next.joinStatus;
    member.joinedAt = next.joinedAt;
  } else {
    const validationError = validateMemberValues(next.name, next.wallet, member.id);
    if (validationError) {
      row.querySelector(`[data-overview-member-field="${field}"]`).value = member[field] ?? "";
      showToast(validationError);
      return;
    }
    member.name = next.name;
    member.wallet = next.wallet;
  }
  persist();
  render();
  showToast("メンバー情報を更新しました");
}

function uniqueMemberDraft() {
  const usedNames = new Set(state.members.map((member) => member.name.trim().toLowerCase()));
  const usedIds = new Set(state.members.map((member) => normalizeIdentity(member.wallet)));
  let index = state.members.length + 1;
  while (usedNames.has(`新規メンバー${index}`.toLowerCase()) || usedIds.has(`member-${index}`)) {
    index += 1;
  }
  return {
    id: `m${Date.now()}`,
    name: `新規メンバー${index}`,
    wallet: `member-${index}`,
    role: "",
    joinStatus: "途中参加",
    joinedAt: today()
  };
}

function addOverviewMember() {
  state.members.push(uniqueMemberDraft());
  persist();
  render();
  showToast("途中参加メンバーを追加しました");
}

function deleteOverviewMember(row) {
  const memberId = row.dataset.memberId;
  if (state.members.length <= 1) return showToast("メンバーは1人以上必要です");
  const member = state.members.find((item) => item.id === memberId);
  state.members = state.members.filter((item) => item.id !== memberId);
  state.contributions = state.contributions.filter((item) => item.memberId !== memberId);
  state.proposals.forEach((proposal) => {
    delete proposal.votes[memberId];
  });
  persist();
  render();
  showToast(`${member?.name ?? "メンバー"}を削除しました`);
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function today() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = values.year;
  const month = values.month;
  const day = values.day;
  return `${year}-${month}-${day}`;
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active", section.id === view));
    document.querySelector("#viewTitle").textContent = views[view];
  });
});

document.querySelector("#contributionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = document.querySelector("#contributionTitle").value.trim();
  const points = Number(document.querySelector("#contributionPoints").value);
  if (!title || points < 1) return showToast("内容とポイントを確認してください");

  state.contributions.push({
    id: `c${Date.now()}`,
    memberId: document.querySelector("#contributionMember").value,
    category: document.querySelector("#contributionCategory").value,
    title,
    points,
    date: today()
  });
  event.target.reset();
  document.querySelector("#contributionPoints").value = 12;
  persist();
  render();
  showToast("貢献を追加しました");
});

document.querySelector("#memberForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#memberName").value.trim();
  const wallet = document.querySelector("#memberWallet").value.trim();
  const validationError = validateMemberInput(name, wallet);
  if (validationError) return showToast(validationError);
  const directoryMatch = memberDirectory.find((candidate) => normalizeIdentity(candidate.identity) === normalizeIdentity(wallet) || candidate.name === name);
  state.members.push({ id: `m${Date.now()}`, name, wallet, role: directoryMatch?.role ?? "", joinStatus: "途中参加", joinedAt: today() });
  event.target.reset();
  renderMemberSuggestions();
  renderIdentityStatus();
  persist();
  render();
  showToast("メンバーを追加しました");
});

document.querySelector("#memberName").addEventListener("input", () => {
  const inferred = candidateIdentityFromName(document.querySelector("#memberName").value);
  const walletInput = document.querySelector("#memberWallet");
  if (!walletInput.value.trim() && inferred) walletInput.value = inferred;
  renderMemberSuggestions();
  renderIdentityStatus();
});

document.querySelector("#memberWallet").addEventListener("input", renderIdentityStatus);

document.querySelector("#memberSuggestions").addEventListener("click", (event) => {
  const chip = event.target.closest(".suggestion-chip");
  if (!chip) return;
  document.querySelector("#memberName").value = chip.dataset.name;
  document.querySelector("#memberWallet").value = chip.dataset.identity;
  renderMemberSuggestions();
  renderIdentityStatus();
});

document.querySelector("#addOverviewMember").addEventListener("click", addOverviewMember);

document.querySelector("#overviewMemberTable").addEventListener("change", (event) => {
  const field = event.target.dataset.overviewMemberField;
  const row = event.target.closest("tr[data-member-id]");
  if (!field || !row) return;
  updateOverviewMember(row, field, event.target.value);
});

document.querySelector("#overviewMemberTable").addEventListener("click", (event) => {
  const action = event.target.dataset.overviewMemberAction;
  const row = event.target.closest("tr[data-member-id]");
  if (action !== "delete" || !row) return;
  deleteOverviewMember(row);
});

document.querySelector("#generatePpmPlan").addEventListener("click", generatePpmPlanWithOpenAi);

document.querySelector("#localPpmPlan").addEventListener("click", () => {
  syncProjectFromForm();
  if (!state.project.name || !state.project.summary) return showToast("プロジェクト名と概要を入力してください");
  state.project.analysis = buildLocalPpmAnalysis();
  persist();
  render();
  setAiState("牧山式PPMのローカル雛形を生成しました。", "ready");
});

document.querySelector("#addAiTasksToLog").addEventListener("click", addAiTasksToContributionLog);
document.querySelector("#saveCloudState").addEventListener("click", saveStateToCloud);
document.querySelector("#loadCloudState").addEventListener("click", loadStateFromCloud);
document.querySelector("#addManualTask").addEventListener("click", addManualTask);
document.querySelector("#exportTaskCsv").addEventListener("click", exportTaskCsv);
document.querySelector("#exportAsanaCsv").addEventListener("click", exportAsanaCsv);
document.querySelector("#createSnapshotProposalFromResults").addEventListener("click", createSnapshotProposalFromResults);
document.querySelector("#asanaResultFile").addEventListener("change", handleAsanaResultUpload);
document.querySelector("#checkAsanaApi").addEventListener("click", checkAsanaApiConnection);
document.querySelector("#loadAsanaWorkspaces").addEventListener("click", loadAsanaWorkspaces);
document.querySelector("#createAsanaProjectApi").addEventListener("click", createAsanaProjectViaApi);
document.querySelector("#pushTasksToAsanaApi").addEventListener("click", pushTasksToAsanaViaApi);
document.querySelector("#pullAsanaResultsApi").addEventListener("click", pullAsanaResultsViaApi);
document.querySelector("#asanaWorkspaceSelect").addEventListener("change", (event) => {
  state.settings.asanaWorkspaceGid = event.target.value;
  document.querySelector("#asanaWorkspaceGid").value = event.target.value;
  persist();
});

document.querySelector("#taskEditorList").addEventListener("input", (event) => {
  const field = event.target.dataset.taskField;
  const card = event.target.closest(".task-edit-card");
  if (!field || !card) return;
  updateTaskField(card, field, event.target.value);
});

document.querySelector("#taskEditorList").addEventListener("change", (event) => {
  const field = event.target.dataset.taskField;
  const card = event.target.closest(".task-edit-card");
  if (!field || !card) return;
  updateTaskField(card, field, event.target.value);
  renderTaskEditor();
});

document.querySelector("#taskEditorList").addEventListener("click", (event) => {
  const action = event.target.dataset.taskAction;
  const card = event.target.closest(".task-edit-card");
  if (action !== "delete" || !card) return;
  deleteTask(card);
});

["#projectName", "#projectSummary", "#openAiModel"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    syncProjectFromForm();
    persist();
    renderSnapshotPayload();
  });
});

document.querySelector("#projectFile").addEventListener("change", handleProjectFileUpload);

document.querySelector("#proposalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = document.querySelector("#proposalTitle").value.trim();
  const body = document.querySelector("#proposalBody").value.trim();
  const threshold = Number(document.querySelector("#proposalThreshold").value);
  if (!title || !body) return showToast("提案名と判断基準を入力してください");
  state.proposals.push({
    id: `p${Date.now()}`,
    title,
    body,
    threshold,
    status: "open",
    createdAt: today(),
    votes: {}
  });
  event.target.reset();
  document.querySelector("#proposalThreshold").value = 60;
  persist();
  render();
  showToast("提案を追加しました");
});

document.querySelectorAll(".vote").forEach((button) => {
  button.addEventListener("click", () => {
    const proposal = state.proposals.find((item) => item.id === document.querySelector("#voteProposal").value);
    const memberId = document.querySelector("#voteMember").value;
    if (!proposal || !memberId) return showToast("投票対象を選択してください");
    proposal.votes[memberId] = button.dataset.choice;
    persist();
    render();
    showToast("投票を記録しました");
  });
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".segment").forEach((segment) => segment.classList.toggle("active", segment === button));
    renderContributionLog();
  });
});

document.querySelector("#closePassed").addEventListener("click", () => {
  let count = 0;
  state.proposals.forEach((proposal) => {
    if (proposal.status === "open" && proposalScore(proposal).passed) {
      proposal.status = "closed";
      count += 1;
    }
  });
  persist();
  render();
  showToast(`${count}件を確定しました`);
});

document.querySelector("#resetDemo").addEventListener("click", () => {
  state = structuredClone(initialState);
  localStorage.removeItem(storageKey);
  document.querySelector("#spaceId").value = state.settings.spaceId;
  document.querySelector("#networkId").value = state.settings.networkId;
  document.querySelector("#useContributionWeight").checked = state.settings.useContributionWeight;
  render();
  showToast("初期データに戻しました");
});

document.querySelector("#downloadJson").addEventListener("click", () => {
  const payload = renderSnapshotPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tla-makiyama-snapshot-payload.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector("#copySnapshotPayload").addEventListener("click", async () => {
  const payload = JSON.stringify(renderSnapshotPayload(), null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    showToast("Payloadをコピーしました");
  } catch {
    showToast("コピーできませんでした");
  }
});

["#voteProposal", "#voteMember", "#spaceId", "#networkId", "#useContributionWeight", "#asanaApiBase", "#asanaWorkspaceGid", "#asanaProjectGid", "#cloudWorkspaceKey"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    syncSettingsFromForm();
    persist();
    renderVotePreview();
    renderSnapshotPayload();
  });
});

document.querySelector("#spaceId").value = state.settings.spaceId;
document.querySelector("#networkId").value = state.settings.networkId;
document.querySelector("#useContributionWeight").checked = state.settings.useContributionWeight;
document.querySelector("#cloudWorkspaceKey").value = state.settings.cloudWorkspaceKey ?? initialState.settings.cloudWorkspaceKey;
document.querySelector("#asanaApiBase").value = state.settings.asanaApiBase ?? "";
document.querySelector("#asanaWorkspaceGid").value = state.settings.asanaWorkspaceGid ?? "";
document.querySelector("#asanaProjectGid").value = state.settings.asanaProjectGid ?? "";
renderMemberSuggestions();
renderIdentityStatus();
render();
