const STORAGE_KEY = "mega-auditoria-interna-v5";

const fallbackQuestionBank = [
  { id: "fallback-1", order: "1.1.1", category: "Geral", text: "Os controles da area estao formalizados?", weight: 10, kind: "question" }
];

const defaultQuestionBank = normalizeQuestions(window.MEGA_DEFAULT_QUESTION_BANK || fallbackQuestionBank);
const savedState = loadState();

const state = {
  questionBank: savedState.questionBank,
  audits: savedState.audits,
  draftAudit: hydrateDraftAudit(savedState.draftAudit, savedState.questionBank),
  activeTab: savedState.activeTab || "dashboard",
  editingQuestionId: null,
  editingAuditId: savedState.editingAuditId || ""
};

const metricsGrid = document.querySelector("#metricsGrid");
const lastAuditSpotlight = document.querySelector("#lastAuditSpotlight");
const recentAudits = document.querySelector("#recentAudits");
const latestFindings = document.querySelector("#latestFindings");
const pausedAudits = document.querySelector("#pausedAudits");
const questionBankPreview = document.querySelector("#questionBankPreview");
const auditMetaForm = document.querySelector("#auditMetaForm");
const questionnaireList = document.querySelector("#questionnaireList");
const draftSummary = document.querySelector("#draftSummary");
const reportsList = document.querySelector("#reportsList");
const questionFileInput = document.querySelector("#questionFileInput");
const restoreQuestionsBtn = document.querySelector("#restoreQuestionsBtn");
const pauseAuditBtn = document.querySelector("#pauseAuditBtn");
const saveDraftBtn = document.querySelector("#saveDraftBtn");
const completeAuditBtn = document.querySelector("#completeAuditBtn");
const cancelAuditEditBtn = document.querySelector("#cancelAuditEditBtn");
const questionEditorForm = document.querySelector("#questionEditorForm");
const cancelQuestionEditBtn = document.querySelector("#cancelQuestionEditBtn");
const questionEditorTitle = document.querySelector("#questionEditorTitle");
const auditModeBadge = document.querySelector("#auditModeBadge");

document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

auditMetaForm.addEventListener("input", handleMetaInput);
questionFileInput.addEventListener("change", handleQuestionImport);
restoreQuestionsBtn.addEventListener("click", restoreDefaultQuestions);
pauseAuditBtn.addEventListener("click", pauseCurrentAudit);
saveDraftBtn.addEventListener("click", () => saveAudit("Em andamento"));
completeAuditBtn.addEventListener("click", () => saveAudit("Concluida"));
cancelAuditEditBtn.addEventListener("click", resetDraftAudit);
questionEditorForm.addEventListener("submit", handleQuestionEditorSubmit);
cancelQuestionEditBtn.addEventListener("click", resetQuestionEditor);

syncMetaForm();
switchTab(state.activeTab);
render();

function render() {
  renderDashboard();
  renderQuestionBankPreview();
  renderQuestionnaire();
  renderReports();
  renderDraftMode();
}

