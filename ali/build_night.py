#!/usr/bin/env python3
"""Wrap canonical markdown in a night-G317 editorial shell, output as ali/index.html."""

from __future__ import annotations

import html
import sys
from pathlib import Path

# Reuse the canonical markdown renderer from the source project.
SOURCE_ROOT = Path("/Users/weimingxuan1/mcp/阿里经典环线综合优化版_2026")
sys.path.insert(0, str(SOURCE_ROOT))
from build_html import split_frontmatter, render_markdown, render_toc  # noqa: E402

ALI_DIR = Path("/Users/weimingxuan1/mcp/travel-guide/ali")
MD = SOURCE_ROOT / "阿里经典环线综合优化路书_2026-09-25_10-07.md"
CSS_PATH = ALI_DIR / "site" / "route-guide-night.css"


def render_shell(title: str, subtitle: str, version: str, content: str, headings: list[dict[str, str]]) -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="{html.escape(subtitle, quote=True)}">
  <meta name="theme-color" content="#0f1316">
  <title>{html.escape(title)} · 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="site/route-guide-night.css">
</head>
<body data-plan-mode="all">
  <div class="reading-progress" aria-hidden="true"><span></span></div>

  <header class="hero">
    <div class="hero-foil" aria-hidden="true"></div>
    <div class="hero-inner">
      <p class="eyebrow">ALI · 2026 FIELD DISPATCH · VOL I</p>
      <h1 class="hero-title"><span class="hero-title-line">阿里经典环线</span><span class="hero-title-line">综合优化路书</span></h1>
      <p class="hero-subtitle">{html.escape(subtitle)}</p>
      <div class="hero-facts" role="list">
        <span role="listitem"><strong>13</strong> 天 12 晚</span>
        <span role="listitem"><strong>A / B</strong> 两案择一</span>
        <span role="listitem"><strong>10·07</strong> 固定返程</span>
        <span role="listitem"><strong>0</strong> 转山日</span>
      </div>
      <p class="hero-note">羊湖 · 神山圣湖 · G317 · 色林措 · 纳木措</p>
      <p class="hero-byline">Made by Sorata &amp; 他智慧的 agent 们</p>
    </div>
  </header>

  <div class="chapter-strip" aria-hidden="true">
    <span>✦ ✦ ✦</span>
  </div>

  <div class="mobile-tools">
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="route-toc">目录</button>
    <div class="plan-switch compact" aria-label="方案筛选">
      <button type="button" data-plan-choice="A">A 古格</button>
      <button type="button" data-plan-choice="B">B 山南</button>
      <button type="button" data-plan-choice="all" class="active">全部</button>
    </div>
  </div>

  <div class="page-shell">
    <aside class="sidebar" id="route-toc">
      <div class="sidebar-top">
        <p class="sidebar-kicker">Route · 路线筛选</p>
        <div class="plan-switch" aria-label="方案筛选">
          <button type="button" data-plan-choice="A">A｜札达·古格</button>
          <button type="button" data-plan-choice="B">B｜山南</button>
          <button type="button" data-plan-choice="all" class="active">两案对照</button>
        </div>
        <button class="print-button" type="button">打印 / 导出 PDF</button>
      </div>
      <nav class="toc" aria-label="文档目录">
        {render_toc(headings)}
      </nav>
      <p class="source-stamp">内容源：{html.escape(MD.name)}<br>版本：{html.escape(version)}</p>
    </aside>

    <main class="routebook" id="main-content">
      {content}
    </main>
  </div>

  <dialog class="lightbox" aria-label="图片预览">
    <button type="button" class="lightbox-close" aria-label="关闭图片">关闭</button>
    <img alt="">
    <p></p>
  </dialog>
  <button class="back-top" type="button" aria-label="返回顶部">↑</button>

  <script src="site/route-guide.js"></script>
</body>
</html>
"""


def main() -> None:
    markdown_text = MD.read_text(encoding="utf-8")
    metadata, body = split_frontmatter(markdown_text)
    content, headings = render_markdown(body)
    title = metadata.get("title", "阿里经典环线综合优化路书")
    subtitle = metadata.get("subtitle", "札达·古格与山南二选一，狮泉河后共走G317")
    version = metadata.get("version", "")
    out = ALI_DIR / "index.html"
    out.write_text(render_shell(title, subtitle, version, content, headings), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
