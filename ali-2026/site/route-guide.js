function initializeRouteGuide() {
  const body = document.body;
  const planButtons = [...document.querySelectorAll("[data-plan-choice]")];
  const menuButton = document.querySelector(".menu-button");
  const sidebar = document.querySelector(".sidebar");
  const printButton = document.querySelector(".print-button");
  const progress = document.querySelector(".reading-progress span");
  const backTop = document.querySelector(".back-top");
  const lightbox = document.querySelector(".lightbox");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("p");
  const PUBLIC_LAYERS = new Set([
    "route-a", "route-b", "route-common", "lodging",
    "sights-core", "sights-secondary", "passes",
    "places", "culture", "water-landforms", "context-landmarks", "alternatives",
  ]);
  const ACTION_LABELS = {
    core: "主线核心",
    along_route: "沿途可看",
    conditional: "条件成立才去",
    context: "空间背景",
    alternative: "未入选候选",
  };
  const KIND_LABELS = {
    attraction: "景点", candidate: "候选点", lake: "湖泊", landmark: "地标",
    pass: "垭口", viewpoint: "观景点", place: "城镇", mountain: "雪山",
    river: "河流", monastery: "寺院", ruin: "遗址", scenic_corridor: "景观走廊",
  };
  const STATUS_LABELS = {
    documented: "已纳入路书", candidate: "条件候选", decision: "未入选决策",
  };
  const routeMaps = [];

  function initRouteMap(root, index) {
    const svg = root.querySelector(".route-map-stage > svg");
    const viewport = root.querySelector("[data-map-viewport]");
    const controls = root.querySelector("[data-map-controls]");
    const detail = root.querySelector("[data-map-detail]");
    const detailTitle = root.querySelector("[data-map-detail-title]");
    const detailMeta = root.querySelector("[data-map-detail-meta]");
    const detailSummary = root.querySelector("[data-map-detail-summary]");
    const detailLogistics = root.querySelector("[data-map-detail-logistics]");
    const detailDecision = root.querySelector("[data-map-detail-decision]");
    const zoomStatus = root.querySelector("[data-map-zoom-status]");
    const layerButtons = [...root.querySelectorAll("[data-map-layer-toggle]")];
    const pointFilterButtons = [...root.querySelectorAll("[data-map-point-filter]")];
    const actionButtons = [...root.querySelectorAll("[data-map-action]")];
    if (!svg || !viewport || !controls || !detail || !detailTitle || !detailMeta || !detailSummary || !detailLogistics || !detailDecision) return null;

    const original = svg.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
    if (!original || original.length !== 4 || original.some((value) => !Number.isFinite(value)) || original[2] <= 0 || original[3] <= 0) return null;
    const [originX, originY, originWidth, originHeight] = original;
    const layerGroups = new Map();
    PUBLIC_LAYERS.forEach((key) => layerGroups.set(key, [...svg.querySelectorAll(`[data-layer="${key}"]`)]));
    if ([...PUBLIC_LAYERS].some((key) => layerGroups.get(key).length === 0)) return null;

    const points = [...svg.querySelectorAll("[data-point-id]")];
    const lodgings = [...svg.querySelectorAll("[data-lodging-id]")];
    const enabledLayers = new Map([...PUBLIC_LAYERS].map((key) => [key, true]));
    const enabledPointFilters = new Map(
      pointFilterButtons.map((button) => [button.dataset.mapPointFilter, true]),
    );
    const connectorsByPoint = new Map();
    svg.querySelectorAll("[data-decision-connector-for]").forEach((connector) => {
      const pointId = connector.dataset.decisionConnectorFor;
      const connectors = connectorsByPoint.get(pointId) || [];
      connectors.push(connector);
      connectorsByPoint.set(pointId, connectors);
    });
    const detailId = `route-map-detail-${index + 1}`;
    detail.id = detailId;
    let routeMode = "all";
    let selectedPoint = null;
    let drag = null;
    let suppressClickUntil = 0;
    let printViewBox = null;

    function routeScopeVisible(point) {
      const scope = point.dataset.routeScope || "AB";
      return routeMode === "all" || scope === "AB" || scope === routeMode;
    }

    function pointMatchesFilter(point, button) {
      const kinds = (button.dataset.filterKinds || "").split(/\s+/).filter(Boolean);
      const actions = (button.dataset.filterActions || "").split(/\s+/).filter(Boolean);
      const statuses = (button.dataset.filterStatuses || "").split(/\s+/).filter(Boolean);
      return kinds.includes(point.dataset.kind)
        || actions.includes(point.dataset.action)
        || statuses.includes(point.dataset.status);
    }

    function clearSelection() {
      points.forEach((point) => point.setAttribute("aria-pressed", "false"));
      selectedPoint = null;
      detailTitle.textContent = "选择地图地点查看详情";
      detailMeta.textContent = "可点击地图中的景观点，查看海拔与所属日程。";
      detailSummary.textContent = "";
      detailLogistics.textContent = "";
      detailLogistics.hidden = true;
      detailDecision.textContent = "";
      detailDecision.hidden = true;
    }

    function updatePointTabStops() {
      const [, , viewWidth] = currentViewBox();
      const zoom = originWidth / viewWidth;
      svg.classList.toggle("semantic-zoom-rank-2", zoom >= 1.5 && zoom < 2.2);
      svg.classList.toggle("semantic-zoom-rank-3", zoom >= 2.2);
      points.forEach((point) => {
        const layer = point.closest("[data-layer]")?.dataset.layer;
        const scopeVisible = routeScopeVisible(point);
        const tier = point.dataset.tier || "2";
        const overviewRank = Number(point.dataset.overviewRank || 0);
        const isOverviewPoint = overviewRank >= 1 && overviewRank <= 3;
        const densityHidden = !isOverviewPoint && tier === "3" && zoom < 1.5;
        const overviewLabelHidden = isOverviewPoint && (
          (overviewRank === 2 && zoom < 1.5) ||
          (overviewRank === 3 && zoom < 2.2)
        );
        const densityVisible = !densityHidden;
        const filterVisible = pointFilterButtons.every((button) => (
          enabledPointFilters.get(button.dataset.mapPointFilter) !== false
          || !pointMatchesFilter(point, button)
        ));
        const visible = scopeVisible && densityVisible && filterVisible
          && (!layer || enabledLayers.get(layer) !== false);
        point.classList.toggle("is-route-hidden", !scopeVisible);
        point.classList.toggle("is-density-hidden", !densityVisible);
        point.classList.toggle("is-filter-hidden", !filterVisible);
        (connectorsByPoint.get(point.dataset.pointId) || []).forEach((connector) => {
          connector.classList.toggle("is-filter-hidden", !visible);
        });
        point.classList.toggle("is-overview-label-hidden", overviewLabelHidden);
        point.setAttribute("aria-hidden", String(!visible));
        point.setAttribute("tabindex", visible ? "0" : "-1");
        if (!visible && selectedPoint === point) clearSelection();
      });
      lodgings.forEach((lodging) => {
        const scopeVisible = routeScopeVisible(lodging);
        const visible = scopeVisible && enabledLayers.get("lodging") !== false;
        lodging.classList.toggle("is-route-hidden", !scopeVisible);
        lodging.setAttribute("aria-hidden", String(!visible));
      });
    }

    function setPointFilter(key, enabled) {
      if (!enabledPointFilters.has(key)) return;
      enabledPointFilters.set(key, Boolean(enabled));
      pointFilterButtons
        .filter((button) => button.dataset.mapPointFilter === key)
        .forEach((button) => button.setAttribute("aria-pressed", String(Boolean(enabled))));
      updatePointTabStops();
    }

    function setLayer(key, enabled) {
      if (!PUBLIC_LAYERS.has(key)) return;
      enabledLayers.set(key, Boolean(enabled));
      layerGroups.get(key)?.forEach((group) => {
        group.classList.toggle("is-layer-hidden", !enabled);
        group.setAttribute("aria-hidden", String(!enabled));
      });
      layerButtons
        .filter((button) => button.dataset.mapLayerToggle === key)
        .forEach((button) => button.setAttribute("aria-pressed", String(Boolean(enabled))));
      updatePointTabStops();
    }

    function pointDay(point) {
      const dayA = point.dataset.dayA || "";
      const dayB = point.dataset.dayB || "";
      if (routeMode === "A") return dayA ? `A线 ${dayA}` : "A线未标注";
      if (routeMode === "B") return dayB ? `B线 ${dayB}` : "B线未标注";
      if (dayA && dayA === dayB) return `A/B线 ${dayA}`;
      const days = [];
      if (dayA) days.push(`A线 ${dayA}`);
      if (dayB) days.push(`B线 ${dayB}`);
      return days.join(" · ") || "日程未标注";
    }

    function selectPoint(point) {
      if (point.getAttribute("aria-hidden") === "true") return;
      points.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === point)));
      selectedPoint = point;
      const elevation = point.dataset.elevation ? `约 ${point.dataset.elevation} 米` : "海拔未标注";
      detailTitle.textContent = point.dataset.title || "未命名地点";
      const action = ACTION_LABELS[point.dataset.action] || "地图信息";
      const kind = KIND_LABELS[point.dataset.kind] || point.dataset.kind || "未标注";
      const status = STATUS_LABELS[point.dataset.status] || point.dataset.status || "未标注";
      detailMeta.textContent = `类型：${kind} · 状态：${status} · 行动：${action} · ${elevation} · ${pointDay(point)}`;
      detailSummary.textContent = point.dataset.summary || "暂无说明";
      const logistics = [
        point.dataset.visitTime && `建议游览：${point.dataset.visitTime}`,
        point.dataset.driveTime && `相邻车程：${point.dataset.driveTime}`,
        point.dataset.costBasis && `临行复核/依据：${point.dataset.costBasis}`,
      ].filter(Boolean);
      detailLogistics.textContent = logistics.join("｜");
      detailLogistics.hidden = logistics.length === 0;
      if (point.dataset.action === "alternative") {
        const decisions = [
          point.dataset.detourFrom && `从${point.dataset.detourFrom}分叉`,
          point.dataset.extraKm && `绕行 ${point.dataset.extraKm}`,
          point.dataset.fitsDay && `可放入：${point.dataset.fitsDay}`,
          point.dataset.replaces && `需替换：${point.dataset.replaces}`,
          point.dataset.whyNotSelected && `未入选：${point.dataset.whyNotSelected}`,
        ].filter(Boolean);
        detailDecision.textContent = decisions.join("｜");
        detailDecision.hidden = decisions.length === 0;
      } else {
        detailDecision.textContent = "";
        detailDecision.hidden = true;
      }
    }

    function findPointAt(clientX, clientY) {
      const visiblePoints = points.filter((point) => point.getAttribute("aria-hidden") !== "true");
      const containsPoint = ({ bounds }) => (
        clientX >= bounds.left && clientX <= bounds.right
        && clientY >= bounds.top && clientY <= bounds.bottom
      );
      const symbolMatches = visiblePoints
        .map((point) => ({ point, bounds: point.querySelector(".point-symbol")?.getBoundingClientRect() }))
        .filter(({ bounds }) => bounds && containsPoint({ bounds }));
      const pointMatches = visiblePoints
        .map((point) => ({ point, bounds: point.getBoundingClientRect() }))
        .filter(containsPoint);
      return (symbolMatches.length ? symbolMatches : pointMatches)
        .sort((a, b) => (a.bounds.width * a.bounds.height) - (b.bounds.width * b.bounds.height))[0]?.point || null;
    }

    function currentViewBox() {
      return svg.getAttribute("viewBox").trim().split(/[ ,]+/).map(Number);
    }

    function clampViewBox(x, y, width, height) {
      const maxX = originX + originWidth - width;
      const maxY = originY + originHeight - height;
      return [Math.min(maxX, Math.max(originX, x)), Math.min(maxY, Math.max(originY, y)), width, height];
    }

    function setViewBox(values, announce = true) {
      svg.setAttribute("viewBox", values.join(" "));
      if (zoomStatus) {
        zoomStatus.textContent = `${Math.round((originWidth / values[2]) * 100)}%`;
        zoomStatus.setAttribute("aria-live", announce ? "polite" : "off");
      }
      updatePointTabStops();
    }

    function mapPoint(clientX, clientY) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const matrix = svg.getScreenCTM();
      return matrix ? point.matrixTransform(matrix.inverse()) : null;
    }

    function zoomBy(factor, focalPoint = null, announce = true) {
      const [x, y, width, height] = currentViewBox();
      const nextScale = Math.min(5, Math.max(1, (originWidth / width) * factor));
      const nextWidth = originWidth / nextScale;
      const nextHeight = originHeight / nextScale;
      const focus = focalPoint || { x: x + width / 2, y: y + height / 2 };
      const ratioX = (focus.x - x) / width;
      const ratioY = (focus.y - y) / height;
      setViewBox(clampViewBox(focus.x - ratioX * nextWidth, focus.y - ratioY * nextHeight, nextWidth, nextHeight), announce);
    }

    function panBy(dx, dy) {
      const [x, y, width, height] = currentViewBox();
      setViewBox(clampViewBox(x + dx, y + dy, width, height));
    }

    function setRouteMode(mode) {
      routeMode = ["A", "B", "all"].includes(mode) ? mode : "all";
      root.dataset.routeMode = routeMode;
      setLayer("route-a", routeMode !== "B");
      setLayer("route-b", routeMode !== "A");
      setLayer("route-common", true);
      updatePointTabStops();
      if (selectedPoint) selectPoint(selectedPoint);
    }

    function reset({ announce = true } = {}) {
      layerButtons.forEach((button) => setLayer(button.dataset.mapLayerToggle, true));
      pointFilterButtons.forEach((button) => setPointFilter(button.dataset.mapPointFilter, true));
      setRouteMode(body.dataset.planMode || routeMode);
      clearSelection();
      setViewBox([...original], announce);
    }

    points.forEach((point) => {
      const title = point.dataset.title || "地图地点";
      const elevation = point.dataset.elevation ? `，海拔约${point.dataset.elevation}米` : "，海拔未标注";
      const dayA = point.dataset.dayA ? `，A线${point.dataset.dayA}` : "";
      const dayB = point.dataset.dayB ? `，B线${point.dataset.dayB}` : "";
      const action = ACTION_LABELS[point.dataset.action] ? `，${ACTION_LABELS[point.dataset.action]}` : "";
      const kind = KIND_LABELS[point.dataset.kind] ? `，类型${KIND_LABELS[point.dataset.kind]}` : "";
      const status = STATUS_LABELS[point.dataset.status] ? `，状态${STATUS_LABELS[point.dataset.status]}` : "";
      point.setAttribute("role", "button");
      point.setAttribute("tabindex", "0");
      point.setAttribute("aria-controls", detailId);
      point.setAttribute("aria-label", `${title}${kind}${status}${action}${elevation}${dayA}${dayB}`);
      point.setAttribute("aria-pressed", "false");
      point.addEventListener("click", () => {
        if (performance.now() >= suppressClickUntil) selectPoint(point);
      });
      point.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectPoint(point);
        }
      });
    });

    viewport.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-point-id]") || performance.now() < suppressClickUntil) return;
      const point = findPointAt(event.clientX, event.clientY);
      if (point) selectPoint(point);
    });

    layerButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.mapLayerToggle;
        setLayer(key, enabledLayers.get(key) === false);
      });
    });
    pointFilterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.mapPointFilter;
        setPointFilter(key, enabledPointFilters.get(key) === false);
      });
    });
    actionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.mapAction === "zoom-in") zoomBy(1.25);
        if (button.dataset.mapAction === "zoom-out") zoomBy(0.8);
        if (button.dataset.mapAction === "reset") reset();
      });
    });

    viewport.addEventListener("wheel", (event) => {
      const focalPoint = mapPoint(event.clientX, event.clientY);
      if (!focalPoint) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.18 : 1 / 1.18, focalPoint, false);
    }, { passive: false });

    viewport.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      if (event.pointerType === "touch" && document.activeElement !== viewport) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      root.classList.add("is-dragging");
      const [, , width, height] = currentViewBox();
      const bounds = svg.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) panBy((-dx * width) / bounds.width, (-dy * height) / bounds.height);
      drag.x = event.clientX;
      drag.y = event.clientY;
    });
    function endDrag(event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.moved) suppressClickUntil = performance.now() + 250;
      drag = null;
      root.classList.remove("is-dragging");
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    }
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    viewport.addEventListener("keydown", (event) => {
      const [, , width, height] = currentViewBox();
      const keyPan = {
        ArrowLeft: [-width * 0.08, 0], ArrowRight: [width * 0.08, 0],
        ArrowUp: [0, -height * 0.08], ArrowDown: [0, height * 0.08],
      };
      if (keyPan[event.key]) panBy(...keyPan[event.key]);
      else if (event.key === "+" || event.key === "=") zoomBy(1.25);
      else if (event.key === "-") zoomBy(0.8);
      else if (event.key === "0" || event.key === "Home") reset();
      else if (event.key === "Escape") clearSelection();
      else return;
      event.preventDefault();
    });

    controls.hidden = false;
    root.classList.add("is-enhanced");
    reset({ announce: false });
    return {
      setRouteMode,
      reset,
      prepareForPrint() {
        printViewBox = svg.getAttribute("viewBox");
        setViewBox(original, false);
      },
      restoreAfterPrint() {
        if (printViewBox) setViewBox(printViewBox.trim().split(/[ ,]+/).map(Number), false);
        printViewBox = null;
      },
    };
  }

  document.querySelectorAll("[data-route-map]").forEach((root, index) => {
    const routeMap = initRouteMap(root, index);
    if (routeMap) routeMaps.push(routeMap);
  });

  function setPlan(choice) {
    const value = ["A", "B", "all"].includes(choice) ? choice : "all";
    body.dataset.planMode = value;
    planButtons.forEach((button) => {
      const selected = button.dataset.planChoice === value;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    routeMaps.forEach((routeMap) => routeMap.setRouteMode(value));
    try {
      localStorage.setItem("ali-route-plan", value);
    } catch (_) {
      // The page still works when local storage is disabled.
    }
  }

  function revealTargetPlan(target) {
    const plan = target?.closest(".plan-block")?.dataset.plan;
    if (plan === "A" || plan === "B") setPlan(plan);
  }

  planButtons.forEach((button) => button.addEventListener("click", () => setPlan(button.dataset.planChoice)));
  let savedPlan = "all";
  try {
    savedPlan = localStorage.getItem("ali-route-plan") || "all";
  } catch (_) {
    savedPlan = "all";
  }
  setPlan(savedPlan);

  menuButton?.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll('.toc a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      revealTargetPlan(document.querySelector(link.getAttribute("href")));
      sidebar?.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
    });
  });

  printButton?.addEventListener("click", () => window.print());
  window.addEventListener("beforeprint", () => routeMaps.forEach((routeMap) => routeMap.prepareForPrint()));
  window.addEventListener("afterprint", () => routeMaps.forEach((routeMap) => routeMap.restoreAfterPrint()));

  function updateScrollState() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    if (progress) progress.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
    backTop?.classList.toggle("visible", window.scrollY > 800);
  }
  window.addEventListener("scroll", updateScrollState, { passive: true });
  updateScrollState();
  backTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  document.querySelectorAll(".image-button").forEach((button) => {
    button.addEventListener("click", () => {
      const image = button.querySelector("img");
      if (!image || !lightbox || !lightboxImage) return;
      lightboxImage.src = image.src;
      lightboxImage.alt = image.alt;
      if (lightboxCaption) lightboxCaption.textContent = image.alt;
      lightbox.showModal();
    });
  });
  lightbox?.querySelector(".lightbox-close")?.addEventListener("click", () => lightbox.close());
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      sidebar?.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
      if (lightbox?.open) lightbox.close();
    }
  });

  const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
  const linkById = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
  const observedHeadings = [...document.querySelectorAll("main h2[id], main h3[id]")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      tocLinks.forEach((link) => link.classList.remove("active"));
      linkById.get(visible.target.id)?.classList.add("active");
    }, { rootMargin: "-18% 0px -72% 0px", threshold: 0 });
    observedHeadings.forEach((heading) => observer.observe(heading));
  }
  if (location.hash) {
    try {
      revealTargetPlan(document.querySelector(decodeURIComponent(location.hash)));
    } catch (_) {
      // Ignore malformed fragments.
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { initializeRouteGuide };
}

if (typeof document !== "undefined") {
  initializeRouteGuide();
}