function renderDashboard() {
  const completedAudits = getCompletedAudits();
  const averageScore = average(completedAudits.map((audit) => calculateScore(audit.questions, audit.responses).percent));
  const pausedCount = state.audits.filter((audit) => audit.status === "Pausada").length;
  const activeQuestions = state.questionBank.filter((item) => item.kind === "question").length;
  const nonConformities = state.audits.flatMap(extractNonConformities).length;

  const metrics = [
    { label: "Auditorias totais", value: state.audits.length, footnote: "Historico consolidado da aplicacao" },
    { label: "Perguntas ativas", value: activeQuestions, footnote: "Banco padrao atualmente carregado" },
    { label: "Pausadas", value: pausedCount, footnote: "Podem ser retomadas sem perda de dados" },
    { label: "Nao conformidades", value: nonConformities, footnote: "Desvios registrados no historico" }
  ];

  metricsGrid.innerHTML = metrics.map((metric) => `
    <article class="metric-card">
      <p class="metric-label">${metric.label}</p>
      <p class="metric-value">${metric.value}</p>
      <p class="metric-footnote">${metric.footnote}</p>
    </article>
  `).join("");

  const lastCompleted = [...completedAudits].sort((first, second) => new Date(second.completedAt) - new Date(first.completedAt))[0];
  if (!lastCompleted) {
    lastAuditSpotlight.innerHTML = `<p class="empty-state">Conclua a primeira auditoria para visualizar o grafico principal.</p>`;
  } else {
    const counts = getResponseCounts(lastCompleted.questions, lastCompleted.responses);
    const score = calculateScore(lastCompleted.questions, lastCompleted.responses).percent;
    lastAuditSpotlight.innerHTML = `
      <div class="spotlight-main">
        <div class="spotlight-shell">
          ${renderDonutCard(counts, Math.round(score), "Atingimento")}
          <div class="spotlight-meta">
            <div>
              <p class="section-kicker">Ultima auditoria realizada</p>
              <h3 class="spotlight-title">${lastCompleted.unit}</h3>
              <p>${lastCompleted.area} - ${lastCompleted.auditor}</p>
              <p>${formatDate(lastCompleted.auditDate)}</p>
            </div>
            <div class="spotlight-kpis">
              <article class="spotlight-kpi">
                <p>Conforme</p>
                <strong>${counts.conforme}</strong>
              </article>
              <article class="spotlight-kpi">
                <p>Nao Conforme</p>
                <strong>${counts.naoConforme}</strong>
              </article>
              <article class="spotlight-kpi">
                <p>N/A</p>
                <strong>${counts.na}</strong>
              </article>
            </div>
            <div class="spotlight-note">
              ${score < 70
                ? "Resultado abaixo do esperado e com necessidade de acao imediata."
                : score < 90
                  ? "Resultado em atencao, com oportunidades claras de melhoria."
                  : "Resultado forte, com bom nivel de aderencia aos controles."}
            </div>
          </div>
        </div>
        <div class="spotlight-footer">
          <span class="mini-chip ${scoreClass(score)}">${scoreLabel(score)}</span>
          <span class="spotlight-caption">Resumo visual da auditoria mais recente</span>
        </div>
      </div>
    `;
  }

  recentAudits.innerHTML = completedAudits.length
    ? [...completedAudits]
        .sort((first, second) => new Date(second.completedAt) - new Date(first.completedAt))
        .slice(0, 6)
        .map((audit) => {
          const counts = getResponseCounts(audit.questions, audit.responses);
          const score = calculateScore(audit.questions, audit.responses).percent;
          return `
            <article class="audit-history-card">
              <div class="audit-history-top">
                <div>
                  <p class="audit-history-meta">${audit.unit}</p>
                  <h3 class="audit-history-title">${audit.area}</h3>
                  <p class="audit-history-meta">${audit.auditor} - ${formatDate(audit.auditDate)}</p>
                </div>
                <span class="score-badge ${scoreClass(score)}">${Math.round(score)}%</span>
              </div>
              ${renderDonutCard(counts, Math.round(score), "Resultado")}
              <div class="audit-history-footer">
                <div class="audit-history-actions">
                  <button class="small-btn" type="button" data-edit-audit="${audit.id}">Editar</button>
                  <button class="small-btn" type="button" data-export-audit="${audit.id}">PDF</button>
                </div>
              </div>
            </article>
          `;
        }).join("")
    : `<p class="empty-state">Ainda nao ha auditorias concluidas.</p>`;

  recentAudits.querySelectorAll("[data-edit-audit]").forEach((button) => {
    button.addEventListener("click", () => editAudit(button.dataset.editAudit));
  });
  recentAudits.querySelectorAll("[data-export-audit]").forEach((button) => {
    button.addEventListener("click", () => exportAuditPdf(findAudit(button.dataset.exportAudit)));
  });

  const findings = state.audits
    .flatMap(extractNonConformities)
    .sort((first, second) => new Date(second.auditDate) - new Date(first.auditDate))
    .slice(0, 5);

  latestFindings.innerHTML = findings.length
    ? findings.map((finding) => `
        <article class="finding-item">
          <p class="finding-title">${finding.unit} - ${finding.area}</p>
          <h3 class="finding-headline">${finding.order} - ${finding.question}</h3>
          <p class="finding-meta">${finding.note || "Nao conformidade registrada sem descricao detalhada."}</p>
        </article>
      `).join("")
    : `<p class="empty-state">Nenhuma nao conformidade registrada ate o momento.</p>`;

  const paused = state.audits
    .filter((audit) => audit.status === "Pausada")
    .sort((first, second) => new Date(second.updatedAt || second.createdAt) - new Date(first.updatedAt || first.createdAt));

  pausedAudits.innerHTML = paused.length
    ? paused.map((audit) => `
        <article class="recent-item">
          <p class="list-title">${audit.unit}</p>
          <h3 class="list-headline">${audit.area}</h3>
          <p class="list-meta">${audit.auditor} - ${formatDate(audit.auditDate)}</p>
          <div class="audit-history-actions">
            <button class="small-btn" type="button" data-resume-audit="${audit.id}">Retomar</button>
          </div>
        </article>
      `).join("")
    : `<p class="empty-state">Nenhuma auditoria pausada.</p>`;

  pausedAudits.querySelectorAll("[data-resume-audit]").forEach((button) => {
    button.addEventListener("click", () => editAudit(button.dataset.resumeAudit));
  });
}

function renderQuestionBankPreview() {
  const sorted = sortQuestions(state.questionBank);
  questionBankPreview.innerHTML = sorted.length
    ? sorted.map((question) => `
        <article class="question-preview-item">
          <div class="question-preview-head">
            <div>
              <p><strong>${question.order || "Sem ordem"} - ${question.category}</strong></p>
              <p>${question.text}</p>
            </div>
            <div class="question-preview-actions">
              <button class="small-btn" type="button" data-edit-question="${question.id}">Editar</button>
              <button class="small-btn" type="button" data-delete-question="${question.id}">Excluir</button>
            </div>
          </div>
          <div class="question-preview-meta">
            <span class="mini-chip ${question.kind === "section" ? "warning" : "success"}">${question.kind === "section" ? "Secao" : "Pergunta"}</span>
            <span class="mini-chip">${question.weight} pts</span>
          </div>
        </article>
      `).join("")
    : `<p class="empty-state">Nenhuma pergunta cadastrada.</p>`;

  questionBankPreview.querySelectorAll("[data-edit-question]").forEach((button) => {
    button.addEventListener("click", () => startQuestionEdit(button.dataset.editQuestion));
  });
  questionBankPreview.querySelectorAll("[data-delete-question]").forEach((button) => {
    button.addEventListener("click", () => deleteQuestion(button.dataset.deleteQuestion));
  });
}

