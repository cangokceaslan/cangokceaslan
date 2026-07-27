import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const username = "cangokceaslan";
const dayCount = 31;
const outputPath = resolve("assets/github-insights/contribution-area.svg");
const contributionUrl = `https://github.com/users/${username}/contributions`;

const response = await fetch(contributionUrl, {
  headers: {
    Accept: "text/html",
    "User-Agent": `${username}-profile-readme`,
  },
});

if (!response.ok) {
  throw new Error(
    `GitHub contribution request failed with ${response.status} ${response.statusText}`,
  );
}

const contributions = parseContributions(await response.text()).slice(-dayCount);

if (contributions.length !== dayCount) {
  throw new Error(
    `Expected ${dayCount} contribution days, received ${contributions.length}`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, renderAreaChart(contributions), "utf8");

console.log(`Generated ${outputPath} from ${contributions.length} contribution days.`);

function parseContributions(html) {
  const countsById = new Map();

  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const attributes = parseAttributes(match[1]);
    const text = decodeHtml(stripTags(match[2])).trim();
    const countMatch = text.match(/^([\d,]+)\s+contributions?\b/i);
    countsById.set(attributes.for, countMatch ? Number(countMatch[1].replaceAll(",", "")) : 0);
  }

  const contributions = [];

  for (const match of html.matchAll(/<td\b([^>]*)>/g)) {
    const attributes = parseAttributes(match[1]);

    if (!attributes["data-date"] || !attributes.id?.startsWith("contribution-day-")) {
      continue;
    }

    contributions.push({
      date: attributes["data-date"],
      count: countsById.get(attributes.id) ?? 0,
    });
  }

  return contributions.sort((left, right) => left.date.localeCompare(right.date));
}

function parseAttributes(source) {
  const attributes = {};

  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeHtml(match[2]);
  }

  return attributes;
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function renderAreaChart(days) {
  const width = 900;
  const height = 270;
  const plot = {
    left: 54,
    right: 24,
    top: 20,
    bottom: 42,
  };
  const plotWidth = width - plot.left - plot.right;
  const baseline = height - plot.bottom;
  const plotHeight = baseline - plot.top;
  const maximum = niceMaximum(Math.max(...days.map(({ count }) => count)));
  const points = days.map(({ count }, index) => ({
    x: plot.left + (plotWidth * index) / (days.length - 1),
    y: baseline - (plotHeight * count) / maximum,
  }));
  const linePath = smoothPath(points, plot.top, baseline);
  const areaPath = `M ${format(points[0].x)} ${format(baseline)} L ${format(points[0].x)} ${format(points[0].y)} ${linePath.slice(1)} L ${format(points.at(-1).x)} ${format(baseline)} Z`;
  const horizontalGrid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = plot.top + plotHeight * ratio;
    const value = Math.round(maximum * (1 - ratio));
    return `
      <line class="grid" x1="${plot.left}" y1="${format(y)}" x2="${width - plot.right}" y2="${format(y)}"/>
      <text class="label axis-label" x="${plot.left - 12}" y="${format(y + 4)}" text-anchor="end">${value}</text>`;
  }).join("");
  const verticalGrid = days
    .map((day, index) => ({ day, index }))
    .filter(({ index }) => index % 5 === 0 || index === days.length - 1)
    .map(({ day, index }) => {
      const x = points[index].x;
      return `
      <line class="grid vertical-grid" x1="${format(x)}" y1="${plot.top}" x2="${format(x)}" y2="${baseline}"/>
      <text class="label date-label" x="${format(x)}" y="${baseline + 25}" text-anchor="middle">${formatDate(day.date)}</text>`;
    })
    .join("");
  const markers = points
    .map(
      ({ x, y }) =>
        `<circle class="marker" cx="${format(x)}" cy="${format(y)}" r="3.5"/>`,
    )
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="graph-title graph-description">
  <title id="graph-title">GitHub contribution activity</title>
  <desc id="graph-description">Daily contribution counts for the last ${dayCount} days, shown as a filled area chart.</desc>
  <defs>
    <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
      <stop class="area-top" offset="0%"/>
      <stop class="area-middle" offset="58%"/>
      <stop class="area-bottom" offset="100%"/>
    </linearGradient>
    <filter id="line-glow" x="-10%" y="-20%" width="120%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <style>
    .card { fill: #0d1117; stroke: #30363d; }
    .grid { stroke: #30363d; stroke-width: 1; stroke-dasharray: 2 4; opacity: .72; }
    .vertical-grid { opacity: .48; }
    .label { fill: #8b949e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-weight: 600; }
    .axis-label { font-size: 11px; }
    .date-label { font-size: 11px; }
    .area-top { stop-color: #d29922; stop-opacity: .82; }
    .area-middle { stop-color: #d29922; stop-opacity: .46; }
    .area-bottom { stop-color: #d29922; stop-opacity: .14; }
    .area { fill: url(#area-fill); }
    .line { fill: none; stroke: #d29922; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; filter: url(#line-glow); }
    .marker { fill: #f2cc60; stroke: #0d1117; stroke-width: 1.5; }

    @media (prefers-color-scheme: light) {
      .card { fill: #ffffff; stroke: #d0d7de; }
      .grid { stroke: #d8dee4; }
      .label { fill: #57606a; }
      .area-top { stop-color: #bf8700; stop-opacity: .72; }
      .area-middle { stop-color: #d4a72c; stop-opacity: .4; }
      .area-bottom { stop-color: #d4a72c; stop-opacity: .12; }
      .line { stroke: #9a6700; }
      .marker { fill: #bf8700; stroke: #ffffff; }
    }
  </style>
  <rect class="card" x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10"/>
  ${horizontalGrid.trim()}
  ${verticalGrid.trim()}
  <path class="area" d="${areaPath}"/>
  <path class="line" d="${linePath}"/>
  ${markers}
</svg>
`;
}

function niceMaximum(value) {
  if (value <= 0) {
    return 4;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function smoothPath(points, minimumY, maximumY) {
  const tension = 0.18;
  let path = `M ${format(points[0].x)} ${format(points[0].y)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const following = points[Math.min(points.length - 1, index + 2)];
    const firstControl = {
      x: current.x + (next.x - previous.x) * tension,
      y: clamp(
        current.y + (next.y - previous.y) * tension,
        minimumY,
        maximumY,
      ),
    };
    const secondControl = {
      x: next.x - (following.x - current.x) * tension,
      y: clamp(
        next.y - (following.y - current.y) * tension,
        minimumY,
        maximumY,
      ),
    };

    path += ` C ${format(firstControl.x)} ${format(firstControl.y)}, ${format(secondControl.x)} ${format(secondControl.y)}, ${format(next.x)} ${format(next.y)}`;
  }

  return path;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function format(value) {
  return Number(value.toFixed(2));
}
