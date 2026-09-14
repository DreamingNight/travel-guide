function initializeReader() {
  const body = document.body;
  const tabs = [...document.querySelectorAll("[data-trip-tab]")];
  const dayDetails = [...document.querySelectorAll("[data-day-detail]")];
  const expandButton = document.querySelector("[data-expand-days]");
  const searchDialog = document.querySelector(".search-dialog");
  const searchInput = document.querySelector("#guide-search");
  const searchResults = document.querySelector("[data-search-results]");
  const searchStatus = document.querySelector("[data-search-status]");
  const sidebar = document.querySelector(".sidebar");
  const menuButton = document.querySelector(".menu-button");
  const checklistKey = "ali-prep-2026-09-14-v1";
  let searchOpener = null;
  let printingState = [];

  function selectTab(tab, focus = false) {
    if (!tab) return;
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(candidate.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus({ preventScroll: true });
    const rail = tab.parentElement;
    if (rail.scrollWidth > rail.clientWidth) {
      rail.scrollTo({ left: Math.max(0, tab.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + tab.clientWidth / 2), behavior: "instant" });
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  });

  document.querySelectorAll("[data-story-day]").forEach((link) => {
    link.addEventListener("click", () => selectTab(tabs.find((tab) => tab.dataset.tripTab === link.dataset.storyDay)));
  });

  function revealTarget(target) {
    if (!target) return;
    let ancestor = target.parentElement;
    while (ancestor) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    const day = target.closest("[data-day]");
    if (day) {
      const detail = day.querySelector("[data-day-detail]");
      if (detail) detail.open = true;
      selectTab(tabs.find((tab) => tab.dataset.tripTab === day.dataset.day));
    }
  }

  function targetFromHash(hash) {
    try { return document.getElementById(decodeURIComponent(hash.replace(/^#/, ""))); }
    catch { return null; }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    revealTarget(targetFromHash(link.hash));
    closeToc();
  });
  window.addEventListener("hashchange", () => revealTarget(targetFromHash(location.hash)));
  revealTarget(targetFromHash(location.hash));

  function updateExpandButton() {
    if (!expandButton) return;
    const allOpen = dayDetails.length > 0 && dayDetails.every((detail) => detail.open);
    expandButton.textContent = allOpen ? "收起日程详情" : "展开全部日程";
    expandButton.setAttribute("aria-pressed", String(allOpen));
  }
  expandButton?.addEventListener("click", () => {
    const open = !dayDetails.every((detail) => detail.open);
    dayDetails.forEach((detail) => { detail.open = open; });
    updateExpandButton();
  });
  dayDetails.forEach((detail) => detail.addEventListener("toggle", updateExpandButton));

  const sizeButton = document.querySelector("[data-reading-size]");
  sizeButton?.addEventListener("click", () => {
    const large = body.classList.toggle("reader-large");
    sizeButton.setAttribute("aria-pressed", String(large));
    sizeButton.textContent = large ? "标准字号" : "大字号";
  });

  function closeToc(restoreFocus = false) {
    if (!sidebar?.classList.contains("open")) return;
    sidebar.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
    if (restoreFocus) menuButton?.focus();
  }
  document.querySelector("[data-close-toc]")?.addEventListener("click", () => closeToc(true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeToc(true);
  });
  document.addEventListener("pointerdown", (event) => {
    if (sidebar?.classList.contains("open") && !sidebar.contains(event.target) && !menuButton?.contains(event.target)) closeToc();
  });

  const headings = [...document.querySelectorAll("main h2[id], main h3[id]")];
  const index = headings.map((heading) => {
    const day = heading.closest("[data-day]");
    let content = day?.textContent || heading.textContent;
    if (!day) {
      let sibling = heading.nextElementSibling;
      while (sibling && !/^H[23]$/.test(sibling.tagName)) {
        content += " " + sibling.textContent;
        sibling = sibling.nextElementSibling;
      }
    }
    return { id: heading.id, title: heading.textContent.trim(), content: content.replace(/\s+/g, " ").trim() };
  });

  function renderSearch() {
    if (!searchInput || !searchResults || !searchStatus) return;
    const query = searchInput.value.trim().toLocaleLowerCase();
    searchResults.replaceChildren();
    if (!query) {
      searchStatus.textContent = "输入关键词，定位到相关章节。";
      return;
    }
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = index.filter((item) => terms.every((term) => item.content.toLocaleLowerCase().includes(term)));
    matches.sort((first, second) => Number(second.title.toLocaleLowerCase().includes(query)) - Number(first.title.toLocaleLowerCase().includes(query)));
    searchStatus.textContent = matches.length ? `找到 ${matches.length} 个相关章节${matches.length > 18 ? "，显示前18项" : ""}` : "没有找到相关内容，试试景点名、D3或保险。";
    matches.slice(0, 18).forEach((item) => {
      const link = document.createElement("a");
      link.className = "search-result";
      link.href = `#${encodeURIComponent(item.id)}`;
      const title = document.createElement("strong");
      title.textContent = item.title;
      const excerpt = document.createElement("span");
      const offset = Math.max(0, item.content.toLocaleLowerCase().indexOf(terms[0]) - 24);
      excerpt.textContent = `${offset ? "…" : ""}${item.content.slice(offset, offset + 100)}${item.content.length > offset + 100 ? "…" : ""}`;
      link.append(title, excerpt);
      link.addEventListener("click", () => {
        searchDialog.close();
        const target = document.getElementById(item.id);
        revealTarget(target);
        target?.setAttribute("tabindex", "-1");
        target?.focus({ preventScroll: true });
      });
      searchResults.append(link);
    });
  }

  function openSearch(opener) {
    if (!searchDialog || searchDialog.open) return;
    searchOpener = opener || document.activeElement;
    closeToc();
    searchDialog.showModal();
    searchInput.focus();
    renderSearch();
  }
  function closeSearch() {
    searchDialog?.close();
    searchOpener?.focus();
  }
  document.querySelectorAll("[data-search-open]").forEach((button) => button.addEventListener("click", () => openSearch(button)));
  document.querySelector("[data-search-close]")?.addEventListener("click", closeSearch);
  searchDialog?.addEventListener("click", (event) => { if (event.target === searchDialog) closeSearch(); });
  searchDialog?.addEventListener("cancel", () => searchOpener?.focus());
  searchInput?.addEventListener("input", renderSearch);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchDialog?.open) {
      event.preventDefault();
      closeSearch();
      return;
    }
    const editing = event.target.closest("input, textarea, select, [contenteditable=true]");
    if (event.key === "/" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      openSearch();
    }
  });

  const checkboxes = [...document.querySelectorAll("[data-prep-check]")];
  const storageStatus = document.querySelector("[data-storage-status]");
  function updateChecklist(save = false) {
    const count = checkboxes.filter((checkbox) => checkbox.checked).length;
    const output = document.querySelector("[data-prep-count]");
    if (output) output.textContent = `${count} / ${checkboxes.length}`;
    if (save) {
      try {
        localStorage.setItem(checklistKey, JSON.stringify(checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.dataset.prepCheck)));
        if (storageStatus) storageStatus.textContent = "已保存在此浏览器。";
      } catch {
        if (storageStatus) storageStatus.textContent = "浏览器未允许本地保存；本次勾选仅在当前页面有效。";
      }
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(checklistKey) || "[]");
    if (Array.isArray(saved)) checkboxes.forEach((checkbox) => { checkbox.checked = saved.includes(checkbox.dataset.prepCheck); });
  } catch {
    if (storageStatus) storageStatus.textContent = "无法读取本地记录；请重新核对，不默认已完成。";
  }
  checkboxes.forEach((checkbox) => checkbox.addEventListener("change", () => updateChecklist(true)));
  document.querySelector("[data-reset-prep]")?.addEventListener("click", () => {
    checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    updateChecklist(true);
  });
  updateChecklist();

  window.addEventListener("beforeprint", () => {
    printingState = [...document.querySelectorAll("main details")].map((detail) => ({ detail, open: detail.open }));
    printingState.forEach(({ detail }) => { detail.open = true; });
  });
  window.addEventListener("afterprint", () => {
    printingState.forEach(({ detail, open }) => { detail.open = open; });
    printingState = [];
  });
}

if (typeof document !== "undefined") initializeReader();