function renderQuestionnaire() {
  const template = document.querySelector("#questionCardTemplate");
  questionnaireList.innerHTML = "";

  sortQuestions(state.draftAudit.questionSet).forEach((question) => {
    if (question.kind === "section") {
      const section = document.createElement("article");
      section.className = "question-preview-item";
      section.innerHTML = `
        <p><strong>${question.order || ""} - ${question.category}</strong></p>
        <p>${question.text}</p>
      `;
      questionnaireList.appendChild(section);
      return;
    }

    const node = template.content.cloneNode(true);
    const response = state.draftAudit.responses[question.id] || createEmptyResponse();
    const detail = node.querySelector(".response-detail");
    const note = node.querySelector(".response-note");
    const photoInput = node.querySelector(".response-photo");
    const photoPreviewWrap = node.querySelector(".photo-preview-wrap");
    const photoPreview = node.querySelector(".photo-preview");
    const photoName = node.querySelector(".photo-name");

    node.querySelector(".question-category").textContent = `${question.order || "Sem ordem"} - ${question.category}`;
    node.querySelector(".question-text").textContent = question.text;
    node.querySelector(".weight-chip").textContent = `${question.weight} pts`;

    if (response.status === "Nao Conforme") {
      detail.classList.remove("hidden");
      note.value = response.note || "";
      if (response.photoDataUrl) {
        photoPreviewWrap.classList.remove("hidden");
        photoPreview.src = response.photoDataUrl;
        photoName.textContent = response.photoName || "Foto anexada";
      }
    }

    node.querySelectorAll(".response-btn").forEach((button) => {
      if (button.dataset.status === response.status) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => {
        const nextStatus = button.dataset.status;
        setDraftResponse(question.id, {
          ...state.draftAudit.responses[question.id],
          status: nextStatus,
          note: nextStatus === "Nao Conforme" ? state.draftAudit.responses[question.id]?.note || "" : "",
          photoDataUrl: nextStatus === "Nao Conforme" ? state.draftAudit.responses[question.id]?.photoDataUrl || "" : "",
          photoName: nextStatus === "Nao Conforme" ? state.draftAudit.responses[question.id]?.photoName || "" : ""
        });
      });
    });

    note.addEventListener("input", (event) => {
      setDraftResponse(question.id, {
        ...state.draftAudit.responses[question.id],
        note: event.target.value
      }, false);
    });

    photoInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      setDraftResponse(question.id, {
        ...state.draftAudit.responses[question.id],
        photoDataUrl: dataUrl,
        photoName: file.name
      });
    });

    questionnaireList.appendChild(node);
  });

  const summary = calculateScore(state.draftAudit.questionSet, state.draftAudit.responses);
  const totalQuestions = state.draftAudit.questionSet.filter((item) => item.kind === "question").length;
  draftSummary.innerHTML = `
    <strong>${Math.round(summary.percent)}%</strong>
    <span>${summary.answered}/${totalQuestions} perguntas respondidas</span>
  `;
}

function renderReports() {
  const template = document.querySelector("#reportCardTemplate");
  const audits = [...state.audits].sort((first, second) => new Date(second.updatedAt || second.completedAt || second.createdAt) - new Date(first.updatedAt || first.completedAt || first.createdAt));

  if (!audits.length) {
    reportsList.innerHTML = `<p class="empty-state">Nenhuma auditoria salva.</p>`;
    return;
  }

  reportsList.innerHTML = "";

  audits.forEach((audit) => {
    const node = template.content.cloneNode(true);
    const score = calculateScore(audit.questions, audit.responses).percent;
    const counts = getResponseCounts(audit.questions, audit.responses);

    node.querySelector(".report-unit").textContent = audit.unit;
    node.querySelector(".report-area").textContent = audit.area;
    node.querySelector(".report-meta").textContent = `${audit.auditor} - ${formatDate(audit.auditDate)} - ${audit.status}`;
    node.querySelector(".report-score").innerHTML = `<span class="score-badge ${scoreClass(score)}">${Math.round(score)}%</span>`;
    node.querySelector(".report-donut").innerHTML = renderDonutCard(counts, Math.round(score), "Respostas");

    node.querySelector(".edit-report-btn").addEventListener("click", () => editAudit(audit.id));
    node.querySelector(".resume-report-btn").addEventListener("click", () => editAudit(audit.id));
    node.querySelector(".export-report-btn").addEventListener("click", () => exportAuditPdf(audit));

    if (audit.status !== "Pausada") {
      node.querySelector(".resume-report-btn").classList.add("hidden");
    }

    reportsList.appendChild(node);
  });
}

