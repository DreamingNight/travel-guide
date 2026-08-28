(() => {
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

  function setPlan(choice) {
    const value = ["A", "B", "all"].includes(choice) ? choice : "all";
    body.dataset.planMode = value;
    planButtons.forEach((button) => {
      const selected = button.dataset.planChoice === value;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
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

  planButtons.forEach((button) => {
    button.addEventListener("click", () => setPlan(button.dataset.planChoice));
  });

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
      const target = document.querySelector(link.getAttribute("href"));
      revealTargetPlan(target);
      sidebar?.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
    });
  });

  printButton?.addEventListener("click", () => window.print());

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
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        tocLinks.forEach((link) => link.classList.remove("active"));
        linkById.get(visible.target.id)?.classList.add("active");
      },
      { rootMargin: "-18% 0px -72% 0px", threshold: 0 }
    );
    observedHeadings.forEach((heading) => observer.observe(heading));
  }

  if (location.hash) {
    try {
      revealTargetPlan(document.querySelector(decodeURIComponent(location.hash)));
    } catch (_) {
      // Ignore malformed fragments.
    }
  }
})();
