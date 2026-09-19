function initializeTravelNotes() {
  const form = document.querySelector("[data-travel-journal]");
  if (!form) return;
  const selector = form.querySelector("[data-journal-day]");
  const fields = [...form.querySelectorAll("[data-journal-field]")];
  const status = form.querySelector("[data-journal-status]");
  const options = [...selector.options];
  const drafts = new Map();
  const prefix = "ali-travel-journal-2026-v1-";
  let readFailed = false;
  let selectedDay = selector.value;

  options.forEach((option) => {
    const draft = {};
    try {
      const saved = JSON.parse(localStorage.getItem(prefix + option.value) || "{}");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Invalid draft");
      fields.forEach((field) => {
        const value = saved[field.dataset.journalField];
        draft[field.dataset.journalField] = typeof value === "string" ? value.slice(0, 8000) : "";
      });
    } catch {
      readFailed = true;
    }
    drafts.set(option.value, draft);
  });

  function loadDay(day) {
    selectedDay = day;
    selector.value = day;
    const draft = drafts.get(day) || {};
    fields.forEach((field) => { field.value = draft[field.dataset.journalField] || ""; });
  }

  function saveDay() {
    const draft = Object.fromEntries(fields.map((field) => [field.dataset.journalField, field.value]));
    drafts.set(selectedDay, draft);
    try {
      localStorage.setItem(prefix + selectedDay, JSON.stringify(draft));
      status.textContent = "已保存在此浏览器。建议随时导出备份。";
    } catch {
      status.textContent = "未能保存到浏览器；本页暂存仍在，请离开前导出备份。";
    }
  }

  form.querySelector("fieldset").disabled = false;
  loadDay(selectedDay);
  status.textContent = readFailed ? "部分旧记录未能读取；本页可继续填写，请及时导出。" : "还没发生的经历，先留白。";
  fields.forEach((field) => field.addEventListener("input", saveDay));
  selector.addEventListener("change", () => {
    loadDay(selector.value);
    status.textContent = "已切换日期；只显示这一天的手记。";
  });
  document.querySelectorAll("[data-note-day]").forEach((link) => {
    link.addEventListener("click", () => {
      if (!drafts.has(link.dataset.noteDay)) return;
      loadDay(link.dataset.noteDay);
      fields[0].focus({ preventScroll: true });
    });
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  form.querySelector("[data-export-journal]").addEventListener("click", () => {
    const recorded = options.filter((option) => Object.values(drafts.get(option.value)).some((value) => value.trim()));
    if (!recorded.length) {
      status.textContent = "还没有填写手记，写下一句就可以导出；不生成虚构经历。";
      return;
    }
    const lines = ["---", 'title: "阿里旅行手记"', "type: journal", "status: draft", "ai-assisted: true", "tags: [旅行, 阿里]", "---", "", "# 阿里旅行手记", "", "> AI 辅助生成问题提示与导出结构；以下经历仅来自使用者填写，未经AI补写。", "", "关联：[[主题/旅行|旅行]]", ""];
    recorded.forEach((option) => {
      lines.push(`## ${option.dataset.date} · ${option.textContent}`, "");
      fields.forEach((field) => {
        const value = drafts.get(option.value)[field.dataset.journalField];
        if (value?.trim()) lines.push(`### ${field.dataset.exportTitle}`, "", value.trim(), "");
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = url;
    download.download = "阿里旅行手记-2026-09.md";
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.textContent = "已发起Markdown下载；可自行放入Obsidian的日志目录，未写入或同步任何笔记库。";
  });
}

if (typeof document !== "undefined") initializeTravelNotes();