function renderDraftMode() {
  const isEditing = Boolean(state.editingAuditId);
  auditModeBadge.textContent = isEditing ? "Editando auditoria" : "Nova auditoria";
  cancelAuditEditBtn.classList.toggle("hidden", !isEditing);
  saveDraftBtn.textContent = isEditing ? "Salvar alteracoes" : "Salvar em andamento";
  completeAuditBtn.textContent = isEditing ? "Atualizar auditoria" : "Concluir auditoria";
  pauseAuditBtn.textContent = isEditing ? "Pausar e manter progresso" : "Pausar auditoria";
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tab}Tab`);
  });
  persist();
}

function handleMetaInput(event) {
  const { name, value } = event.target;
  state.draftAudit[name] = value;
  persist();
}

async function handleQuestionImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const extension = file.name.split(".").pop().toLowerCase();
  try {
    const imported = extension === "xlsx"
      ? await parseXlsxQuestionFile(file)
      : parseQuestionFile(await file.text(), extension);

    if (!imported.length) {
      window.alert("Nenhuma pergunta valida foi encontrada no arquivo informado.");
      return;
    }

    replaceQuestionBank(imported);
    switchTab("configuracoes");
  } catch (error) {
    console.error(error);
    window.alert("Nao foi possivel importar o arquivo. Use JSON, CSV, TXT ou XLSX em formato de checklist.");
  } finally {
    questionFileInput.value = "";
  }
}

function handleQuestionEditorSubmit(event) {
  event.preventDefault();
  const formData = new FormData(questionEditorForm);
  const question = createQuestionObject({
    id: state.editingQuestionId || crypto.randomUUID(),
    order: formData.get("order"),
    category: formData.get("category"),
    kind: formData.get("kind"),
    text: formData.get("text"),
    weight: formData.get("weight")
  });

  if (!question.text || !question.category) {
    window.alert("Preencha categoria e texto antes de salvar.");
    return;
  }

  if (state.editingQuestionId) {
    state.questionBank = state.questionBank.map((item) => item.id === state.editingQuestionId ? question : item);
  } else {
    state.questionBank.push(question);
  }

  if (!state.editingAuditId) {
    syncDraftQuestionSetWithBank();
  }

  resetQuestionEditor();
  persist();
  render();
}

function startQuestionEdit(questionId) {
  const question = state.questionBank.find((item) => item.id === questionId);
  if (!question) return;

  state.editingQuestionId = questionId;
  questionEditorTitle.textContent = "Editar pergunta";
  cancelQuestionEditBtn.classList.remove("hidden");
  questionEditorForm.elements.order.value = question.order || "";
  questionEditorForm.elements.category.value = question.category;
  questionEditorForm.elements.kind.value = question.kind;
  questionEditorForm.elements.weight.value = question.weight;
  questionEditorForm.elements.text.value = question.text;
  switchTab("configuracoes");
}

function resetQuestionEditor() {
  state.editingQuestionId = null;
  questionEditorTitle.textContent = "Adicionar pergunta";
  cancelQuestionEditBtn.classList.add("hidden");
  questionEditorForm.reset();
  questionEditorForm.elements.kind.value = "question";
  questionEditorForm.elements.weight.value = 10;
}

function deleteQuestion(questionId) {
  const question = state.questionBank.find((item) => item.id === questionId);
  if (!question) return;
  if (!window.confirm(`Excluir "${question.order || question.category} - ${question.text}"?`)) return;

  state.questionBank = state.questionBank.filter((item) => item.id !== questionId);
  if (!state.editingAuditId) {
    syncDraftQuestionSetWithBank();
  }
  if (state.editingQuestionId === questionId) {
    resetQuestionEditor();
  }
  persist();
  render();
}

function restoreDefaultQuestions() {
  replaceQuestionBank(defaultQuestionBank.map((item) => ({ ...item })));
}

function replaceQuestionBank(questionBank) {
  state.questionBank = normalizeQuestions(questionBank);
  if (!state.editingAuditId) {
    syncDraftQuestionSetWithBank();
  }
  resetQuestionEditor();
  persist();
  render();
}

function syncDraftQuestionSetWithBank() {
  state.draftAudit = createDraftAudit(state.questionBank, state.draftAudit);
  syncMetaForm();
}

function pauseCurrentAudit() {
  saveAudit("Pausada");
}

function saveAudit(status) {
  const missingMeta = ["unit", "area", "auditor", "auditDate", "scope"].filter((field) => !String(state.draftAudit[field] || "").trim());
  if (missingMeta.length) {
    window.alert("Preencha os dados principais da auditoria antes de salvar.");
    return;
  }

  const totalQuestions = state.draftAudit.questionSet.filter((item) => item.kind === "question").length;
  const summary = calculateScore(state.draftAudit.questionSet, state.draftAudit.responses);
  if (status === "Concluida" && summary.answered !== totalQuestions) {
    window.alert("Responda todas as perguntas antes de concluir a auditoria.");
    return;
  }

  const baseAudit = {
    unit: state.draftAudit.unit,
    area: state.draftAudit.area,
    auditor: state.draftAudit.auditor,
    auditDate: state.draftAudit.auditDate,
    scope: state.draftAudit.scope,
    status,
    questions: state.draftAudit.questionSet.map((item) => ({ ...item })),
    responses: structuredClone(state.draftAudit.responses),
    updatedAt: new Date().toISOString()
  };

  if (state.editingAuditId) {
    state.audits = state.audits.map((audit) => {
      if (audit.id !== state.editingAuditId) return audit;
      return {
        ...audit,
        ...baseAudit,
        completedAt: status === "Concluida" ? (audit.completedAt || new Date().toISOString()) : "",
        pausedAt: status === "Pausada" ? new Date().toISOString() : ""
      };
    });
  } else {
    state.audits.unshift({
      id: crypto.randomUUID(),
      ...baseAudit,
      createdAt: new Date().toISOString(),
      completedAt: status === "Concluida" ? new Date().toISOString() : "",
      pausedAt: status === "Pausada" ? new Date().toISOString() : ""
    });
  }

  resetDraftAudit();
  persist();
  render();
  switchTab(status === "Concluida" ? "relatorios" : "dashboard");
}

function editAudit(auditId) {
  const audit = findAudit(auditId);
  if (!audit) return;

  state.editingAuditId = auditId;
  state.draftAudit = {
    id: audit.id,
    unit: audit.unit,
    area: audit.area,
    auditor: audit.auditor,
    auditDate: audit.auditDate,
    scope: audit.scope,
    questionSet: audit.questions.map((item) => ({ ...item })),
    responses: structuredClone(audit.responses)
  };
  syncMetaForm();
  persist();
  render();
  switchTab("auditoria");
}

function resetDraftAudit() {
  state.editingAuditId = "";
  state.draftAudit = createDraftAudit(state.questionBank);
  syncMetaForm();
  persist();
  renderDraftMode();
}

function setDraftResponse(questionId, response, rerender = true) {
  state.draftAudit.responses[questionId] = { ...createEmptyResponse(), ...response };
  persist();
  if (rerender) {
    renderQuestionnaire();
    renderDashboard();
  }
}

function exportAuditPdf(audit) {
  if (!audit) return;
  const win = window.open("", "_blank", "width=1080,height=900");
  if (!win) {
    window.alert("Nao foi possivel abrir a janela de impressao. Verifique se o navegador bloqueou pop-ups.");
    return;
  }

  win.document.open();
  win.document.write(buildPrintableReportHtml(audit));
  win.document.close();
  win.focus();
}

function buildPrintableReportHtml(audit) {
  const score = calculateScore(audit.questions, audit.responses).percent;
  const counts = getResponseCounts(audit.questions, audit.responses);
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatorio - ${escapeHtml(audit.unit)} - ${escapeHtml(audit.area)}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #f6f1ea; color: #1f2b28; }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 28px; }
    .hero { background: linear-gradient(135deg, #0f3a31, #0e7b5b); color: white; border-radius: 26px; padding: 28px; }
    .hero h1 { margin: 8px 0 10px; font-size: 40px; line-height: 0.95; }
    .eyebrow { text-transform: uppercase; letter-spacing: .16em; font-size: 12px; opacity: .75; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }
    .meta-card, .summary, .question { background: rgba(255,255,255,.92); border-radius: 20px; padding: 18px; box-shadow: 0 12px 28px rgba(22, 34, 30, .08); }
    .meta-card p, .question p { margin: 0; }
    .summary { margin-top: 18px; }
    .summary-grid { display: grid; grid-template-columns: 220px 1fr; gap: 18px; align-items: center; }
    .donut { width: 200px; height: 200px; border-radius: 50%; background: conic-gradient(#1d8e62 0 ${counts.p1}%, #ce4a42 ${counts.p1}% ${counts.p2}%, #dcae3d ${counts.p2}% 100%); position: relative; margin: 0 auto; }
    .donut:after { content: ''; position: absolute; inset: 26px; border-radius: 50%; background: white; }
    .donut-center { position: absolute; inset: 0; display: grid; place-items: center; z-index: 1; text-align: center; }
    .donut-center strong { display: block; font-size: 32px; }
    .legend { display: grid; gap: 10px; }
    .legend-line { display: flex; justify-content: space-between; background: #f5f7f6; border-radius: 14px; padding: 10px 12px; }
    .section { margin: 24px 0 10px; font-size: 19px; font-weight: 800; color: #0b6045; }
    .question { margin-bottom: 14px; page-break-inside: avoid; border-left: 6px solid #e7efe9; }
    .question.status-conforme { border-left-color: #1d8e62; }
    .question.status-nao-conforme { border-left-color: #ce4a42; background: #fff8f7; }
    .question.status-na { border-left-color: #dcae3d; background: #fffdf5; }
    .status-pill { display: inline-block; margin-top: 8px; padding: 8px 12px; border-radius: 999px; font-weight: 800; color: white; background: #0d7a5a; }
    .status-pill.nao { background: #ce4a42; }
    .status-pill.na { background: #dcae3d; color: #5d4508; }
    img { max-width: 340px; display: block; margin-top: 10px; border-radius: 12px; }
    .print-bar { padding: 18px 28px 0; }
    .print-bar button { border: 0; background: #0d7a5a; color: white; border-radius: 999px; padding: 11px 16px; font-weight: 800; cursor: pointer; }
    @media print {
      .print-bar { display: none; }
      body { background: white; }
      .wrap { padding: 0; max-width: none; }
      .hero, .meta-card, .summary, .question { box-shadow: none; }
    }
    @media (max-width: 760px) {
      .wrap { padding: 16px; }
      .meta-grid, .summary-grid { grid-template-columns: 1fr; }
      .hero h1 { font-size: 30px; }
      .donut { width: 170px; height: 170px; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button onclick="window.print()">Salvar como PDF</button>
  </div>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">Grupo Mega</div>
      <h1>Auditoria Interna</h1>
      <p>Relatorio executivo de avaliacao com enfase visual em conformidade, desvios e evidencias.</p>
    </section>

    <section class="meta-grid">
      <article class="meta-card"><p><strong>Unidade</strong></p><p>${escapeHtml(audit.unit)}</p></article>
      <article class="meta-card"><p><strong>Area</strong></p><p>${escapeHtml(audit.area)}</p></article>
      <article class="meta-card"><p><strong>Auditor</strong></p><p>${escapeHtml(audit.auditor)}</p></article>
      <article class="meta-card"><p><strong>Data</strong></p><p>${escapeHtml(formatDate(audit.auditDate))}</p></article>
      <article class="meta-card" style="grid-column: 1 / -1;"><p><strong>Escopo</strong></p><p>${escapeHtml(audit.scope)}</p></article>
    </section>

    <section class="summary">
      <div class="summary-grid">
        <div style="position: relative;">
          <div class="donut">
            <div class="donut-center">
              <div><strong>${Math.round(score)}%</strong><span>${escapeHtml(scoreLabel(score))}</span></div>
            </div>
          </div>
        </div>
        <div class="legend">
          <div class="legend-line"><span>Conformidades</span><strong>${counts.conforme}</strong></div>
          <div class="legend-line"><span>Nao conformidades</span><strong>${counts.naoConforme}</strong></div>
          <div class="legend-line"><span>N/A</span><strong>${counts.na}</strong></div>
          <div class="legend-line"><span>Total respondido</span><strong>${counts.total}</strong></div>
        </div>
      </div>
    </section>

    ${sortQuestions(audit.questions).map((item) => {
      if (item.kind === "section") {
        return `<div class="section">${escapeHtml(item.order || "")} - ${escapeHtml(item.text)}</div>`;
      }
      const response = audit.responses[item.id] || createEmptyResponse();
      const statusClass = response.status === "Conforme" ? "status-conforme" : response.status === "Nao Conforme" ? "status-nao-conforme" : "status-na";
      const pillClass = response.status === "Nao Conforme" ? "status-pill nao" : response.status === "N/A" ? "status-pill na" : "status-pill";
      return `
        <article class="question ${statusClass}">
          <p><strong>${escapeHtml(item.order || "")} - ${escapeHtml(item.category)}</strong></p>
          <p style="margin-top: 8px;">${escapeHtml(item.text)}</p>
          <span class="${pillClass}">${escapeHtml(response.status || "Nao respondida")}</span>
          ${response.note ? `<p style="margin-top: 12px;"><strong>Descricao:</strong> ${escapeHtml(response.note)}</p>` : ""}
          ${response.photoDataUrl ? `<img src="${response.photoDataUrl}" alt="Foto da nao conformidade">` : ""}
        </article>
      `;
    }).join("")}
  </div>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;
}

function renderDonutCard(counts, value, label) {
  return `
    <div class="donut-card">
      <div class="donut-wrap">
        <div class="donut-ring" style="--p1:${counts.p1}%; --p2:${counts.p2}%"></div>
        <div class="donut-center">
          <div><strong>${value}%</strong><span>${label}</span></div>
        </div>
      </div>
      <div class="donut-legend">
        ${renderLegendLine("Conforme", counts.conforme, "conforme")}
        ${renderLegendLine("Nao Conforme", counts.naoConforme, "naoconforme")}
        ${renderLegendLine("N/A", counts.na, "na")}
      </div>
    </div>
  `;
}

function renderLegendLine(label, value, tone) {
  return `<p class="legend-line"><strong><span class="legend-dot ${tone}"></span>${label}</strong><span>${value}</span></p>`;
}

function getResponseCounts(questions, responses) {
  let conforme = 0;
  let naoConforme = 0;
  let na = 0;

  questions.filter((item) => item.kind === "question").forEach((question) => {
    const status = responses[question.id]?.status;
    if (status === "Conforme") conforme += 1;
    if (status === "Nao Conforme") naoConforme += 1;
    if (status === "N/A") na += 1;
  });

  const total = conforme + naoConforme + na || 1;
  const p1 = Math.round((conforme / total) * 100);
  const p2 = Math.round(((conforme + naoConforme) / total) * 100);
  return { conforme, naoConforme, na, total: conforme + naoConforme + na, p1, p2 };
}

function calculateScore(questions, responses) {
  let eligibleWeight = 0;
  let conformWeight = 0;
  let answered = 0;

  questions.filter((item) => item.kind === "question").forEach((question) => {
    const response = responses[question.id];
    if (!response?.status) return;
    answered += 1;
    if (response.status === "N/A") return;
    eligibleWeight += question.weight;
    if (response.status === "Conforme") conformWeight += question.weight;
  });

  return {
    eligibleWeight,
    conformWeight,
    answered,
    percent: eligibleWeight ? (conformWeight / eligibleWeight) * 100 : 0
  };
}

function extractNonConformities(audit) {
  return audit.questions
    .filter((item) => item.kind === "question" && audit.responses[item.id]?.status === "Nao Conforme")
    .map((item) => ({
      unit: audit.unit,
      area: audit.area,
      auditDate: audit.auditDate,
      order: item.order,
      question: item.text,
      note: audit.responses[item.id]?.note || ""
    }));
}

function findAudit(auditId) {
  return state.audits.find((item) => item.id === auditId);
}

function getCompletedAudits() {
  return state.audits.filter((audit) => audit.status === "Concluida");
}

function parseQuestionFile(content, extension) {
  if (extension === "json") return normalizeQuestions(JSON.parse(content));

  if (extension === "csv") {
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const delimiter = lines[0]?.includes(";") ? ";" : ",";
    const headers = lines[0].split(delimiter).map((value) => sanitizeHeader(value));
    const hasHeader = headers.some((header) => ["categoria", "pergunta", "texto", "peso", "ordem", "tipo"].includes(header));
    const rows = hasHeader ? lines.slice(1) : lines;
    return normalizeQuestions(rows.map((line, index) => {
      const cells = line.split(delimiter).map((value) => value.trim());
      if (!hasHeader) {
        return { id: `csv-${index + 1}`, order: `${index + 1}`, category: "Geral", kind: "question", text: cells[0], weight: cells[1] || 10 };
      }
      return {
        id: `csv-${index + 1}`,
        order: cells[headers.indexOf("ordem")] || `${index + 1}`,
        category: cells[headers.indexOf("categoria")] || "Geral",
        kind: cells[headers.indexOf("tipo")] || "",
        text: cells[headers.indexOf("pergunta")] || cells[headers.indexOf("texto")] || cells[0],
        weight: cells[headers.indexOf("peso")] || 10
      };
    }));
  }

  if (extension === "txt") {
    return normalizeQuestions(content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const parts = line.split("|").map((part) => part.trim());
        return {
          id: `txt-${index + 1}`,
          order: parts[0] || `${index + 1}`,
          category: parts[1] || "Geral",
          kind: parts[2] || "question",
          text: parts[3] || parts[0],
          weight: parts[4] || 10
        };
      }));
  }

  throw new Error("Formato nao suportado");
}

async function parseXlsxQuestionFile(file) {
  const entries = await unzipEntries(await file.arrayBuffer());
  const workbookXml = entries.get("xl/workbook.xml");
  const workbookRelsXml = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !workbookRelsXml) throw new Error("Estrutura XLSX invalida");

  const workbookDoc = new DOMParser().parseFromString(workbookXml, "application/xml");
  const relsDoc = new DOMParser().parseFromString(workbookRelsXml, "application/xml");
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"));
  const relMap = new Map();
  [...relsDoc.getElementsByTagName("Relationship")].forEach((rel) => {
    relMap.set(rel.getAttribute("Id"), normalizeZipPath(`xl/${rel.getAttribute("Target")}`));
  });

  const imported = [];
  let index = 0;
  [...workbookDoc.getElementsByTagName("sheet")].forEach((sheet) => {
    const sheetName = sheet.getAttribute("name") || "Geral";
    if (sheetName.toLowerCase() === "geral") return;
    const relId = sheet.getAttribute("r:id") || sheet.getAttribute("id");
    const sheetPath = relMap.get(relId);
    if (!sheetPath || !entries.has(sheetPath)) return;

    parseWorksheetRows(entries.get(sheetPath), sharedStrings).forEach((row) => {
      const order = String(row[0] || "").trim();
      const text = String(row[1] || "").trim();
      if (order.match(/^\d+(\.\d+)+$/) && text) {
        index += 1;
        imported.push({
          id: `xlsx-${index}`,
          order,
          category: sheetName,
          text,
          weight: 10,
          kind: inferKind("", order)
        });
      }
    });
  });

  return normalizeQuestions(imported);
}

function parseSharedStrings(xmlText) {
  if (!xmlText) return [];
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  return [...doc.getElementsByTagName("si")].map((item) =>
    [...item.getElementsByTagName("t")].map((node) => node.textContent || "").join("")
  );
}

function parseWorksheetRows(xmlText, sharedStrings) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  return [...doc.getElementsByTagName("row")].map((rowNode) => {
    const row = [];
    [...rowNode.getElementsByTagName("c")].forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const columnIndex = columnRefToIndex(ref.replace(/\d+/g, ""));
      row[columnIndex] = readCellValue(cell, sharedStrings);
    });
    return row;
  });
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") {
    return [...cell.getElementsByTagName("t")].map((node) => node.textContent || "").join("");
  }
  const raw = cell.getElementsByTagName("v")[0]?.textContent || "";
  if (type === "s") return sharedStrings[Number(raw)] || "";
  return raw;
}

async function unzipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error("Arquivo ZIP/XLSX invalido");

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();
  let pointer = centralDirOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const compression = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const fileNameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localHeaderOffset = view.getUint32(pointer + 42, true);
    const fileName = decodeBytes(bytes.slice(pointer + 46, pointer + 46 + fileNameLength));
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const content = await extractZipEntry(compression, compressed);
    entries.set(normalizeZipPath(fileName), decodeBytes(content));
    pointer += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(bytes) {
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) {
      return index;
    }
  }
  return -1;
}

async function extractZipEntry(compression, data) {
  if (compression === 0) return data;
  if (compression === 8) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  }
  throw new Error(`Metodo de compressao nao suportado: ${compression}`);
}

function decodeBytes(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function normalizeZipPath(path) {
  const parts = [];
  path.replaceAll("\\", "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return parts.join("/");
}

function columnRefToIndex(ref) {
  let result = 0;
  const normalized = String(ref || "").toUpperCase();
  for (let index = 0; index < normalized.length; index += 1) {
    result = result * 26 + (normalized.charCodeAt(index) - 64);
  }
  return Math.max(0, result - 1);
}

function hydrateDraftAudit(savedDraft, questionBank) {
  if (!savedDraft) return createDraftAudit(questionBank);
  return createDraftAudit(savedDraft.questionSet?.length ? savedDraft.questionSet : questionBank, savedDraft);
}

function normalizeQuestions(items) {
  return items.map((item, index) => {
    if (typeof item === "string") {
      return createQuestionObject({ id: `q-${index + 1}`, order: `${index + 1}`, category: "Geral", kind: "question", text: item, weight: 10 });
    }
    return createQuestionObject({
      id: item.id || `q-${index + 1}`,
      order: item.order || `${index + 1}`,
      category: item.category || item.categoria || "Geral",
      kind: item.kind || item.tipo || "",
      text: item.text || item.pergunta || item.question || "",
      weight: item.weight || item.peso || 10
    });
  }).filter((item) => item.text);
}

function createQuestionObject(input) {
  const order = String(input.order || "").trim();
  return {
    id: String(input.id || crypto.randomUUID()),
    order,
    category: String(input.category || "Geral").trim(),
    kind: inferKind(String(input.kind || "").trim(), order),
    text: String(input.text || "").trim(),
    weight: Number(input.weight) || 10
  };
}

function inferKind(kind, order) {
  if (kind === "section" || kind === "question") return kind;
  return order.split(".").filter(Boolean).length >= 3 ? "question" : "section";
}

function createDraftAudit(questionSet, previous = {}) {
  const normalizedSet = normalizeQuestions(questionSet);
  const draft = {
    id: previous.id || "",
    unit: previous.unit || "",
    area: previous.area || "",
    auditor: previous.auditor || "",
    auditDate: previous.auditDate || new Date().toISOString().slice(0, 10),
    scope: previous.scope || "",
    questionSet: normalizedSet.map((item) => ({ ...item })),
    responses: {}
  };

  normalizedSet.filter((item) => item.kind === "question").forEach((question) => {
    draft.responses[question.id] = previous.responses?.[question.id]
      ? { ...createEmptyResponse(), ...previous.responses[question.id] }
      : createEmptyResponse();
  });

  return draft;
}

function createEmptyResponse() {
  return { status: "", note: "", photoName: "", photoDataUrl: "" };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {
      questionBank: defaultQuestionBank.map((item) => ({ ...item })),
      audits: buildSampleAudits(defaultQuestionBank),
      draftAudit: createDraftAudit(defaultQuestionBank),
      editingAuditId: "",
      activeTab: "dashboard"
    };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      questionBank: normalizeQuestions(parsed.questionBank?.length ? parsed.questionBank : defaultQuestionBank),
      audits: Array.isArray(parsed.audits) ? parsed.audits : buildSampleAudits(defaultQuestionBank),
      draftAudit: parsed.draftAudit || createDraftAudit(defaultQuestionBank),
      editingAuditId: parsed.editingAuditId || "",
      activeTab: parsed.activeTab || "dashboard"
    };
  } catch (error) {
    console.error("Falha ao carregar dados salvos", error);
    return {
      questionBank: defaultQuestionBank.map((item) => ({ ...item })),
      audits: buildSampleAudits(defaultQuestionBank),
      draftAudit: createDraftAudit(defaultQuestionBank),
      editingAuditId: "",
      activeTab: "dashboard"
    };
  }
}

function buildSampleAudits(questionBank) {
  const questionSet = normalizeQuestions(questionBank);
  const lojaQuestions = questionSet.filter((item) => item.category === "Gerenciamento Loja" || item.category === "Gerenciamento Setores" || item.kind === "section");
  const caixaQuestions = questionSet.filter((item) => item.category === "Frente de Caixa" || item.category === "Recebimento" || item.kind === "section");
  return [
    buildSeedAudit("seed-1", "Mega Thorra - Loja Centro", "Gerenciamento Loja", "Humberto Gomes", "2026-03-25", "Revisao operacional da loja com foco em imagem, precificacao e seguranca.", lojaQuestions, 6),
    buildSeedAudit("seed-2", "Mega Thorra - Loja Norte", "Frente de Caixa", "Ana Ribeiro", "2026-03-18", "Avaliacao do atendimento, rotinas de caixa e registros operacionais.", caixaQuestions, 4)
  ];
}

function buildSeedAudit(id, unit, area, auditor, auditDate, scope, questionSet, incidentStride) {
  const responses = {};
  questionSet.filter((item) => item.kind === "question").forEach((question, index) => {
    if (index % incidentStride === 0) {
      responses[question.id] = { status: "Nao Conforme", note: "Desvio identificado durante a auditoria presencial.", photoName: "", photoDataUrl: "" };
    } else if (index % 7 === 0) {
      responses[question.id] = { status: "N/A", note: "", photoName: "", photoDataUrl: "" };
    } else {
      responses[question.id] = { status: "Conforme", note: "", photoName: "", photoDataUrl: "" };
    }
  });

  return {
    id,
    unit,
    area,
    auditor,
    auditDate,
    scope,
    status: "Concluida",
    questions: questionSet.map((item) => ({ ...item })),
    responses,
    createdAt: `${auditDate}T10:00:00`,
    updatedAt: `${auditDate}T16:00:00`,
    completedAt: `${auditDate}T16:00:00`,
    pausedAt: ""
  };
}

function sortQuestions(items) {
  return [...items].sort((first, second) => compareOrder(first.order, second.order));
}

function compareOrder(first, second) {
  const left = String(first || "").split(".").map((part) => Number(part) || 0);
  const right = String(second || "").split(".").map((part) => Number(part) || 0);
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function sanitizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function syncMetaForm() {
  auditMetaForm.elements.unit.value = state.draftAudit.unit;
  auditMetaForm.elements.area.value = state.draftAudit.area;
  auditMetaForm.elements.auditor.value = state.draftAudit.auditor;
  auditMetaForm.elements.auditDate.value = state.draftAudit.auditDate;
  auditMetaForm.elements.scope.value = state.draftAudit.scope;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    questionBank: state.questionBank,
    audits: state.audits,
    draftAudit: state.draftAudit,
    editingAuditId: state.editingAuditId,
    activeTab: state.activeTab
  }));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function scoreClass(percent) {
  if (percent < 70) return "danger";
  if (percent < 90) return "warning";
  return "success";
}

function scoreLabel(percent) {
  if (percent < 70) return "Abaixo do esperado";
  if (percent < 90) return "Atencao";
  return "Excelente";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
