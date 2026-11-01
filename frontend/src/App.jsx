import { useEffect, useRef, useState } from "react";
import logoImage from "../assets/images/sda logo.png";
import {
  createUserWithEmailAndPassword,
  firebaseAuth,
  getFirebaseAuthHeaders,
  onAuthStateChanged,
  onIdTokenChanged,
  requireFirebaseAuth,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "./firebase";

const imagePath = logoImage;
const announcementsKey = "announcements";
const announcementsSeenKey = "keruAnnouncementsSeenAt";
const communitySeenKey = "keruCommunitySeenAt";

const ministries = [
  [
    "Adventist Youth (AY)",
    "Empowering the youth to uphold Christ, love one another, and proclaim the everlasting Gospel to the world through active service.",
  ],
  [
    "Pathfinder Club",
    "Guiding the younger generation through spiritual discovery, outdoor skills, and community service.",
  ],
  [
    "Women's Ministries",
    "Uplifting the spiritual, physical, and mental health of women within the church and the surrounding community.",
  ],
  [
    "Adventist Men Ministries",
    "Uplifting the spiritual, physical, and mental health of men within the church and the surrounding community.",
  ],
  [
    "Ambassadors Club",
    "Guiding the young Ambassadors on how to stand for Christ in a sin sick world.",
  ],
  [
    "Adventurer Club",
    "Bringing up children in a God fearing manner and teaching them about Christ's second return.",
  ],
];

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

const pageMetadata = {
  "/": {
    title: "Kerugoya Main SDA Church | Worship & Community",
    description: "Visit Kerugoya Main Seventh-day Adventist Church in Kerugoya, Kenya. Find worship services, church programs, ministries, sermons, and ways to connect with our church family.",
  },
  "/about": {
    title: "About Our Church | Kerugoya Main SDA Church",
    description: "Learn about Kerugoya Main SDA Church, a welcoming Christian community in Kerugoya, Kenya, committed to worship, fellowship, spiritual growth, and service.",
  },
  "/ministries": {
    title: "Church Ministries | Kerugoya Main SDA Church",
    description: "Explore youth, Pathfinder, Adventurer, women's, and men's ministries at Kerugoya Main SDA Church in Kerugoya, Kenya.",
  },
  "/sermons": {
    title: "Sermons | Kerugoya Main SDA Church",
    description: "Explore sermons and Bible messages from Kerugoya Main SDA Church in Kerugoya, Kenya.",
  },
  "/giving": {
    title: "Giving | Kerugoya Main SDA Church",
    description: "Learn about giving and supporting the ministry and community work of Kerugoya Main SDA Church.",
  },
  "/announcements": {
    title: "Church Announcements | Kerugoya Main SDA Church",
    description: "Read the latest church announcements, notices, and updates from Kerugoya Main SDA Church.",
  },
  "/leaders": {
    title: "Church Leaders | Kerugoya Main SDA Church",
    description: "Meet the leaders serving Kerugoya Main SDA Church in Kerugoya, Kenya.",
  },
  "/program": {
    title: "Church Program | Kerugoya Main SDA Church",
    description: "Find worship, learning, and fellowship program information for Kerugoya Main SDA Church in Kerugoya, Kenya.",
  },
  "/contact": {
    title: "Contact Kerugoya Main SDA Church",
    description: "Contact Kerugoya Main SDA Church in Kerugoya, Kenya, for questions, prayer, and ministry information.",
  },
  "/blogs": {
    title: "Community Stories | Kerugoya Main SDA Church",
    description: "Connect with the Kerugoya Main SDA Church community and read member stories.",
  },
  "/login": {
    title: "Sign In | Kerugoya Main SDA Church",
    description: "Sign in to your Kerugoya Main SDA Church account.",
  },
  "/register": {
    title: "Create an Account | Kerugoya Main SDA Church",
    description: "Create an account to connect with the Kerugoya Main SDA Church community.",
  },
  "/admin": {
    title: "Administration | Kerugoya Main SDA Church",
    description: "Kerugoya Main SDA Church administration.",
  },
  "/admin-pro": {
    title: "Administration | Kerugoya Main SDA Church",
    description: "Kerugoya Main SDA Church administration.",
  },
};

const nonIndexableRoutes = new Set([
  "/admin",
  "/admin-pro",
  "/blogs",
  "/login",
  "/register",
]);

function updatePageMetadata(route) {
  const metadata = pageMetadata[route] || pageMetadata["/"];
  const canonicalPath = pageMetadata[route] ? route : "/";
  const canonicalUrl = `https://keru-main-teal.vercel.app${canonicalPath === "/" ? "/" : canonicalPath}`;
  document.title = metadata.title;

  const setMetaContent = (selector, content) => {
    const element = document.head.querySelector(selector);
    if (element) element.setAttribute("content", content);
  };
  setMetaContent('meta[name="description"]', metadata.description);
  setMetaContent(
    'meta[name="robots"]',
    nonIndexableRoutes.has(route) || !pageMetadata[route] ? "noindex, nofollow" : "index, follow",
  );
  setMetaContent('meta[property="og:title"]', metadata.title);
  setMetaContent('meta[property="og:description"]', metadata.description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[name="twitter:title"]', metadata.title);
  setMetaContent('meta[name="twitter:description"]', metadata.description);

  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", canonicalUrl);
}

function Link({ href, children, ...props }) {
  const internal = href.startsWith("/");
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        if (internal) {
          event.preventDefault();
          navigate(href);
        }
        props.onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}

// Continues an ordered or bulleted list when Enter is pressed in a textarea.
// "1." becomes "2.", "2)" becomes "3)", and "-"/"•" repeat with the same indent.
function continueListOnEnter(event) {
  if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const field = event.currentTarget;
  const { selectionStart, selectionEnd, value } = field;
  if (selectionStart !== selectionEnd) return;

  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionStart);
  const currentLine = before.slice(before.lastIndexOf("\n") + 1);

  // The marker must start the line and be followed by a space or end of line.
  const ordered = currentLine.match(/^(\s*)(\d+)([.)])(?=\s|$)/);
  const bullet = currentLine.match(/^(\s*)([-*+])(?=\s|$)/);
  if (!ordered && !bullet) return;

  const matched = ordered || bullet;
  const indent = matched[1];
  const marker = ordered
    ? `${Number(ordered[2]) + 1}${ordered[3]}`
    : bullet[2];
  const separator = /^\s*/.exec(currentLine.slice(matched[0].length))[0];

  event.preventDefault();
  const insertion = `\n${indent}${marker}${separator}`;
  const nextValue = before + insertion + after;

  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setter) setter.call(field, nextValue);
  else field.value = nextValue;

  const caret = selectionStart + insertion.length;
  field.setSelectionRange(caret, caret);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return path.replace(/\/$/, "").replace(/\.html$/, "") || "/";
}

function useCountdown() {
  const [countdown, setCountdown] = useState("Loading...");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const day = now.getDay();
      let daysUntilFriday = 5 - day;
      if (
        daysUntilFriday < 0 ||
        (daysUntilFriday === 0 && now.getHours() >= 18)
      )
        daysUntilFriday += 7;
      const nextFriday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + daysUntilFriday,
      );
      nextFriday.setHours(18, 0, 0, 0);
      const diff = nextFriday - now;
      if (day === 6 || (day === 5 && now.getHours() >= 18)) {
        setCountdown("It's Sabbath! Welcome.");
        return;
      }
      setCountdown(
        `${Math.floor(diff / 86400000)}d ${Math.floor(diff / 3600000) % 24}h ${Math.floor(diff / 60000) % 60}m`,
      );
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);
  return countdown;
}

function useUnreadCounts(route) {
  const [counts, setCounts] = useState({ announcements: 0, community: 0 });

  useEffect(() => {
    let active = true;
    const onAnnouncements = route === "/announcements";
    const onCommunity = route === "/blogs" || route === "/community";
    const read = async (key, endpoint, isOpen) => {
      try {
        const since = Number(localStorage.getItem(key)) || 0;
        const response = await fetch(`${endpoint}?since=${since}`, {
          cache: "no-store",
        });
        if (!response.ok) return { count: 0, latest: 0 };
        const result = await response.json();
        const latest = Number(result.latest) || 0;
        if (isOpen && latest) {
          // This section is on screen, so everything in it has been opened.
          localStorage.setItem(key, String(latest));
          return { count: 0, latest };
        }
        return { count: Number(result.count) || 0, latest };
      } catch {
        return { count: 0, latest: 0 };
      }
    };
    (async () => {
      const [announcements, community] = await Promise.all([
        read(announcementsSeenKey, "/api/announcements/count", onAnnouncements),
        read(communitySeenKey, "/api/community/posts/count", onCommunity),
      ]);
      if (!active) return;
      setCounts({ announcements: announcements.count, community: community.count });
    })();
    return () => {
      active = false;
    };
  }, [route]);

  return counts;
}

function NavBadge({ count, label }) {
  if (!count) return null;
  return (
    <span className="nav-badge" aria-label={`${count} new ${label}`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  let truncated = false;

  const splitWord = (word) => {
    const pieces = [];
    let chunk = "";
    for (const ch of word) {
      if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
        pieces.push(chunk);
        chunk = ch;
        if (pieces.length >= maxLines) return [pieces, true];
      } else {
        chunk += ch;
      }
    }
    if (chunk) pieces.push(chunk);
    return [pieces, false];
  };

  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      const [pieces, cut] = splitWord(word);
      for (const piece of pieces) {
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
        lines.push(piece);
      }
      if (truncated) break;
      line = "";
      continue;
    }
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines.length >= maxLines) {
        truncated = true;
        line = "";
        break;
      }
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (!truncated && line) {
    if (lines.length < maxLines) lines.push(line);
    else truncated = true;
  }
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function canvasTextRuns(text, style = {}) {
  const expression = /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|(https?:\/\/[^\s<]+|www\.[^\s<]+)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|<u>([^<]+)<\/u>|~~([^~]+)~~|==([^=]+)==|<mark>([^<]+)<\/mark>|\*([^*\n]+)\*|_([^\n_]+)_|`([^`]+)`/g;
  const runs = [];
  let cursor = 0;
  let match;
  const add = (value, extra = {}) => {
    if (value) runs.push({ text: value, ...style, ...extra });
  };

  while ((match = expression.exec(String(text || ""))) !== null) {
    add(text.slice(cursor, match.index));
    const [full, linkText, , rawUrl, boldItalic, bold, boldUnder, underline, strike, highlight, highlightMark, italic, italicUnder, code] = match;
    if (linkText) add(linkText, { underline: true, color: "#2563eb" });
    else if (rawUrl) add(rawUrl, { underline: true, color: "#2563eb" });
    else if (boldItalic) add(boldItalic, { bold: true, italic: true });
    else if (bold || boldUnder) add(bold || boldUnder, { bold: true });
    else if (underline) add(underline, { underline: true });
    else if (strike) add(strike, { strike: true });
    else if (highlight || highlightMark) add(highlight || highlightMark, { highlight: true });
    else if (italic || italicUnder) add(italic || italicUnder, { italic: true });
    else if (code) add(code, { code: true });
    cursor = match.index + full.length;
  }
  add(String(text || "").slice(cursor));
  return runs;
}

function canvasFont(ctx, size, run) {
  ctx.font = `${run.bold ? "700" : "400"} ${run.italic ? "italic " : ""}${size}px ${run.code ? "monospace" : "'Inter', system-ui, sans-serif"}`;
}

function wrapCanvasRuns(ctx, text, maxWidth, size, style = {}) {
  const lines = [[]];
  let lineWidth = 0;
  const append = (value, run) => {
    if (!value) return;
    const last = lines[lines.length - 1];
    if (last.length && JSON.stringify(last[last.length - 1].style) === JSON.stringify(run)) {
      last[last.length - 1].text += value;
    } else {
      last.push({ text: value, style: run });
    }
  };
  const newLine = () => {
    if (lines[lines.length - 1].length) lines.push([]);
    lineWidth = 0;
  };

  canvasTextRuns(text, style).forEach((run) => {
    const words = run.text.match(/\s+|[^\s]+/g) || [];
    words.forEach((word) => {
      canvasFont(ctx, size, run);
      let candidate = word;
      if (lineWidth && /^\s+$/.test(word) && lineWidth + ctx.measureText(word).width > maxWidth) {
        newLine();
        return;
      }
      if (lineWidth && lineWidth + ctx.measureText(candidate).width > maxWidth && !/^\s+$/.test(word)) {
        newLine();
      }
      canvasFont(ctx, size, run);
      if (ctx.measureText(candidate).width > maxWidth) {
        for (const character of candidate) {
          canvasFont(ctx, size, run);
          const characterWidth = ctx.measureText(character).width;
          if (lineWidth + characterWidth > maxWidth && lineWidth) newLine();
          append(character, run);
          lineWidth += characterWidth;
        }
      } else {
        append(candidate, run);
        lineWidth += ctx.measureText(candidate).width;
      }
    });
  });
  return lines.filter((line, index) => line.length || index === 0);
}

function parseContentBlocks(ctx, content, maxWidth, bodySize) {
  return parseBlocks(content).map((block) => {
    if (block.type === "hr") return { kind: "divider", lines: [[]] };
    if (block.type === "ul" || block.type === "ol") {
      const items = block.items.map((text, index) => ({
        marker: block.type === "ul" ? "•" : `${index + 1}.`,
        lines: wrapCanvasRuns(ctx, text, maxWidth - 54, bodySize),
      }));
      return { kind: "list", items, lineCount: items.reduce((count, item) => count + item.lines.length, 0) };
    }
    const kind = block.type === "quote" ? "quote" : block.type.startsWith("h") ? block.type : "text";
    const size = kind === "h1" ? bodySize * 1.45 : kind === "h2" ? bodySize * 1.25 : kind === "h3" ? bodySize * 1.1 : bodySize;
    const style = kind === "quote" ? { italic: true } : kind.startsWith("h") ? { bold: true } : {};
    const text = block.type === "quote" ? block.text : block.text;
    const availableWidth = maxWidth - (kind === "quote" ? 28 : 0);
    const lines = text.split("\n").flatMap((line) => wrapCanvasRuns(ctx, line, availableWidth, size, style));
    return { kind, size, lines, lineCount: lines.length };
  });
}

async function renderPostImage(post) {
  const width = 1200;
  const minHeight = 630;
  const maxHeight = 4000;
  const padding = 72;
  const contentWidth = width - padding * 2;
  const coverHeight = post.coverPhoto ? 320 : 0;
  const top = coverHeight + 104;
  const brandH = 78;
  const chipH = 62;
  const titleGap = 12;
  const dividerGap = 34;
  const bodyToFooterGap = 24;
  const footerBlock = 112;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  const ctx = canvas.getContext("2d");

  try {
    await document.fonts?.ready;
  } catch {}

  // Measure the whole post, shrinking the type only if it grows very long.
  let titleSize = 44;
  let bodySize = 24;
  let titleLineH = 55;
  let bodyLineH = 36;
  let titleLines = [];
  let bodyBlocks = [];
  let bodyHeight = 0;
  let height = minHeight;

  for (const scale of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) {
    titleSize = Math.round(44 * scale);
    bodySize = Math.round(24 * scale);
    titleLineH = Math.round(titleSize * 1.25);
    bodyLineH = Math.round(bodySize * 1.5);

    ctx.font = `700 ${titleSize}px 'Playfair Display', Georgia, serif`;
    titleLines = wrapText(ctx, post.title || "Community Story", contentWidth, Infinity);
    bodyBlocks = parseContentBlocks(ctx, post.content || "", contentWidth, bodySize);
    bodyHeight = bodyBlocks.reduce((sum, block) => {
      if (block.kind === "divider") return sum + 28;
      const lineCount = block.kind === "list" ? block.lineCount : block.lines.length;
      const size = block.size || bodySize;
      return sum + lineCount * Math.round(size * 1.55) + 14;
    }, 0);

    const contentEnd =
      top +
      brandH +
      chipH +
      titleLines.length * titleLineH +
      titleGap +
      1 +
      dividerGap +
      bodyHeight;

    height = Math.max(minHeight, contentEnd + bodyToFooterGap + footerBlock);
    if (height <= maxHeight) break;
  }

  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (post.coverPhoto) {
    const cover = await loadImage(post.coverPhoto);
    const scale = Math.max(width / cover.width, coverHeight / cover.height);
    const coverWidth = cover.width * scale;
    const scaledHeight = cover.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, coverHeight);
    ctx.clip();
    ctx.drawImage(cover, (width - coverWidth) / 2, (coverHeight - scaledHeight) / 2, coverWidth, scaledHeight);
    const shade = ctx.createLinearGradient(0, 0, 0, coverHeight);
    shade.addColorStop(0, "rgba(15, 23, 42, 0.08)");
    shade.addColorStop(1, "rgba(15, 23, 42, 0.32)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, coverHeight);
    ctx.restore();
  }

  let y = top;

  // Brand row
  let brandX = padding;
  try {
    const logo = await loadImage(imagePath);
    const box = 56;
    const scale = box / Math.max(logo.width, logo.height);
    const logoWidth = logo.width * scale;
    const logoHeight = logo.height * scale;
    ctx.drawImage(
      logo,
      padding,
      y - logoHeight / 2,
      logoWidth,
      logoHeight,
    );
    brandX = padding + logoWidth + 22;
  } catch {}

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "700 28px 'Playfair Display', Georgia, serif";
  ctx.fillText("Kerugoya Main SDA", brandX, y - 13);
  ctx.fillStyle = "#64748b";
  ctx.font = "600 17px 'Inter', system-ui, sans-serif";
  ctx.fillText("Community Story", brandX, y + 16);

  y += brandH;

  // Category chip
  const category = String(post.category || "Story").toUpperCase();
  ctx.font = "700 15px 'Inter', system-ui, sans-serif";
  const chipWidth = ctx.measureText(category).width + 32;
  ctx.fillStyle = "#eef2fb";
  roundRect(ctx, padding, y - 16, chipWidth, 32, 16);
  ctx.fill();
  ctx.fillStyle = "#1e3a8a";
  ctx.fillText(category, padding + 16, y + 1);

  y += chipH;

  // Title
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 ${titleSize}px 'Playfair Display', Georgia, serif`;
  titleLines.forEach((line) => {
    ctx.fillText(line, padding, y + titleLineH / 2);
    y += titleLineH;
  });

  y += titleGap;

  // Divider
  ctx.fillStyle = "#e7e9e3";
  ctx.fillRect(padding, y, contentWidth, 1);
  y += dividerGap;

  // Draw the same headings, lists, quotes, and inline styles shown in the editor preview.
  bodyBlocks.forEach((block) => {
    if (block.kind === "divider") {
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(padding, y + 10, contentWidth, 2);
      y += 28;
      return;
    }
    if (block.kind === "list") {
      block.items.forEach((item) => {
        item.lines.forEach((line, index) => {
          const baseline = y + bodyLineH / 2;
          if (index === 0) {
            ctx.fillStyle = "#2563eb";
            ctx.font = `700 ${bodySize}px 'Inter', system-ui, sans-serif`;
            ctx.fillText(item.marker, padding, baseline);
          }
          let x = padding + 54;
          line.forEach((run) => {
            canvasFont(ctx, bodySize, run.style);
            ctx.fillStyle = run.style.color || "#475569";
            const measured = ctx.measureText(run.text).width;
            if (run.style.highlight) {
              ctx.fillStyle = "#fef08a";
              ctx.fillRect(x - 2, baseline - bodySize * 0.7, measured + 4, bodySize * 1.05);
              ctx.fillStyle = "#475569";
            } else if (run.style.code) {
              ctx.fillStyle = "#f1f5f9";
              ctx.fillRect(x - 2, baseline - bodySize * 0.7, measured + 4, bodySize * 1.05);
              ctx.fillStyle = "#475569";
            }
            ctx.fillText(run.text, x, baseline);
            if (run.style.underline || run.style.strike) {
              ctx.strokeStyle = ctx.fillStyle;
              ctx.lineWidth = Math.max(1, bodySize / 16);
              ctx.beginPath();
              const decorationY = run.style.strike ? baseline - bodySize * 0.3 : baseline + bodySize * 0.18;
              ctx.moveTo(x, decorationY);
              ctx.lineTo(x + measured, decorationY);
              ctx.stroke();
            }
            x += measured;
          });
          y += bodyLineH;
        });
      });
    } else {
      const size = block.size || bodySize;
      const lineHeight = Math.round(size * 1.55);
      block.lines.forEach((line) => {
        const baseline = y + lineHeight / 2;
        if (block.kind === "quote") {
          ctx.fillStyle = "#2563eb";
          ctx.fillRect(padding + 2, y + 2, 4, lineHeight - 4);
        }
        let x = padding + (block.kind === "quote" ? 28 : 0);
        line.forEach((run) => {
          canvasFont(ctx, size, run.style);
          ctx.fillStyle = run.style.color || (block.kind.startsWith("h") ? "#0f172a" : block.kind === "quote" ? "#475569" : "#475569");
          const measured = ctx.measureText(run.text).width;
          if (run.style.highlight) {
            ctx.fillStyle = "#fef08a";
            ctx.fillRect(x - 2, baseline - size * 0.7, measured + 4, size * 1.05);
            ctx.fillStyle = "#475569";
          } else if (run.style.code) {
            ctx.fillStyle = "#f1f5f9";
            ctx.fillRect(x - 2, baseline - size * 0.7, measured + 4, size * 1.05);
            ctx.fillStyle = "#475569";
          }
          ctx.fillText(run.text, x, baseline);
          if (run.style.underline || run.style.strike) {
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = Math.max(1, size / 16);
            ctx.beginPath();
            const decorationY = run.style.strike ? baseline - size * 0.3 : baseline + size * 0.18;
            ctx.moveTo(x, decorationY);
            ctx.lineTo(x + measured, decorationY);
            ctx.stroke();
          }
          x += measured;
        });
        y += lineHeight;
      });
    }
    y += 14;
  });

  // Footer
  const footerY = height - 78;
  ctx.fillStyle = "#e7e9e3";
  ctx.fillRect(padding, footerY - 34, contentWidth, 1);

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 22px 'Inter', system-ui, sans-serif";
  ctx.fillText(`— ${post.author || "Community member"}`, padding, footerY);

  ctx.textAlign = "right";
  ctx.fillStyle = "#64748b";
  ctx.font = "500 20px 'Inter', system-ui, sans-serif";
  const dateLabel = post.date
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${post.date}T12:00:00`))
    : "";
  ctx.fillText(dateLabel, width - padding, footerY);
  ctx.textAlign = "left";

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95),
  );
}

async function renderLeaderIdCard(leader) {
  const width = 1200;
  const height = 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the ID card.");

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  roundRect(ctx, 0, 0, width, height, 34);
  ctx.clip();

  const panel = ctx.createLinearGradient(0, 0, 440, height);
  panel.addColorStop(0, "#1e3a8a");
  panel.addColorStop(1, "#172554");
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, 440, height);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(440, 0, 9, height);

  if (leader.imageUrl) {
    const portrait = await loadImage(leader.imageUrl);
    ctx.save();
    roundRect(ctx, 68, 96, 304, 382, 22);
    ctx.clip();
    const scale = Math.max(304 / portrait.width, 382 / portrait.height);
    const portraitWidth = portrait.width * scale;
    const portraitHeight = portrait.height * scale;
    ctx.drawImage(
      portrait,
      68 + (304 - portraitWidth) / 2,
      96 + (382 - portraitHeight) / 2,
      portraitWidth,
      portraitHeight,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, 68, 96, 304, 382, 22);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 120px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      String(leader.name || "L").trim().charAt(0).toUpperCase(),
      220,
      286,
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  let logo;
  try {
    logo = await loadImage(imagePath);
  } catch {
    logo = null;
  }
  if (logo) {
    const logoSize = 48;
    const scale = logoSize / Math.max(logo.width, logo.height);
    ctx.drawImage(logo, 68, 548, logo.width * scale, logo.height * scale);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 20px 'Inter', system-ui, sans-serif";
  ctx.fillText("KERUGOYA MAIN SDA CHURCH", 132, 575);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 15px 'Inter', system-ui, sans-serif";
  ctx.fillText("LEADERSHIP  ·  KERUGOYA, KENYA", 68, 635);

  ctx.fillStyle = "#1e3a8a";
  ctx.font = "700 17px 'Inter', system-ui, sans-serif";
  ctx.fillText("CHURCH LEADERSHIP", 510, 155);
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "700 54px 'Playfair Display', Georgia, serif";
  const nameLines = wrapText(ctx, leader.name || "Church Leader", 610, 2);
  nameLines.forEach((line, index) => ctx.fillText(line, 510, 235 + index * 64));
  const nameBottom = 235 + (nameLines.length - 1) * 64;

  ctx.fillStyle = "#334155";
  ctx.font = "700 25px 'Inter', system-ui, sans-serif";
  const roleLines = wrapText(ctx, leader.role || "Church Leader", 610, 2);
  roleLines.forEach((line, index) => ctx.fillText(line, 510, nameBottom + 56 + index * 34));

  const descriptionTop = nameBottom + 112 + Math.max(0, roleLines.length - 1) * 34;
  ctx.fillStyle = "#64748b";
  ctx.font = "400 20px 'Inter', system-ui, sans-serif";
  const descriptionLines = wrapText(ctx, leader.description || "Serving the church community with faith and care.", 610, 4);
  descriptionLines.forEach((line, index) => ctx.fillText(line, 510, descriptionTop + index * 32));

  ctx.fillStyle = "#dbe3f0";
  ctx.fillRect(510, 594, 610, 1);
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "600 17px 'Inter', system-ui, sans-serif";
  ctx.fillText("SERVING WITH FAITH · GROWING IN COMMUNITY", 510, 635);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Your browser could not create the ID card image."));
    }, "image/png");
  });
}

const links = [
  ["/", "bx-home-alt-2", "Home"],
  ["/about.html", "bx-user", "About"],
  ["/ministries.html", "bx-group", "Ministries"],
  ["/sermons.html", "bx-tv", "Sermons"],
  ["/blogs.html", "bx-conversation", "Community"],
  ["/giving.html", "bx-donate-heart", "Giving"],
];

function isLinkActive(href, route) {
  const clean = href.replace(/\.html$/, "");
  if (clean === "/") return route === "/";
  if (clean === "/blogs") return route === "/blogs" || route === "/community";
  return route === clean;
}

function PublicHeader() {
  const countdown = useCountdown();
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const { announcements: announcementCount, community: communityCount } =
    useUnreadCounts(route);
  const onAnnouncements = route === "/announcements";
  const onCommunity = route === "/blogs" || route === "/community";

  return (
    <>
      <div className="top-bar">
        <div>
          Verse of the Week: <span className="highlight">Exodus 20:8</span>
        </div>
        <div>
          Sunset Today: <span className="highlight">18:45 EAT</span> | Sabbath
          In: <span className="highlight">{countdown}</span>
        </div>
      </div>
      <nav>
        <Link href="/" className="logo">
          <img src={imagePath} alt="Seventh-day Adventist Logo" />
          <span>Kerugoya Main SDA</span>
        </Link>
        <button
          className="menu"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <i className={`bx ${menuOpen ? "bx-x" : "bx-menu-alt-right"}`} />
        </button>
        <ul className="nav-links">
          {links.map(([href, icon, label]) => {
            const active = isLinkActive(href, route);
            const badge =
              label === "Community" && !onCommunity ? (
                <NavBadge count={communityCount} label="community stories" />
              ) : null;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={active ? "active is-active" : ""}
                  aria-current={active ? "page" : undefined}
                >
                  <i className={`bx ${icon}`} />
                  <span>{label}</span>
                  {badge}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="announcements">
          <Link href="/announcements.html" className="announcement-link">
            <i className="bx bx-bell" />
            <NavBadge
              count={onAnnouncements ? 0 : announcementCount}
              label="announcements"
            />
          </Link>
        </div>
        <aside className={`mobile-side-panel ${menuOpen ? "is-open" : ""}`}>
          <div className="side-menu">
            <ul>
              <li>
                <Link href="/leaders.html">
                  <i className="bx bx-user-voice" /> <span>Leaders</span>
                </Link>
              </li>
              <li>
                <Link href="/program.html">
                  <i className="bx bx-calendar" /> <span>Program</span>
                </Link>
              </li>
              <li>
                <Link href="/prayer.html">
                  <i className="bx bx-book-open" /> <span>Prayer</span>
                </Link>
              </li>
              <li>
                <Link href="/feedback.html">
                  <i className="bx bx-info-circle" /> <span>Feedback</span>
                </Link>
              </li>
              <li>
                <Link href="/contact.html">
                  <i className="bx bx-phone" /> <span>Contact Us</span>
                </Link>
              </li>
              <li>
                <Link href="/admin.html">
                  <i className="bx bx-lock-alt" /> <span>Admin login</span>
                </Link>
              </li>
            </ul>
          </div>
          <div className="join-btn">
            <Link
              href="/login.html"
              className="btn join"
              style={{ padding: "0.5rem 1.5rem" }}
            >
              Join Us
            </Link>
          </div>
        </aside>
      </nav>
    </>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-contact">
        <div className="contact-info">
          <h3>Contact Us</h3>
          <p>
            <i className="bx bx-phone" /> +254 706 663 186
          </p>
          <p>
            <i className="bx bx-envelope" /> kerugoyamainsda@gmail.com
          </p>
        </div>
      </div>
      <div className="links">
        <h3>Quick Links</h3>
        <ul>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/about.html">About Us</Link>
          </li>
          <li>
            <Link href="/ministries.html">Ministries</Link>
          </li>
          <li>
            <Link href="/sermons.html">Sermons</Link>
          </li>
          <li>
            <Link href="/blogs.html">Blogs & Community</Link>
          </li>
          <li>
            <Link href="/giving.html">Giving</Link>
          </li>
        </ul>
      </div>
      <div className="resources">
        <h3>Resources</h3>
        <ul>
          <li>
            <a href="https://ssnet.org/lessons/current.html">
              Sabbath School Lessons
            </a>
          </li>
          <li>
            <a href="http://www.anym.org/download_audio_sermons.html?no_redirect=true">
              Sermon Archives
            </a>
          </li>
          <li>
            <a href="https://adventist.org/beliefs/bible/study">
              Bible Study Guides
            </a>
          </li>
          <li>
            <a href="#">Event Calendar</a>
          </li>
          <li>
            <a href="https://m.egwwritings.org/">Ellen G. White Writings</a>
          </li>
        </ul>
      </div>
      
      <div className="copy">
        <p>
          &copy; {new Date().getFullYear()} SDA Church Kerugoya. All rights
          reserved.
        </p>
        <p>
          Developed by{" "}
          <a href="https://wa.me/254115903200" target="_blank" rel="noreferrer">
            L-Tech Solutions
          </a>
        </p>
      </div>
    </footer>
  );
}

function PublicShell({ children }) {
  return (
    <>
      <PublicHeader />
      {children}
      <Footer />
    </>
  );
}
function Scripture() {
  return (
    <section className="scripture">
      <h3>
        "For I know the plans I have for you, declares the Lord, plans to
        prosper you and not to harm you, plans to give you hope and a future."
      </h3>
      <p>— Jeremiah 29:11</p>
    </section>
  );
}
function MinistriesGrid() {
  return (
    <section id="ministries" className="ministries">
      <h2 className="section-title">Serve & Connect</h2>
      <div className="grid">
        {ministries.map(([title, text]) => (
          <div className="card" key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Home() {
  return (
    <PublicShell>
      <header className="hero">
        <h1>Welcome Home</h1>
        <p>
          Faith. Family. Fellowship. A place to be, where hearts are healed,
          hope is restored, and lives are transformed by God's amazing love.
        </p>
        <div className="hero-actions">
          <a href="#ministries" className="btn">
            Discover Our Ministries
          </a>
        </div>
      </header>
      <section className="mission">
        <h2>Our Mission & Vision</h2>
        <p>
          At Kerugoya Main SDA Church, we strive to grow in faith, serve our
          community with compassion, and reflect Christ's love in all we do. Our
          vision is to be a spirit-filled family that empowers every member to
          live a Christ-centered life, actively preparing for His soon return.
        </p>
        <Link className="btn mission-community-link" href="/blogs.html">
          Join the community <i className="bx bx-right-arrow-alt" />
        </Link>
      </section>
      <MinistriesGrid />
      <Scripture />
      <section className="location">
        <h1>Location</h1>
        <iframe
          title="Kerugoya Main SDA Church location"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.660379592747!2d37.277211472922716!3d-0.5098114689953032!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1828803073c07cf3%3A0xc73c90ce509054d5!2sSDA%20CHURCH%20KERUGOYA!5e0!3m2!1sen!2ske!4v1779641510230!5m2!1sen!2ske"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </PublicShell>
  );
}
function About() {
  return (
    <PublicShell>
      <section className="about">
        <h1>About Us</h1>
        <p>
          Kerugoya Main SDA Church is a vibrant community of believers dedicated
          to worship, fellowship, and service. We are committed to sharing the
          love of Christ and making a positive impact in our community and
          beyond.
        </p>
        <p>
          Our church offers a variety of ministries and programs for all ages,
          including Bible study groups, youth activities, community outreach,
          and more. We believe in nurturing spiritual growth and fostering
          meaningful connections among our members.
        </p>
        <p>
          Whether you are new to the area or looking for a church home, we
          invite you to join us in worship and experience the warmth and
          fellowship of our church family. Together, we can grow in faith and
          serve our community with love.
        </p>
      </section>
    </PublicShell>
  );
}
function Ministries() {
  return (
    <PublicShell>
      <MinistriesGrid />
    </PublicShell>
  );
}
function renderSermon(sermon) {
  const [id, title] = Array.isArray(sermon)
    ? sermon
    : [sermon.youtubeId, sermon.title];
  return (
    <iframe
      key={id}
      src={`https://www.youtube.com/embed/${id}`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}
const featuredSermons = [
  ["Mq3AE7uncHw", "THE MAN WHO CHOPPED THE SCRIPTURES || Bro. DENNIS MURIITHI"],
  ["nWpu9D5tE1g", "KERUGOYA MAIN SDA CHURCH || GOOD FAITH CHILDRENS HOME"],
  ["G183uFMOWMI", "Ni Mbaya || Sis. Eliza || Kerugoya Main SDA church"],
  ["Dmbi12ChCec", "Who is your Redeemer || Pr. Rei Kesis"],
  ["k1Yg0Lh5DCA", "Tunataka Power By Bro. Edwin Murimi"],
];
function Sermons() {
  const [videos, setVideos] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/sermons");
        if (response.ok) {
          const sermons = await response.json();
          if (Array.isArray(sermons) && sermons.length > 0) {
            setVideos(sermons);
            return;
          }
        }
      } catch {}
      setVideos(featuredSermons);
    })();
  }, []);
  return (
    <PublicShell>
      <section className="sermons">
        <div className="sermons-heading">
          <p className="eyebrow">Watch and grow</p>
          <h1>Sermons &amp; Messages</h1>
          <p>Worship with us and explore messages from Kerugoya Main SDA Church.</p>
        </div>
        <div className="video-gallery">{videos.map(renderSermon)}</div>
      </section>
    </PublicShell>
  );
}

function Account({ register = false }) {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password"));
    const name = register ? String(data.get("name")).trim() : "";
    setSubmitting(true);
    setMessage("");
    setMessageType("error");
    try {
      const auth = requireFirebaseAuth();
      if (register) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setMessageType("success");
        setMessage("Account created. Check your email and verify your address before signing in.");
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          await signOut(auth);
          throw new Error("Please verify your email address. We sent you a new verification link.");
        }
        navigate("/blogs.html");
      }
    } catch (error) {
      setMessage(error.message || "We could not authenticate your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main
      className={`account-page account-shell${register ? "" : " login-screen"}`}
    >
      <Link className="account-brand" href="/">
        <img src={imagePath} alt="" /> Kerugoya Main SDA
      </Link>
      <section className="account-panel">
        <div className="account-copy">
          {!register && (
            <span className="account-mark">
              <i className="bx bx-sun" />
            </span>
          )}
          <span className="eyebrow">
            {register ? "Find your people" : "Welcome back"}
          </span>
          <h1>
            {register ? "There is room for your voice." : "Come as you are."}
          </h1>
          <p>
            {register
              ? "Join thoughtful conversations, share what God is teaching you, and encourage someone in the week ahead."
              : "Stay close to the conversations, stories, and people that make our church family feel like home."}
          </p>
          <div className="account-note">
            <i
              className={`bx ${register ? "bx-message-rounded-dots" : "bx-heart"}`}
            />
            <span>
              {register
                ? "Share generously. Listen deeply."
                : "Faith grows beautifully in community."}
            </span>
          </div>
        </div>
        <form className="account-form" onSubmit={submit}>
          <h2>{register ? "Create account" : "Sign in"}</h2>
          <p className="form-intro">
            {register
              ? "Your name will appear beside your posts. Use a password with at least 8 characters."
              : "Pick up where you left off."}
          </p>
          {register && (
            <>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                minLength="2"
                maxLength="80"
                required
              />
            </>
          )}
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <div className="field-heading">
            <label htmlFor="password">Password</label>
            {!register && <Link href="/register.html">Need an account?</Link>}
          </div>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={register ? 8 : undefined}
              maxLength="128"
              required
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              <i className={`bx ${showPassword ? "bx-hide" : "bx-show"}`} />
            </button>
          </div>
          <button className="btn form-submit" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : register ? "Create account" : "Sign in"}{" "}
            <i className="bx bx-right-arrow-alt" />
          </button>
          <p className={`form-message ${messageType === "error" ? "is-error" : "is-success"}`} role="status">
            {message}
          </p>
          <p className="account-switch">
            {register ? "Already a member? " : "New here? "}
            <Link href={register ? "/login.html" : "/register.html"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}

function parseBlocks(text) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/);
  const blocks = [];
  let currentList = null;
  let currentQuote = null;
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length) {
      blocks.push({ type: "p", text: currentParagraph.join("\n") });
      currentParagraph = [];
    }
  };
  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };
  const flushQuote = () => {
    if (currentQuote) {
      blocks.push({ type: "quote", text: currentQuote.join("\n") });
      currentQuote = null;
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      blocks.push({ type: "hr" });
      continue;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({ type: "h" + headingMatch[1].length, text: headingMatch[2] });
      continue;
    }
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      if (!currentQuote) currentQuote = [];
      currentQuote.push(quoteMatch[1]);
      continue;
    } else {
      flushQuote();
    }
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      flushQuote();
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(bulletMatch[3]);
      continue;
    }
    const numMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (numMatch) {
      flushParagraph();
      flushQuote();
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(numMatch[3]);
      continue;
    }
    flushList();
    flushQuote();
    currentParagraph.push(line);
  }
  flushAll();
  return blocks;
}

function renderInlineFormatted(text) {
  if (!text) return null;
  const regex = /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|(https?:\/\/[^\s<]+|www\.[^\s<]+)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|<u>([^<]+)<\/u>|~~([^~]+)~~|==([^=]+)==|<mark>([^<]+)<\/mark>|\*([^*\n]+)\*|_([^\n_]+)_|`([^`]+)`/g;

  let lastIndex = 0;
  const elements = [];
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    const [
      full,
      linkText,
      linkUrl,
      rawUrl,
      boldItalic,
      boldStar,
      boldUnder,
      underline,
      strike,
      highlightEq,
      highlightMark,
      italicStar,
      italicUnder,
      code,
    ] = match;

    if (linkText && linkUrl) {
      const href = linkUrl.startsWith("http://") || linkUrl.startsWith("https://") ? linkUrl : `https://${linkUrl}`;
      elements.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="content-link">
          {linkText}
        </a>
      );
    } else if (rawUrl) {
      const href = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
      elements.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="content-link">
          {rawUrl}
        </a>
      );
    } else if (boldItalic) {
      elements.push(
        <strong key={key++}>
          <em>{boldItalic}</em>
        </strong>
      );
    } else if (boldStar || boldUnder) {
      elements.push(
        <strong key={key++} className="content-bold">
          {boldStar || boldUnder}
        </strong>
      );
    } else if (underline) {
      elements.push(
        <u key={key++} className="content-underline">
          {underline}
        </u>
      );
    } else if (strike) {
      elements.push(
        <del key={key++} className="content-del">
          {strike}
        </del>
      );
    } else if (highlightEq || highlightMark) {
      elements.push(
        <mark key={key++} className="content-mark">
          {highlightEq || highlightMark}
        </mark>
      );
    } else if (italicStar || italicUnder) {
      elements.push(
        <em key={key++} className="content-italic">
          {italicStar || italicUnder}
        </em>
      );
    } else if (code) {
      elements.push(
        <code key={key++} className="content-code">
          {code}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }
  return elements;
}

function FormattedContent({ text, className = "" }) {
  if (!text) return null;
  const blocks = parseBlocks(text);

  return (
    <div className={`formatted-content-container ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === "hr") {
          return <hr key={idx} className="content-divider" />;
        }
        if (block.type === "h1") {
          return (
            <h3 key={idx} className="content-h1">
              {renderInlineFormatted(block.text)}
            </h3>
          );
        }
        if (block.type === "h2") {
          return (
            <h4 key={idx} className="content-h2">
              {renderInlineFormatted(block.text)}
            </h4>
          );
        }
        if (block.type === "h3") {
          return (
            <h5 key={idx} className="content-h3">
              {renderInlineFormatted(block.text)}
            </h5>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={idx} className="content-quote">
              <i className="bx bxs-quote-left content-quote-icon" aria-hidden="true" />
              <div>
                {block.text.split("\n").map((line, lIdx) => (
                  <p key={lIdx} className="content-quote-line">
                    {renderInlineFormatted(line)}
                  </p>
                ))}
              </div>
            </blockquote>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="content-bullet-list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineFormatted(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="content-numbered-list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineFormatted(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={idx} className="content-paragraph">
            {block.text.split("\n").map((line, lIdx, arr) => (
              <span key={lIdx}>
                {renderInlineFormatted(line)}
                {lIdx < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function WordTextEditor({ name = "content", placeholder, required, defaultValue = "" }) {
  const [content, setContent] = useState(defaultValue);
  const [mode, setMode] = useState("write");
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const form = textarea.closest("form");
    if (!form) return;
    const onSubmit = () => {
      setMode("write");
    };
    const onReset = () => {
      setContent("");
      setMode("write");
    };
    form.addEventListener("submit", onSubmit);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("reset", onReset);
    };
  }, []);

  const updateContent = (newText, newStart, newEnd) => {
    setContent(newText);
    const textarea = textareaRef.current;
    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) {
        setter.call(textarea, newText);
      } else {
        textarea.value = newText;
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      if (newStart !== undefined && newEnd !== undefined) {
        requestAnimationFrame(() => {
          if (document.activeElement === textarea) {
            textarea.setSelectionRange(newStart, newEnd);
          }
        });
      }
    }
  };

  const applyFormat = (action) => {
    if (mode === "preview") setMode("write");
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    const selected = val.substring(start, end);

    let replacement = "";
    let selStartOffset = 0;
    let selLength = 0;

    switch (action) {
      case "bold":
        if (selected.startsWith("**") && selected.endsWith("**") && selected.length >= 4) {
          replacement = selected.slice(2, -2);
        } else {
          const t = selected || "bold text";
          replacement = `**${t}**`;
          selStartOffset = 2;
          selLength = t.length;
        }
        break;

      case "italic":
        if (selected.startsWith("*") && selected.endsWith("*") && selected.length >= 2) {
          replacement = selected.slice(1, -1);
        } else {
          const t = selected || "italic text";
          replacement = `*${t}*`;
          selStartOffset = 1;
          selLength = t.length;
        }
        break;

      case "underline":
        if (selected.startsWith("<u>") && selected.endsWith("</u>") && selected.length >= 7) {
          replacement = selected.slice(3, -4);
        } else {
          const t = selected || "underlined text";
          replacement = `<u>${t}</u>`;
          selStartOffset = 3;
          selLength = t.length;
        }
        break;

      case "strikethrough":
        if (selected.startsWith("~~") && selected.endsWith("~~") && selected.length >= 4) {
          replacement = selected.slice(2, -2);
        } else {
          const t = selected || "strikethrough text";
          replacement = `~~${t}~~`;
          selStartOffset = 2;
          selLength = t.length;
        }
        break;

      case "highlight":
        if (selected.startsWith("==") && selected.endsWith("==") && selected.length >= 4) {
          replacement = selected.slice(2, -2);
        } else {
          const t = selected || "highlighted text";
          replacement = `==${t}==`;
          selStartOffset = 2;
          selLength = t.length;
        }
        break;

      case "h1":
      case "h2":
      case "h3": {
        const prefix = action === "h1" ? "# " : action === "h2" ? "## " : "### ";
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEndRel = val.slice(lineStart).indexOf("\n");
        const lineEnd = lineEndRel === -1 ? val.length : lineStart + lineEndRel;
        const currentLine = val.slice(lineStart, lineEnd);
        const clean = currentLine.replace(/^#{1,6}\s*/, "");
        const newLine = prefix + clean;
        const nextVal = val.slice(0, lineStart) + newLine + val.slice(lineEnd);
        updateContent(nextVal, lineStart + newLine.length, lineStart + newLine.length);
        return;
      }

      case "bullet":
      case "numbered":
      case "quote": {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEndRel = val.slice(end).indexOf("\n");
        const lineEnd = lineEndRel === -1 ? val.length : end + lineEndRel;
        const targetLines = val.slice(lineStart, lineEnd).split("\n");
        const formatted = targetLines
          .map((line, idx) => {
            const clean = line.replace(/^(\s*)([-*•]|\d+[.)]|>)\s*/, "$1");
            if (action === "bullet") return `• ${clean || "List item"}`;
            if (action === "numbered") return `${idx + 1}. ${clean || "Step item"}`;
            if (action === "quote") return `> ${clean || "Inspiring scripture or reflection quote"}`;
            return clean;
          })
          .join("\n");
        const nextVal = val.slice(0, lineStart) + formatted + val.slice(lineEnd);
        updateContent(nextVal, lineStart, lineStart + formatted.length);
        return;
      }

      case "link": {
        const url = window.prompt("Enter web link URL (e.g. https://sda.org):", "https://");
        if (!url) return;
        const t = selected || "link title";
        replacement = `[${t}](${url})`;
        selStartOffset = 1;
        selLength = t.length;
        break;
      }

      case "divider": {
        replacement = `\n\n---\n\n`;
        selStartOffset = replacement.length;
        selLength = 0;
        break;
      }

      case "scripture": {
        replacement = `\n> "Thy word is a lamp unto my feet, and a light unto my path."\n> — Psalm 119:105\n\n`;
        selStartOffset = 3;
        selLength = 65;
        break;
      }

      case "clear": {
        replacement = selected
          .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
          .replace(/\*\*(.*?)\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/<u>(.*?)<\/u>/gi, "$1")
          .replace(/~~(.*?)~~/g, "$1")
          .replace(/==(.*?)==/g, "$1")
          .replace(/^#{1,6}\s*/gm, "")
          .replace(/^>\s?/gm, "")
          .replace(/^[-*•]\s*/gm, "")
          .replace(/^\d+[.)]\s*/gm, "")
          .replace(/\[(.*?)\]\([^)]+\)/g, "$1");
        selStartOffset = 0;
        selLength = replacement.length;
        break;
      }

      default:
        return;
    }

    const nextVal = val.slice(0, start) + replacement + val.slice(end);
    const newStart = start + selStartOffset;
    const newEnd = selected ? start + replacement.length : newStart + selLength;
    updateContent(nextVal, newStart, newEnd);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      continueListOnEnter(e);
      return;
    }
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod) {
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        applyFormat("bold");
      } else if (key === "i") {
        e.preventDefault();
        applyFormat("italic");
      } else if (key === "u") {
        e.preventDefault();
        applyFormat("underline");
      } else if (key === "k") {
        e.preventDefault();
        applyFormat("link");
      } else if (key === "x" && e.shiftKey) {
        e.preventDefault();
        applyFormat("strikethrough");
      } else if (key === "h" && e.shiftKey) {
        e.preventDefault();
        applyFormat("highlight");
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      if (e.shiftKey) {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        if (val.startsWith("  ", lineStart)) {
          const nextVal = val.slice(0, lineStart) + val.slice(lineStart + 2);
          updateContent(nextVal, Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
        }
      } else {
        const nextVal = val.slice(0, start) + "  " + val.slice(end);
        updateContent(nextVal, start + 2, start + 2);
      }
    }
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const readMins = Math.max(1, Math.ceil(words / 180));

  return (
    <div className="word-editor-wrapper">
      {/* MS Word Ribbon Header */}
      <div className="word-editor-ribbon">
        <div className="word-ribbon-title">
          <i className="bx bxs-file-doc word-ribbon-icon" />
          <span className="word-ribbon-brand">Word Styles</span>
        </div>

        <div className="word-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "write"}
            className={`word-mode-tab ${mode === "write" ? "is-active" : ""}`}
            onClick={() => setMode("write")}
          >
            <i className="bx bx-edit-alt" /> Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={`word-mode-tab ${mode === "preview" ? "is-active" : ""}`}
            onClick={() => setMode("preview")}
          >
            <i className="bx bx-show" /> Preview
          </button>
        </div>
      </div>

      {/* MS Word Formatting Toolbar */}
      <div className="word-editor-toolbar" role="toolbar" aria-label="Word text formatting">
        {/* Style / Headings Group */}
        <div className="word-tool-group">
          <button
            type="button"
            className="word-tool-btn font-style"
            title="Heading 1 — Main Title (#)"
            onClick={() => applyFormat("h1")}
          >
            <span className="word-btn-badge">H1</span>
          </button>
          <button
            type="button"
            className="word-tool-btn font-style"
            title="Heading 2 — Section Subtitle (##)"
            onClick={() => applyFormat("h2")}
          >
            <span className="word-btn-badge">H2</span>
          </button>
          <button
            type="button"
            className="word-tool-btn font-style"
            title="Heading 3 — Subsection (###)"
            onClick={() => applyFormat("h3")}
          >
            <span className="word-btn-badge">H3</span>
          </button>
        </div>

        <span className="word-tool-separator" />

        {/* Font Styling Group */}
        <div className="word-tool-group">
          <button
            type="button"
            className="word-tool-btn font-bold"
            title="Bold (Ctrl+B)"
            onClick={() => applyFormat("bold")}
          >
            <i className="bx bx-bold" />
          </button>
          <button
            type="button"
            className="word-tool-btn font-italic"
            title="Italic (Ctrl+I)"
            onClick={() => applyFormat("italic")}
          >
            <i className="bx bx-italic" />
          </button>
          <button
            type="button"
            className="word-tool-btn font-underline"
            title="Underline (Ctrl+U)"
            onClick={() => applyFormat("underline")}
          >
            <i className="bx bx-underline" />
          </button>
          <button
            type="button"
            className="word-tool-btn"
            title="Strikethrough (Ctrl+Shift+X)"
            onClick={() => applyFormat("strikethrough")}
          >
            <i className="bx bx-strikethrough" />
          </button>
          <button
            type="button"
            className="word-tool-btn tool-highlight"
            title="Highlight text (Ctrl+Shift+H)"
            onClick={() => applyFormat("highlight")}
          >
            <i className="bx bx-highlight" />
          </button>
        </div>

        <span className="word-tool-separator" />

        {/* Paragraph & List Group */}
        <div className="word-tool-group">
          <button
            type="button"
            className="word-tool-btn"
            title="Bulleted List (•)"
            onClick={() => applyFormat("bullet")}
          >
            <i className="bx bx-list-ul" />
          </button>
          <button
            type="button"
            className="word-tool-btn"
            title="Numbered List (1.)"
            onClick={() => applyFormat("numbered")}
          >
            <i className="bx bx-list-ol" />
          </button>
          <button
            type="button"
            className="word-tool-btn"
            title="Scripture / Quote block (>)"
            onClick={() => applyFormat("quote")}
          >
            <i className="bx bx-quote-left" />
          </button>
        </div>

        <span className="word-tool-separator" />

        {/* Insert & Actions Group */}
        <div className="word-tool-group">
          <button
            type="button"
            className="word-tool-btn"
            title="Insert Web Link (Ctrl+K)"
            onClick={() => applyFormat("link")}
          >
            <i className="bx bx-link" />
          </button>
          <button
            type="button"
            className="word-tool-btn"
            title="Insert Horizontal Divider (---)"
            onClick={() => applyFormat("divider")}
          >
            <i className="bx bx-minus" />
          </button>
          <button
            type="button"
            className="word-tool-btn"
            title="Insert Scripture Quote Template"
            onClick={() => applyFormat("scripture")}
          >
            <i className="bx bx-book-open" />
          </button>
          <button
            type="button"
            className="word-tool-btn"
            title="Clear Formatting on selection"
            onClick={() => applyFormat("clear")}
          >
            <i className="bx bx-eraser" />
          </button>
        </div>
      </div>

      {/* Editor Surface */}
      <div className="word-editor-body">
        {/* Write View */}
        <div style={{ display: mode === "write" ? "block" : "none" }}>
          <textarea
            ref={textareaRef}
            name={name}
            className="word-editor-textarea"
            placeholder={placeholder}
            required={required}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const field = e.currentTarget;
              field.style.height = "auto";
              field.style.height = `${Math.max(160, field.scrollHeight)}px`;
            }}
          />
        </div>

        {/* Preview View (Word Document Paper View) */}
        {mode === "preview" && (
          <div className="word-editor-preview">
            <div className="word-preview-header">
              <span className="word-preview-badge">
                <i className="bx bx-file" /> Document Preview
              </span>
              <span className="word-preview-hint">Rendered with Word styling</span>
            </div>
            <div className="word-preview-page">
              {content.trim() ? (
                <FormattedContent text={content} />
              ) : (
                <p className="word-preview-empty">Your formatted article preview will appear here...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MS Word Bottom Status Bar */}
      <div className="word-editor-statusbar">
        <div className="word-status-metrics">
          <span className="word-status-item">
            <i className="bx bx-file" /> Page 1
          </span>
          <span className="word-status-divider">•</span>
          <span className="word-status-item">
            <strong>{words}</strong> {words === 1 ? "word" : "words"}
          </span>
          <span className="word-status-divider">•</span>
          <span className="word-status-item">
            <strong>{chars}</strong> characters
          </span>
          <span className="word-status-divider">•</span>
          <span className="word-status-item">
            ~{readMins} min read
          </span>
        </div>
        <div className="word-status-shortcuts" title="Keyboard shortcuts: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline)">
          <i className="bx bx-command" />
          <span className="word-shortcut-tip">Shortcuts: Ctrl+B, Ctrl+I, Ctrl+U</span>
        </div>
      </div>
    </div>
  );
}

function Announcements() {
  const [items, setItems] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const handleShare = async (item) => {
    const url = `${window.location.origin}/announcements.html`;
    const title = item.title || "Church Announcement";
    const text = item.content ? (item.content.length > 200 ? `${item.content.slice(0, 197)}...` : item.content) : title;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${title}\n\n${item.content || ""}\n\nRead more: ${url}`);
      setCopiedId(item.id || item.title);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      window.prompt("Copy link to share:", url);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/announcements", {
          cache: "no-store",
        });
        if (response.ok) {
          const announcements = await response.json();
          setItems(Array.isArray(announcements) ? announcements : []);
          return;
        }
      } catch {}
      const saved = readJson(announcementsKey, []);
      if (saved.length) {
        setItems(saved.slice().reverse());
        return;
      }
      try {
        const response = await fetch("/data/announcements.json");
        setItems(response.ok ? await response.json() : []);
      } catch {
        setItems([]);
      }
    })();
  }, []);
  return (
    <PublicShell>
      <section className="ann-sect">
        <h1>Announcements</h1>
        <div className="ann-list">
          {items.length ? (
            items.map((item) => (
              <article className="announcement" key={item.id || item.title}>
                <h3>{item.title}</h3>
                {item.date && <time>{item.date}</time>}
                <FormattedContent text={item.content} />
                <div className="announcement-footer">
                  <button
                    type="button"
                    className="share-btn"
                    aria-label={`Share ${item.title}`}
                    onClick={() => handleShare(item)}
                  >
                    <i className={`bx ${copiedId === (item.id || item.title) ? "bx-check text-success" : "bx-share-alt"}`} />
                    <span>{copiedId === (item.id || item.title) ? "Link Copied!" : "Share"}</span>
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p>No announcements yet.</p>
          )}
        </div>
      </section>
    </PublicShell>
  );
}

const givingDetails = {
  paybill: "247247",
  account: "563833",
};

function Giving() {
  const [copied, setCopied] = useState("");

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt(`Copy the ${label}:`, value);
      return;
    }
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <PublicShell>
      <main className="giving-page">
        <section className="giving-intro">
          <span className="eyebrow">Give</span>
          <h1>
            Partner with us in
            <br />
            <em>God's work.</em>
          </h1>
          <p>
            Your generous offering supports worship, discipleship, outreach and
            the many ministries of Kerugoya Main SDA Church. Thank you for
            partnering with us.
          </p>
        </section>

        <section className="giving-details">
          <h2 className="section-title">Give via M-Pesa</h2>
          <div className="giving-cards">
            {[
              ["Paybill Number", givingDetails.paybill],
              ["Account Number", givingDetails.account],
            ].map(([label, value]) => (
              <div className="giving-card" key={label}>
                <span className="giving-label">{label}</span>
                <strong className="giving-value">{value}</strong>
                <button
                  className="giving-copy"
                  type="button"
                  onClick={() => copy(label, value)}
                  aria-label={`Copy ${label.toLowerCase()}`}
                >
                  <i
                    className={`bx ${
                      copied === label ? "bx-check text-success" : "bx-copy"
                    }`}
                  />
                  <span>{copied === label ? "Copied" : "Copy"}</span>
                </button>
              </div>
            ))}
          </div>

          <div className="giving-steps">
            <h3>How to give</h3>
            <ol>
              <li>
                On your phone, open the M-Pesa menu and choose{" "}
                <strong>Lipa na Mpesa</strong>.
              </li>
              <li>
                Select <strong>Paybill</strong>.
              </li>
              <li>
                Enter the paybill number <strong>{givingDetails.paybill}</strong>.
              </li>
              <li>
                Enter the account number <strong>{givingDetails.account}</strong>.
              </li>
              <li>Enter the amount, confirm the details and enter your PIN.</li>
            </ol>
            <p className="giving-note">
              <i className="bx bx-info-circle" /> Please confirm the details
              before completing your payment. For other giving options, contact
              the church office.
            </p>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

const responsivePages = {
  leaders: {
    title: "Church leaders",
    eyebrow: "Leadership",
    body: "Meet the people who serve Kerugoya Main SDA Church with prayer, care, and steady leadership.",
  },
  program: {
    title: "Church program",
    eyebrow: "Gatherings",
    body: "Find a place to worship, learn, serve, and grow with the church family throughout the week.",
  },
  prayer: {
    title: "Prayer ministry",
    eyebrow: "Prayer",
    body: "Share a prayer need with the church family. Every request is treated with care and brought before God.",
  },
  feedback: {
    title: "Share feedback",
    eyebrow: "Your voice matters",
    body: "Help us make the church experience more welcoming, useful, and connected for everyone.",
  },
  contact: {
    title: "Contact the church",
    eyebrow: "We are here to help",
    body: "Reach the Kerugoya Main SDA Church team for questions, prayer, and ministry information.",
  },
};

function ResponsivePage({ page }) {
  const content = responsivePages[page];
  const isFormPage = page === "prayer" || page === "feedback";
  const isProgramPage = page === "program";
  const isLeadersPage = page === "leaders";
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState("anonymous");
  const [program, setProgram] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [leadersLoading, setLeadersLoading] = useState(isLeadersPage);
  const [leadersError, setLeadersError] = useState("");
  const [programLoading, setProgramLoading] = useState(isProgramPage);
  const endpoint = page === "prayer" ? "/api/prayer-requests" : "/api/feedback";

  useEffect(() => {
    if (!isProgramPage) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/program", { cache: "no-store" });
        if (response.ok && active) setProgram(await response.json());
      } catch {
        // keep default state
      } finally {
        if (active) setProgramLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isProgramPage]);

  useEffect(() => {
    if (!isLeadersPage) return;
    let active = true;
    setLeadersLoading(true);
    setLeadersError("");
    (async () => {
      try {
        const response = await fetch("/api/leaders", { cache: "no-store" });
        if (!response.ok) throw new Error("We could not load the church leaders.");
        const data = await response.json();
        if (active) setLeaders(Array.isArray(data) ? data : []);
      } catch (error) {
        if (active) setLeadersError(error.message || "We could not load the church leaders.");
      } finally {
        if (active) setLeadersLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isLeadersPage]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          message: data.get("message"),
          visibility,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setMessage(result.error || "We could not send your message. Please try again.");
        return;
      }
      setMessage(
        page === "prayer"
          ? "Your prayer request has been sent to the church team."
          : "Thank you for your feedback. It has been sent to the church team."
      );
      event.currentTarget.reset();
    } catch {
      setMessage("We could not connect. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <PublicShell>
      <main className={`responsive-page ${isLeadersPage ? "leaders-page" : ""}`}>
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.body}</p>
        {isProgramPage ? (
          programLoading ? (
            <p className="admin-empty-state">Loading program…</p>
          ) : (
            <>
              <article className="program-preview">
                <h2>{program?.title || "Church Program"}</h2>
                <div className="program-body">
                  {(program?.body || "").split("\n").map((line, index) => (
                    <p key={index} className="program-line">{line || "\u00A0"}</p>
                  ))}
                </div>
              </article>
              <a className="btn" href="/api/program/pdf" target="_blank" rel="noopener noreferrer">
                Download program as PDF <i className="bx bx-file-pdf" />
              </a>
            </>
          )
        ) : isLeadersPage ? (
          leadersLoading ? (
            <p className="admin-empty-state">Loading church leaders…</p>
          ) : leadersError ? (
            <p className="leader-load-error" role="alert">{leadersError}</p>
          ) : leaders.length ? (
            <div className="leader-grid">
              {leaders.map((leader) => (
                <article className="leader-card" key={leader.id}>
                  {leader.imageUrl ? (
                    <img className="leader-card-image" src={leader.imageUrl} alt={leader.name} loading="lazy" />
                  ) : (
                    <div className="leader-card-placeholder" aria-hidden="true">
                      <i className="bx bx-user" />
                    </div>
                  )}
                  <div className="leader-card-content">
                    <h2>{leader.name}</h2>
                    <p className="leader-card-role">{leader.role}</p>
                    {leader.description && <p className="leader-card-description">{leader.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="admin-empty-state">Church leader profiles will be added soon.</p>
          )
        ) : isFormPage ? (
          <form className="responsive-form" onSubmit={submit}>
            <label>
              Your name
              <input name="name" type="text" placeholder="Optional — leave blank to stay anonymous" />
            </label>
            <label>
              Your message
              <textarea name="message" rows="5" required />
            </label>
            <label className="responsive-visibility">
              Share this
              <select
                name="visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="anonymous">Anonymously</option>
                <option value="public">Publicly</option>
              </select>
            </label>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send message"} <i className="bx bx-send" />
            </button>
            {message && <p className="form-message">{message}</p>}
          </form>
        ) : (
          <a className="btn" href="tel:+25496563833">Call the church <i className="bx bx-phone" /></a>
        )}
      </main>
    </PublicShell>
  );
}

function BottomNav({ route, communityCount = 0 }) {
  const onCommunity = route === "/blogs" || route === "/community";
  return (
    <nav className="community-bottom-nav">
      <ul className="nav-links">
        {links.map(([href, icon, label]) => {
          const active = isLinkActive(href, route);
          const badge =
            label === "Community" && !onCommunity ? (
              <NavBadge count={communityCount} label="community stories" />
            ) : null;
          return (
            <li key={href}>
              <Link
                href={href}
                className={active ? "active is-active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <i className={`bx ${icon}`} />
                <span>{label}</span>
                {badge}
              </Link>
            </li>
          );
          })}
      </ul>
    </nav>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function Community() {
  const [session, setSession] = useState(null);
  const user = session?.user || null;
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("recent");
  const [openComments, setOpenComments] = useState(null);
  const [communityMessage, setCommunityMessage] = useState("");
  const [feedLoading, setFeedLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [sharingId, setSharingId] = useState(null);
  const [sharedId, setSharedId] = useState(null);
  const route = useRoute();
  const { announcements: announcementCount, community: communityCount } =
    useUnreadCounts(route);

  const handleShare = async (post) => {
    setSharingId(post.id);
    setCommunityMessage("");
    try {
      const blob = await renderPostImage(post);
      if (!blob) throw new Error("The story image could not be created.");
      const filename = `kerugoya-community-story-${post.id}.png`;
      const files = [new File([blob], filename, { type: "image/png" })];
      const attachedMedia = [
        ...(post.coverPhoto
          ? [{ url: post.coverPhoto, name: "story-cover" }]
          : []),
        ...(Array.isArray(post.media) ? post.media : []),
      ];
      for (const media of attachedMedia) {
        const response = await fetch(media.url);
        if (!response.ok) throw new Error(`Could not load ${media.name || "story media"} for sharing.`);
        const mediaBlob = await response.blob();
        let safeName = String(media.name || "story-media").replace(/[^\w.-]+/g, "-");
        if (!/\.[a-z0-9]{2,5}$/i.test(safeName)) {
          const extensionByType = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "video/mp4": ".mp4",
            "video/webm": ".webm",
          };
          safeName += extensionByType[mediaBlob.type] || "";
        }
        files.push(new File([mediaBlob], safeName, { type: mediaBlob.type }));
      }
      const title = post.title || "Community Story";

      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({
          files,
          title,
          text: `${title} — a community story from Kerugoya Main SDA Church.`,
        });
      } else {
        files.forEach((file) => {
          const href = URL.createObjectURL(file);
          const link = document.createElement("a");
          link.href = href;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(href), 2000);
        });
      }
      setSharedId(post.id);
      setTimeout(() => setSharedId(null), 2500);
    } catch (err) {
      if (err?.name !== "AbortError") {
        setCommunityMessage(
          err?.message || "The story image could not be shared right now.",
        );
      }
    } finally {
      setSharingId(null);
    }
  };

  useEffect(() => {
    let active = true;
    localStorage.removeItem("keruMemberSession");
    const loadPosts = async (firebaseUser) => {
      try {
        let headers = {};
        if (firebaseUser?.emailVerified) {
          headers = await getFirebaseAuthHeaders(firebaseUser);
          const memberResponse = await fetch("/api/members/me", { headers });
          const memberResult = await memberResponse.json().catch(() => ({}));
          if (!memberResponse.ok) {
            throw new Error(memberResult.error || "Your member profile could not be loaded.");
          }
          if (active) setSession({ firebaseUser, user: memberResult.member });
        } else if (active) {
          setSession(null);
        }
        const response = await fetch("/api/community/posts", { headers });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Unable to load stories.");
        if (active) setPosts(Array.isArray(result) ? result : []);
      } catch (error) {
        if (active) {
          setSession(null);
          setCommunityMessage(error.message || "Stories could not be loaded. Check your connection and try again.");
        }
      } finally {
        if (active) setFeedLoading(false);
      }
    };

    if (!firebaseAuth) {
      void loadPosts(null);
      return () => { active = false; };
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      void loadPosts(firebaseUser);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const visible = posts
    .filter((post) => category === "All" || post.category === category)
    .sort((a, b) =>
      sort === "liked" ? (b.likes || 0) - (a.likes || 0) : new Date(b.date) - new Date(a.date),
    );

  const replacePost = (updatedPost) => {
    setPosts((current) => current.map((post) => post.id === updatedPost.id ? updatedPost : post));
  };

  const like = async (post) => {
    if (!session?.firebaseUser) {
      navigate("/login.html");
      return;
    }
    setCommunityMessage("");
    try {
      const response = await fetch(`/api/community/posts/${post.id}/like`, {
        method: "PUT",
        headers: await getFirebaseAuthHeaders(session.firebaseUser),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update your reaction.");
      replacePost(result.post);
    } catch (error) {
      setCommunityMessage(error.message || "Could not update your reaction.");
    }
  };

  const addComment = async (event, post) => {
    event.preventDefault();
    if (!session?.firebaseUser) {
      navigate("/login.html");
      return;
    }
    const form = event.currentTarget;
    const content = new FormData(form).get("comment").trim();
    if (!content) return;
    try {
      const response = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST",
        headers: await getFirebaseAuthHeaders(session.firebaseUser, { "Content-Type": "application/json" }),
        body: JSON.stringify({ content }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not add your comment.");
      replacePost(result.post);
      form.reset();
      setOpenComments(post.id);
      setCommunityMessage("");
    } catch (error) {
      setCommunityMessage(error.message || "Could not add your comment.");
    }
  };

  const deletePost = async (post) => {
    if (!window.confirm("Are you sure you want to delete your story?")) return;
    setCommunityMessage("");
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
        headers: await getFirebaseAuthHeaders(session.firebaseUser),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete your story.");
      }
      setPosts((current) => current.filter((p) => p.id !== post.id));
      setCommunityMessage("Your story has been deleted.");
    } catch (error) {
      setCommunityMessage(error.message || "Could not delete your story.");
    }
  };

  const publish = async (event) => {
    event.preventDefault();
    if (!session?.firebaseUser) {
      navigate("/login.html");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      title: data.get("title").trim(),
      content: data.get("content").trim(),
      category: data.get("category"),
    };
    setPosting(true);
    setCommunityMessage("");
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: await getFirebaseAuthHeaders(session.firebaseUser, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Your story could not be published.");
      setPosts((current) => [result.post, ...current]);
      form.reset();
      setCommunityMessage("Your story has been published.");
    } catch (error) {
      setCommunityMessage(error.message || "Your story could not be published.");
    } finally {
      setPosting(false);
    }
  };
  return (
    <div className="community-page">
      <header className="community-header">
        <nav className="community-nav">
          <Link className="logo" href="/">
            <img src={imagePath} alt="Seventh-day Adventist Logo" />
            <span>Kerugoya Main SDA</span>
          </Link>
          <div className="community-actions">
            <Link
              className="icon-link"
              href="/announcements.html"
              title="Announcements"
            >
              <i className="bx bx-bell" />
              <NavBadge count={announcementCount} label="announcements" />
            </Link>
            <span className="member-name">
              {user ? `Hi, ${user.name.split(" ")[0]}` : "Guest reader"}
            </span>
            {user ? (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  (async () => {
                    try {
                      if (firebaseAuth) await signOut(firebaseAuth);
                      setSession(null);
                    } catch (error) {
                      setCommunityMessage(error.message || "Could not sign out. Please try again.");
                    }
                  })();
                }}
              >
                Sign out
              </button>
            ) : (
              <Link className="text-button" href="/login.html">
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="community-main">
        <section className="community-intro">
          <div>
            <span className="eyebrow">The church beyond Today</span>
            <h1>
              Stories worth
              <br />
              <em>sharing.</em>
            </h1>
            <p>
              A warm corner for reflections, questions, encouragement, and the
              everyday ways our community is living faith.
            </p>
            <a className="btn article-link" href="#submit-article">
              Submit an article <i className="bx bx-edit-alt" />
            </a>
          </div>
          <div className="intro-stat">
            <strong>{posts.length}</strong>
            <span>
              community
              <br />
              stories
            </span>
          </div>
        </section>
        <section className="community-layout">
          <div className="feed-column">
            <div className="feed-toolbar">
              <div
                className="filter-tabs"
                role="tablist"
                aria-label="Filter posts"
              >
                {["All", "Faith", "Life", "Service"].map((item) => (
                  <button
                    className={`filter-tab ${category === item ? "is-active" : ""}`}
                    data-category={item}
                    type="button"
                    role="tab"
                    aria-selected={category === item}
                    key={item}
                    onClick={() => setCategory(item)}
                  >
                    {item === "All" ? "All stories" : item}
                  </button>
                ))}
              </div>
              <div className="feed-toolbar-end">
                <span className="feed-count" aria-live="polite">
                  {visible.length} {visible.length === 1 ? "story" : "stories"}
                </span>
                <label className="sort-control">
                  <i className="bx bx-sort-alt" aria-hidden="true" />
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    aria-label="Sort posts"
                  >
                    <option value="recent">Most recent</option>
                    <option value="liked">Most loved</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="posts-list">
              {feedLoading ? (
                <div className="post-skeletons" aria-hidden="true">
                  {[0, 1, 2].map((item) => (
                    <div className="post-card post-skeleton" key={item}>
                      <span className="skeleton-line skeleton-tag" />
                      <span className="skeleton-line skeleton-title" />
                      <span className="skeleton-line" />
                      <span className="skeleton-line" />
                      <span className="skeleton-line skeleton-short" />
                    </div>
                  ))}
                </div>
              ) : visible.length ? (
                visible.map((post) => (
                  <article
                    className={`post-card ${openComments === post.id ? "comments-open" : ""}`}
                    key={post.id}
                  >
                    <div className="post-meta">
                      <span className="post-category">{post.category}</span>
                      <time dateTime={post.date}>
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(`${post.date}T12:00:00`))}
                      </time>
                    </div>
                    <h2>{post.title}</h2>
                    {post.coverPhoto && (
                      <img className="post-cover-photo" src={post.coverPhoto} alt={`Cover photo for ${post.title}`} />
                    )}
                    <FormattedContent text={post.content} />
                    {!!post.media?.length && (
                      <div className="post-media">
                        {post.media.map((media, index) =>
                          media.type?.startsWith("video/") ? (
                            <video key={`${post.id}-media-${index}`} controls preload="metadata">
                              <source src={media.url} type={media.type} />
                              Your browser does not support this video.
                            </video>
                          ) : (
                            <img
                              key={`${post.id}-media-${index}`}
                              src={media.url}
                              alt={media.name || `Story image ${index + 1}`}
                              loading="lazy"
                            />
                          ),
                        )}
                      </div>
                    )}
                    <div className="post-footer">
                      <span className="post-author">
                        <span className="post-avatar" aria-hidden="true">
                          {(post.author || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="post-author-name">{post.author}</span>
                      </span>
                      <div className="post-actions">
                        <button
                          className={`like-button ${user && post.likedByMe ? "is-liked" : ""}`}
                          data-action="like"
                          type="button"
                          aria-pressed={Boolean(user && post.likedByMe)}
                          aria-label={`Like ${post.title}`}
                          onClick={() => like(post)}
                        >
                          <i className="bx bx-heart" />
                          <span>{post.likes}</span>
                        </button>
                        <button
                          className="comment-toggle"
                          type="button"
                          aria-expanded={openComments === post.id}
                          aria-label={`Comments on ${post.title}`}
                          onClick={() =>
                            setOpenComments(
                              openComments === post.id ? null : post.id,
                            )
                          }
                        >
                          <i className="bx bx-message-rounded" />
                          <span>{post.comments.length}</span>
                        </button>
                        <button
                          className="share-btn"
                          type="button"
                          disabled={sharingId === post.id}
                          aria-label={`Share ${post.title} with its media`}
                          title="Share this story and its media"
                          onClick={() => handleShare(post)}
                        >
                          {sharingId === post.id ? (
                            <>
                              <i className="bx bx-loader-alt bx-spin" />
                              <span>Preparing</span>
                            </>
                          ) : (
                            <>
                              <i
                                className={`bx ${sharedId === post.id ? "bx-check text-success" : "bx-share-alt"}`}
                              />
                              <span>{sharedId === post.id ? "Ready" : "Share"}</span>
                            </>
                          )}
                        </button>
                        {user && (post.memberId === user.id || post.author === user.name) && (
                          <button
                            className="icon-button post-delete-button"
                            type="button"
                            aria-label="Delete your story"
                            title="Delete your story"
                            onClick={() => deletePost(post)}
                          >
                            <i className="bx bx-trash" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="comments">
                      {post.comments.map((comment, index) => (
                        <div className="comment" key={`${post.id}-${index}`}>
                          <strong>{comment.author}</strong>
                          <span>{comment.content}</span>
                        </div>
                      ))}
                      <form
                        className="comment-form"
                        onSubmit={(event) => addComment(event, post)}
                      >
                        <input
                          name="comment"
                          type="text"
                          maxLength="240"
                          placeholder="Add to the conversation..."
                          required
                        />
                        <button type="submit" aria-label="Post comment">
                          <i className="bx bx-send" />
                        </button>
                      </form>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <i className="bx bx-message-rounded-dots" aria-hidden="true" />
                  <h3>No stories in this category yet</h3>
                  <p>Be the first to share one with the community.</p>
                </div>
              )}
            </div>
          </div>
          <aside className="community-sidebar">
            <section className="compose-card" id="submit-article">
              <span className="eyebrow">Community submissions</span>
              <h2>Submit an article</h2>
              <p>
                Share a reflection, lesson, or small piece of joy with the
                church family.
              </p>
              {user ? (
                <form id="post-form" onSubmit={publish}>
                  <input
                    name="title"
                    type="text"
                    placeholder="Give your story a title"
                    maxLength="80"
                    required
                  />
                  <select name="category" aria-label="Story category">
                    <option>Faith</option>
                    <option>Life</option>
                    <option>Service</option>
                  </select>
                  <WordTextEditor
                    name="content"
                    placeholder="Start writing your reflection, testimony, or story... Use the Word toolbar above or Ctrl+B / Ctrl+I to format."
                    required
                  />
                  <button className="btn" type="submit" disabled={posting}>
                    {posting ? "Publishing…" : "Publish story"} <i className="bx bx-send" />
                  </button>
                  <p className="community-message" role="status">{communityMessage}</p>
                </form>
              ) : (
                <div className="member-submit-prompt">
                  <p>Sign in as a member to share your story with the church family.</p>
                  <Link className="btn" href="/login.html">
                    Sign in to submit <i className="bx bx-log-in" />
                  </Link>
                </div>
              )}
              {!user && <p className="community-message" role="status">{communityMessage}</p>}
            </section>
            <section className="community-aside-note">
              <i className="bx bx-quote-alt-left" />
              <p>“Encourage one another and build each other up.”</p>
              <span>1 Thessalonians 5:11</span>
            </section>
          </aside>
        </section>
      </main>
      <BottomNav route={route} communityCount={communityCount} />
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("error");
    try {
      const auth = requireFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      if (!credential.user.emailVerified) {
        await signOut(auth);
        throw new Error("Verify your email address before signing in to the admin portal.");
      }
      const token = await credential.user.getIdToken(true);
      const response = await fetch("/api/auth-check", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await signOut(auth);
        throw new Error(result.error || "This Firebase account is not authorized to access the admin portal.");
      }
      onLogin(token, result.email);
    } catch (error) {
      setMessage(error.message || "Could not sign in. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("Enter your email address above, then choose Forgot password.");
      setMessageType("error");
      document.getElementById("admin-email")?.focus();
      return;
    }

    setResetLoading(true);
    setMessage("");
    try {
      await sendPasswordResetEmail(requireFirebaseAuth(), normalizedEmail);
      setMessage("If an account exists for that email, Firebase has sent a password reset link.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message || "Could not send a password reset email. Please try again.");
      setMessageType("error");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <Link href="/">
            <img src={imagePath} alt="Kerugoya Main SDA" className="admin-login-logo" />
          </Link>
          <span className="admin-brand-subtitle">Church Management</span>
          <h1>Admin Portal</h1>
          <p>Sign in to manage announcements, sermons, program, and church members.</p>
        </div>

        {message && (
          <div className={`admin-alert is-${messageType}`} role={messageType === "error" ? "alert" : "status"}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <i className="bx bx-error-circle" style={{ fontSize: "1.2rem" }} />
              {message}
            </span>
            <button
              type="button"
              className="admin-alert-dismiss"
              onClick={() => setMessage("")}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={submit} className="admin-field" style={{ gap: "1.1rem" }}>
          <div className="admin-field">
            <label htmlFor="admin-email">Email address</label>
            <div className="admin-login-input-wrap">
              <i className="bx bx-user" />
              <input
                id="admin-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter admin email"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <div className="admin-login-input-wrap">
              <i className="bx bx-lock-alt" />
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-login-toggle-pw"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`bx ${showPassword ? "bx-hide" : "bx-show"}`} />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="admin-login-forgot-password"
            onClick={sendPasswordReset}
            disabled={loading || resetLoading}
          >
            {resetLoading ? "Sending reset link..." : "Forgot password?"}
          </button>

          <button
            className="admin-btn-primary"
            type="submit"
            disabled={loading || resetLoading}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            {loading ? (
              <>
                <i className="bx bx-loader-alt bx-spin" /> Signing in...
              </>
            ) : (
              <>
                Sign in to Dashboard <i className="bx bx-right-arrow-alt" />
              </>
            )}
          </button>
        </form>

        <div className="admin-login-footer">
          <Link href="/">
            <i className="bx bx-arrow-back" /> Back to Church Website
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ auth, username, onLogout }) {
  const [tab, setTab] = useState("announcements");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [prayerFilter, setPrayerFilter] = useState("all");

  const [announcements, setAnnouncements] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sermons, setSermons] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [prayerRequests, setPrayerRequests] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [visits, setVisits] = useState([]);
  const [program, setProgram] = useState({ title: "Church Program", body: "" });

  const [programSaving, setProgramSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [leaderImageData, setLeaderImageData] = useState("");
  const [removeLeaderImage, setRemoveLeaderImage] = useState(false);
  const [leaderCardPreview, setLeaderCardPreview] = useState(null);
  const [leaderCardBusy, setLeaderCardBusy] = useState(false);
  const [leaderCardMessage, setLeaderCardMessage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState(null);

  const tabListRef = useRef(null);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${auth}` };

  const TABS = [
    { id: "announcements", label: "Announcements", icon: "bx-megaphone", count: announcements.length },
    { id: "leaders", label: "Church Leaders", icon: "bx-group", count: leaders.length },
    { id: "prayer", label: "Prayer Requests", icon: "bx-pray", count: prayerRequests.length },
    { id: "feedback", label: "Feedback", icon: "bx-message-dots", count: feedback.length },
    { id: "program", label: "Church Program", icon: "bx-calendar", count: 0 },
    { id: "posts", label: "Community Stories", icon: "bx-conversation", count: posts.length },
    { id: "sermons", label: "Sermons", icon: "bx-video", count: sermons.length },
    { id: "users", label: "Active Members", icon: "bx-user-check", count: users.length },
    { id: "admins", label: "Administrators", icon: "bx-user-plus", count: admins.length },
    { id: "analytics", label: "Analytics", icon: "bx-bar-chart-alt-2", count: 0 },
  ];

  const load = async () => {
    try {
      const [
        announcementRes,
        leadersRes,
        sermonRes,
        adminRes,
        postsRes,
        usersRes,
        prayerRes,
        feedbackRes,
        programRes,
      ] = await Promise.all([
        fetch("/api/announcements", { cache: "no-store" }),
        fetch("/api/admin/leaders", { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" }),
        fetch("/api/sermons", { cache: "no-store" }),
        fetch("/api/admins", { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" }),
        fetch("/api/community/posts", { cache: "no-store" }),
        fetch("/api/admin/users", { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" }).catch(() => ({ ok: false })),
        fetch("/api/prayer-requests", { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" }).catch(() => ({ ok: false })),
        fetch("/api/feedback", { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" }).catch(() => ({ ok: false })),
        fetch("/api/program", { cache: "no-store" }).catch(() => ({ ok: false })),
      ]);

      if (adminRes.status === 401) {
        setMessage({ type: "error", text: "Admin session expired. Please sign out and sign in again." });
      }

      setAnnouncements(announcementRes.ok ? await announcementRes.json() : []);
      if (leadersRes.status === 401) {
        setMessage({ type: "error", text: "Admin session expired. Please sign out and sign in again." });
      } else if (!leadersRes.ok) {
        setMessage({ type: "error", text: "Could not load church leader profiles." });
      }
      setLeaders(leadersRes.ok ? await leadersRes.json() : []);
      setSermons(sermonRes.ok ? await sermonRes.json() : []);
      setAdmins(adminRes.ok ? await adminRes.json() : []);
      setPosts(postsRes.ok ? await postsRes.json() : []);
      setUsers(usersRes.ok ? await usersRes.json() : []);
      setPrayerRequests(prayerRes.ok ? await prayerRes.json() : []);
      setFeedback(feedbackRes.ok ? await feedbackRes.json() : []);
      if (programRes.ok) {
        const data = await programRes.json();
        setProgram({ title: data.title || "Church Program", body: data.body || "" });
      }
    } catch {
      setMessage({ type: "error", text: "Could not load dashboard data. Please check connection." });
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Track admin visits
  useEffect(() => {
    const recorded = JSON.parse(localStorage.getItem("admin_visits") || "[]");
    setVisits(recorded);
    const visit = {
      page: "Admin Dashboard",
      visitor: username || "Admin",
      at: new Date().toISOString(),
    };
    const updated = [...recorded, visit];
    localStorage.setItem("admin_visits", JSON.stringify(updated));
    setVisits(updated);
  }, [username]);

  // Center active tab on mobile horizontally scrolling bar
  useEffect(() => {
    const container = tabListRef.current;
    if (!container) return;
    const active = container.querySelector(".is-active");
    if (active) {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [tab]);

  // Reset search when tab changes
  useEffect(() => {
    setSearchQuery("");
  }, [tab]);

  const submit = async (event, endpoint, method = "POST") => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Request failed.");
      }
      form.reset();
      setMessage({ type: "success", text: "Saved successfully!" });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to save entry." });
    } finally {
      setSubmitting(false);
    }
  };

  const saveProgram = async (event) => {
    event.preventDefault();
    setProgramSaving(true);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const payload = {
      title: data.get("title"),
      body: data.get("body"),
    };
    try {
      const response = await fetch("/api/program", {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not save church program.");
      }
      const result = await response.json();
      setProgram({ title: result.title, body: result.body });
      setMessage({ type: "success", text: "Program saved! PDF download is now updated." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Could not save program." });
    } finally {
      setProgramSaving(false);
    }
  };

  const saveLeader = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      role: data.get("role"),
      description: data.get("description"),
      imageData: leaderImageData,
      removeImage: removeLeaderImage,
    };
    const endpoint = editingLeader ? `/api/leaders/${editingLeader.id}` : "/api/leaders";
    try {
      const response = await fetch(endpoint, {
        method: editingLeader ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not save church leader.");
      }
      setEditingLeader(null);
      setLeaderImageData("");
      setRemoveLeaderImage(false);
      form.reset();
      setMessage({ type: "success", text: "Church leader saved successfully." });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Could not save church leader." });
    } finally {
      setSubmitting(false);
    }
  };

  const editLeader = (leader) => {
    setEditingLeader(leader);
    setLeaderImageData("");
    setRemoveLeaderImage(false);
    setMessage(null);
  };

  const cancelLeaderEdit = () => {
    setEditingLeader(null);
    setLeaderImageData("");
    setRemoveLeaderImage(false);
  };

  const shareLeaderCard = async (downloadOnly = false) => {
    if (!leaderCardPreview || leaderCardBusy) return;
    setLeaderCardBusy(true);
    setLeaderCardMessage(null);
    try {
      const blob = await renderLeaderIdCard(leaderCardPreview);
      const filename = `kerugoya-leader-${String(leaderCardPreview.name || "profile")
        .trim()
        .toLowerCase()
        .replace(/[^\w-]+/g, "-")}-id-card.png`;
      const file = new File([blob], filename, { type: "image/png" });
      if (!downloadOnly && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${leaderCardPreview.name} — Church Leader ID`,
          text: `${leaderCardPreview.role} at Kerugoya Main SDA Church.`,
        });
        setLeaderCardMessage({ type: "success", text: "Leader ID card shared successfully." });
      } else {
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(href), 2000);
        setLeaderCardMessage({ type: "success", text: "Leader ID card downloaded as a PNG." });
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setLeaderCardMessage({ type: "error", text: error.message || "Could not create the leader ID card." });
      }
    } finally {
      setLeaderCardBusy(false);
    }
  };

  const selectLeaderImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ type: "error", text: "Choose a JPG, PNG, or WebP image." });
      event.target.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage({ type: "error", text: "Leader images must be no larger than 3 MB." });
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLeaderImageData(dataUrl);
      setRemoveLeaderImage(false);
      setMessage(null);
    } catch {
      setMessage({ type: "error", text: "Could not read the selected image." });
    }
  };

  const remove = async (endpoint, label = "item") => {
    if (!window.confirm(`Are you sure you want to delete this ${label}?`)) return;
    setDeletingId(endpoint);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (response.status === 401) {
        throw new Error("Admin session expired. Please sign out and sign in again.");
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete ${label}`);
      }
      // Optimistic state updates
      const id = endpoint.split("/").pop();
      if (endpoint.includes("/announcements/")) {
        setAnnouncements((prev) => prev.filter((a) => String(a.id) !== id));
      } else if (endpoint.includes("/community/posts/")) {
        setPosts((prev) => prev.filter((p) => String(p.id) !== id));
      } else if (endpoint.includes("/sermons/")) {
        setSermons((prev) => prev.filter((s) => String(s.id) !== id));
      } else if (endpoint.includes("/leaders/")) {
        setLeaders((prev) => prev.filter((leader) => String(leader.id) !== id));
        if (editingLeader?.id === id) cancelLeaderEdit();
      } else if (endpoint.includes("/admin/users/")) {
        setUsers((prev) => prev.filter((u) => String(u.sessionId) !== id));
      } else if (endpoint.includes("/admins/")) {
        setAdmins((prev) => prev.filter((a) => String(a.id) !== id));
      } else if (endpoint.includes("/prayer-requests/")) {
        setPrayerRequests((prev) => prev.filter((p) => String(p.id) !== id));
      } else if (endpoint.includes("/feedback/")) {
        setFeedback((prev) => prev.filter((f) => String(f.id) !== id));
      }
      setMessage({ type: "success", text: `Deleted ${label} successfully.` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error.message || `Could not delete ${label}.` });
    } finally {
      setDeletingId(null);
    }
  };

  // Analytics Helpers
  const topPage = () => {
    const counts = visits.reduce((acc, v) => {
      acc[v.page] = (acc[v.page] || 0) + 1;
      return acc;
    }, {});
    const entry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return entry ? { label: entry[0], count: entry[1] } : { label: "Dashboard", count: 0 };
  };

  const topVisitor = () => {
    const counts = visits.reduce((acc, v) => {
      acc[v.visitor] = (acc[v.visitor] || 0) + 1;
      return acc;
    }, {});
    const entry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return entry ? { label: entry[0], count: entry[1] } : { label: username || "Admin", count: 0 };
  };

  const clearAnalytics = () => {
    if (!visits.length) return;
    if (!window.confirm(`Clear all ${visits.length} analytics visit records stored in this browser? This cannot be undone.`)) {
      return;
    }
    try {
      localStorage.removeItem("admin_visits");
      setVisits([]);
      setMessage({ type: "success", text: "Analytics visit history cleared for this browser." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not clear analytics visit history from this browser.",
      });
    }
  };

  // Filtered Data Lists
  const q = searchQuery.toLowerCase().trim();

  const filteredAnnouncements = announcements.filter((a) =>
    !q ? true : (a.title && a.title.toLowerCase().includes(q)) || (a.content && a.content.toLowerCase().includes(q))
  );

  const filteredPrayerRequests = prayerRequests.filter((p) => {
    if (prayerFilter === "public" && p.visibility !== "public") return false;
    if (prayerFilter === "anonymous" && p.visibility === "public") return false;
    if (!q) return true;
    return (p.name && p.name.toLowerCase().includes(q)) || (p.message && p.message.toLowerCase().includes(q));
  });

  const filteredFeedback = feedback.filter((f) =>
    !q ? true : (f.name && f.name.toLowerCase().includes(q)) || (f.message && f.message.toLowerCase().includes(q))
  );

  const filteredPosts = posts.filter((p) =>
    !q
      ? true
      : (p.title && p.title.toLowerCase().includes(q)) ||
        (p.author && p.author.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.content && p.content.toLowerCase().includes(q))
  );

  const filteredSermons = sermons.filter((s) =>
    !q ? true : (s.title && s.title.toLowerCase().includes(q)) || (s.youtubeId && s.youtubeId.toLowerCase().includes(q))
  );

  const filteredLeaders = leaders.filter((leader) =>
    !q ||
    (leader.name && leader.name.toLowerCase().includes(q)) ||
    (leader.role && leader.role.toLowerCase().includes(q)) ||
    (leader.description && leader.description.toLowerCase().includes(q))
  );

  const filteredUsers = users.filter((u) =>
    !q ? true : (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q))
  );

  const filteredAdmins = admins.filter((a) =>
    !q ? true : a.username && a.username.toLowerCase().includes(q)
  );

  const filteredVisits = visits.filter((v) =>
    !q ? true : (v.page && v.page.toLowerCase().includes(q)) || (v.visitor && v.visitor.toLowerCase().includes(q))
  );

  return (
    <main className="admin-page">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          {/* Mobile hamburger menu button */}
          <button
            type="button"
            className="admin-menu-toggle"
            aria-label={mobileNavOpen ? "Close navigation drawer" : "Open navigation drawer"}
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            <i className={`bx ${mobileNavOpen ? "bx-x" : "bx-menu"}`} />
          </button>

          {/* Desktop collapse sidebar toggle button */}
          <button
            type="button"
            className="admin-sidebar-toggle-desktop"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            <i className={`bx bx-${sidebarCollapsed ? "chevron-right" : "chevron-left"}`} />
          </button>

          {/* Brand Mark & Title */}
          <Link href="/" className="admin-brand">
            <img src={imagePath} alt="SDA Logo" className="admin-brand-logo" />
            <div className="admin-brand-text">
              <span className="admin-brand-name">Kerugoya Main SDA</span>
              <span className="admin-brand-subtitle">Admin Workspace</span>
            </div>
          </Link>
        </div>

        <div className="admin-header-right">
          <div className="admin-user-pill">
            <div className="admin-avatar">
              {username.trim().charAt(0).toUpperCase()}
            </div>
            <div className="admin-user-meta admin-user-details">
              <span className="admin-user-name">{username}</span>
              <span className="admin-user-status">
                <span className="admin-status-dot" /> Online
              </span>
            </div>
          </div>

          <Link href="/" className="admin-header-btn" title="View Public Church Website">
            <i className="bx bx-globe" />
            <span>View Site</span>
          </Link>

          <button
            type="button"
            className="admin-header-btn is-logout"
            onClick={onLogout}
            title="Sign out of Admin Dashboard"
          >
            <i className="bx bx-log-out" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`admin-drawer-backdrop ${mobileNavOpen ? "is-visible" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      <div className={`admin-layout ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        {/* Navigation Sidebar (Fixed on desktop, Slide-in Drawer on mobile) */}
        <aside className={`admin-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
          {/* Mobile Drawer Header */}
          <div className="admin-drawer-header">
            <div className="admin-brand-text">
              <span className="admin-brand-name">Kerugoya Main SDA</span>
              <span className="admin-brand-subtitle">Management Console</span>
            </div>
            <button
              type="button"
              className="admin-drawer-close"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
            >
              <i className="bx bx-x" />
            </button>
          </div>

          <span className="admin-sidebar-section-title">Workspace Navigation</span>

          <nav className="admin-nav-list" aria-label="Dashboard sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`admin-nav-item ${tab === t.id ? "is-active" : ""}`}
                onClick={() => {
                  setTab(t.id);
                  setMobileNavOpen(false);
                }}
              >
                <i className={`bx ${t.icon}`} />
                <span className="admin-nav-text">{t.label}</span>
                {t.count > 0 && <span className="admin-nav-badge">{t.count}</span>}
              </button>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="admin-sidebar-profile-card">
              <div className="admin-avatar">
                {username.trim().charAt(0).toUpperCase()}
              </div>
              <div className="admin-user-meta">
                <span className="admin-user-name">{username}</span>
                <span className="admin-user-status" style={{ color: "var(--admin-text-muted)" }}>
                  Administrator
                </span>
              </div>
            </div>

            <Link
              href="/"
              className="admin-sidebar-footer-link"
              onClick={() => setMobileNavOpen(false)}
            >
              <i className="bx bx-arrow-back" />
              <span>Back to Website</span>
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="admin-content">
          {/* Mobile Quick-Pill Tab Bar */}
          <div className="admin-mobile-tabs-container">
            <div className="admin-mobile-tabs-list" ref={tabListRef}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`admin-mobile-tab-btn ${tab === t.id ? "is-active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  <i className={`bx ${t.icon}`} />
                  <span>{t.label}</span>
                  {t.count > 0 && <span className="pill-badge">{t.count}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Executive Metrics Overview Strip */}
          <div className="admin-metrics-grid">
            <div
              className={`admin-metric-card ${tab === "announcements" ? "is-active" : ""}`}
              onClick={() => setTab("announcements")}
            >
              <div className="admin-metric-icon announcements">
                <i className="bx bx-megaphone" />
              </div>
              <div className="admin-metric-info">
                <span className="admin-metric-value">{announcements.length}</span>
                <span className="admin-metric-label">Announcements</span>
              </div>
            </div>

            <div
              className={`admin-metric-card ${tab === "prayer" ? "is-active" : ""}`}
              onClick={() => setTab("prayer")}
            >
              <div className="admin-metric-icon prayer">
                <i className="bx bx-pray" />
              </div>
              <div className="admin-metric-info">
                <span className="admin-metric-value">{prayerRequests.length}</span>
                <span className="admin-metric-label">Prayer Needs</span>
              </div>
            </div>

            <div
              className={`admin-metric-card ${tab === "feedback" ? "is-active" : ""}`}
              onClick={() => setTab("feedback")}
            >
              <div className="admin-metric-icon feedback">
                <i className="bx bx-message-dots" />
              </div>
              <div className="admin-metric-info">
                <span className="admin-metric-value">{feedback.length}</span>
                <span className="admin-metric-label">Feedback</span>
              </div>
            </div>

            <div
              className={`admin-metric-card ${tab === "posts" ? "is-active" : ""}`}
              onClick={() => setTab("posts")}
            >
              <div className="admin-metric-icon posts">
                <i className="bx bx-conversation" />
              </div>
              <div className="admin-metric-info">
                <span className="admin-metric-value">{posts.length}</span>
                <span className="admin-metric-label">Stories</span>
              </div>
            </div>

            <div
              className={`admin-metric-card ${tab === "sermons" ? "is-active" : ""}`}
              onClick={() => setTab("sermons")}
            >
              <div className="admin-metric-icon sermons">
                <i className="bx bx-video" />
              </div>
              <div className="admin-metric-info">
                <span className="admin-metric-value">{sermons.length}</span>
                <span className="admin-metric-label">Sermons</span>
              </div>
            </div>

            <div
              className={`admin-metric-card ${tab === "users" ? "is-active" : ""}`}
              onClick={() => setTab("users")}
            >
              <div className="admin-metric-icon users">
                <i className="bx bx-user-check" />
              </div>
              <div className="admin-metric-info">
                <span className="admin-metric-value">{users.length}</span>
                <span className="admin-metric-label">Active Members</span>
              </div>
            </div>
          </div>

          {/* Section View Header with Search Filter */}
          <div className="admin-view-header">
            <div className="admin-view-title-group">
              <h2>
                {tab === "announcements" && "Church Announcements"}
                {tab === "leaders" && "Church Leaders"}
                {tab === "prayer" && "Prayer Requests"}
                {tab === "feedback" && "Community Feedback"}
                {tab === "program" && "Church Weekly Program"}
                {tab === "posts" && "Community Stories & Reflections"}
                {tab === "sermons" && "Sermon Recordings"}
                {tab === "users" && "Logged In Members"}
                {tab === "admins" && "Staff Administrators"}
                {tab === "analytics" && "Portal Analytics & Visits"}
              </h2>
              <p>
                {tab === "announcements" && "Publish timely updates, service schedules, and church events."}
                {tab === "leaders" && "Add and maintain leader profiles, ministry roles, descriptions, and portrait photos."}
                {tab === "prayer" && "View and moderate prayer requests submitted by church members."}
                {tab === "feedback" && "Suggestions and thoughts shared by church visitors and congregants."}
                {tab === "program" && "Manage the weekly church bulletin and generate printable PDFs."}
                {tab === "posts" && "Review user-submitted faith journeys, testimonies, and reflections."}
                {tab === "sermons" && "Manage video recordings and YouTube sermons for online members."}
                {tab === "users" && "View all member sessions currently active on the church platform."}
                {tab === "admins" && "Add and manage trusted church staff with dashboard access."}
                {tab === "analytics" && "Monitor platform activity, top visited pages, and active users."}
              </p>
            </div>

            {/* Instant Search Filter */}
            {tab !== "program" && (
              <div className="admin-search-box">
                <i className="bx bx-search" />
                <input
                  type="text"
                  placeholder={`Search ${tab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Alert Message Banner */}
          {message && (
            <div className={`admin-alert is-${message.type || "info"}`} role="alert">
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <i
                  className={`bx ${
                    message.type === "success"
                      ? "bx-check-circle"
                      : message.type === "error"
                      ? "bx-error-circle"
                      : "bx-info-circle"
                  }`}
                  style={{ fontSize: "1.25rem" }}
                />
                {message.text}
              </span>
              <button
                type="button"
                className="admin-alert-dismiss"
                onClick={() => setMessage(null)}
                aria-label="Dismiss alert"
              >
                ×
              </button>
            </div>
          )}

          {tab === "leaders" && (
            <>
              <div className="admin-panel">
                <div className="admin-panel-heading">
                  <div className="admin-panel-icon">
                    <i className="bx bx-group" />
                  </div>
                  <div className="admin-panel-title">
                    <h3>{editingLeader ? "Edit Church Leader" : "Add Church Leader"}</h3>
                    <p>Update the public leadership page with a name, role, description, and portrait.</p>
                  </div>
                </div>
                <form
                  key={editingLeader?.id || "new-leader"}
                  className="admin-form"
                  onSubmit={saveLeader}
                >
                  <div className="admin-field">
                    <label htmlFor="leader-name"><span>Name</span></label>
                    <input
                      id="leader-name"
                      name="name"
                      defaultValue={editingLeader?.name || ""}
                      maxLength={100}
                      required
                      placeholder="Leader's full name"
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="leader-role"><span>Role</span></label>
                    <input
                      id="leader-role"
                      name="role"
                      defaultValue={editingLeader?.role || ""}
                      maxLength={120}
                      required
                      placeholder="e.g. Church Elder"
                    />
                  </div>
                  <div className="admin-field admin-field-wide">
                    <label htmlFor="leader-description"><span>Description</span></label>
                    <textarea
                      id="leader-description"
                      name="description"
                      defaultValue={editingLeader?.description || ""}
                      maxLength={3000}
                      rows={4}
                      placeholder="Share a short introduction or ministry description"
                    />
                  </div>
                  <div className="admin-field admin-field-wide">
                    <label htmlFor="leader-image">
                      <span>Portrait image</span>
                      <small>JPG, PNG, or WebP; up to 3 MB</small>
                    </label>
                    <input
                      id="leader-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={selectLeaderImage}
                    />
                    {(leaderImageData || (editingLeader?.imageUrl && !removeLeaderImage)) && (
                      <div className="leader-image-preview">
                        <img
                          src={leaderImageData || editingLeader.imageUrl}
                          alt="Selected leader portrait preview"
                        />
                        <button
                          type="button"
                          className="leader-action-secondary"
                          onClick={() => {
                            setLeaderImageData("");
                            setRemoveLeaderImage(Boolean(editingLeader?.imageUrl));
                          }}
                        >
                          Remove image
                        </button>
                      </div>
                    )}
                    {removeLeaderImage && <small>The current portrait will be removed when saved.</small>}
                  </div>
                  <div className="admin-form-actions">
                    <button className="admin-btn-primary" type="submit" disabled={submitting}>
                      <i className={`bx ${submitting ? "bx-loader-alt bx-spin" : "bx-save"}`} />
                      {submitting ? "Saving..." : editingLeader ? "Save Changes" : "Add Leader"}
                    </button>
                    {editingLeader && (
                      <button className="leader-action-secondary" type="button" onClick={cancelLeaderEdit}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-list-section">
                <div className="admin-list-header">
                  <div>
                    <h3>Leader Profiles &amp; ID Cards</h3>
                    <p>Preview, share, or download a professional image card for each leader.</p>
                  </div>
                  <span className="admin-list-count">{filteredLeaders.length}</span>
                </div>
                <div className="admin-list">
                  {filteredLeaders.length ? filteredLeaders.map((leader) => (
                    <article key={leader.id} className="admin-list-item leader-admin-item">
                      {leader.imageUrl ? (
                        <img className="leader-admin-image" src={leader.imageUrl} alt="" />
                      ) : (
                        <div className="admin-item-icon"><i className="bx bx-user" /></div>
                      )}
                      <div className="admin-item-main">
                        <strong>{leader.name}</strong>
                        <p>{leader.role}</p>
                        {leader.description && <p className="admin-item-byline">{leader.description}</p>}
                      </div>
                      <button
                        className="leader-card-open-btn"
                        type="button"
                        aria-label={`Create shareable ID card for ${leader.name}`}
                        onClick={() => {
                          setLeaderCardMessage(null);
                          setLeaderCardPreview(leader);
                        }}
                      >
                        <i className="bx bx-id-card" />
                        <span>Share ID card</span>
                      </button>
                      <button
                        className="admin-item-action-btn is-edit"
                        type="button"
                        aria-label={`Edit ${leader.name}`}
                        onClick={() => editLeader(leader)}
                      >
                        <i className="bx bx-edit-alt" />
                      </button>
                      <button
                        className="admin-item-action-btn"
                        type="button"
                        aria-label={`Delete ${leader.name}`}
                        disabled={deletingId === `/api/leaders/${leader.id}`}
                        onClick={() => remove(`/api/leaders/${leader.id}`, "church leader")}
                      >
                        <i className={`bx ${deletingId === `/api/leaders/${leader.id}` ? "bx-loader-alt bx-spin" : "bx-trash"}`} />
                      </button>
                    </article>
                  )) : (
                    <div className="admin-empty-state">
                      <i className="bx bx-group" />
                      <h4>No church leaders found</h4>
                      <p>Add a leader profile above to display it on the public website.</p>
                    </div>
                  )}
                </div>
              </div>

              {leaderCardPreview && (
                <div
                  className="leader-card-modal-backdrop"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget && !leaderCardBusy) {
                      setLeaderCardPreview(null);
                    }
                  }}
                >
                  <section
                    className="leader-card-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="leader-card-modal-title"
                  >
                    <div className="leader-card-modal-heading">
                      <div>
                        <span className="leader-card-modal-eyebrow">Share a leadership profile</span>
                        <h3 id="leader-card-modal-title">Leader ID card</h3>
                        <p>Share or download a polished profile card for this church leader.</p>
                      </div>
                      <button
                        type="button"
                        className="admin-item-action-btn"
                        aria-label="Close ID card preview"
                        disabled={leaderCardBusy}
                        onClick={() => setLeaderCardPreview(null)}
                      >
                        <i className="bx bx-x" />
                      </button>
                    </div>

                    <article className="leader-id-card-preview">
                      <div className="leader-id-card-brand">
                        {leaderCardPreview.imageUrl ? (
                          <img src={leaderCardPreview.imageUrl} alt={`${leaderCardPreview.name} portrait`} />
                        ) : (
                          <div className="leader-id-card-placeholder" aria-hidden="true">
                            {(leaderCardPreview.name || "L").trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="leader-id-card-church">
                          <img src={imagePath} alt="" />
                          <span>Kerugoya Main SDA Church</span>
                        </div>
                        <span className="leader-id-card-location">Leadership · Kerugoya, Kenya</span>
                      </div>
                      <div className="leader-id-card-details">
                        <span className="leader-id-card-kicker">Church leadership</span>
                        <h4>{leaderCardPreview.name}</h4>
                        <p className="leader-id-card-role">{leaderCardPreview.role}</p>
                        <p className="leader-id-card-description">
                          {leaderCardPreview.description || "Serving the church community with faith and care."}
                        </p>
                        <span className="leader-id-card-motto">Serving with faith · Growing in community</span>
                      </div>
                    </article>

                    {leaderCardMessage && (
                      <p
                        className={`leader-card-feedback is-${leaderCardMessage.type}`}
                        role={leaderCardMessage.type === "error" ? "alert" : "status"}
                      >
                        {leaderCardMessage.text}
                      </p>
                    )}
                    <div className="leader-card-modal-actions">
                      <button
                        type="button"
                        className="admin-btn-primary"
                        disabled={leaderCardBusy}
                        onClick={() => shareLeaderCard(false)}
                      >
                        <i className={`bx ${leaderCardBusy ? "bx-loader-alt bx-spin" : "bx-share-alt"}`} />
                        {leaderCardBusy ? "Preparing card..." : "Share ID card"}
                      </button>
                      <button
                        type="button"
                        className="leader-action-secondary"
                        disabled={leaderCardBusy}
                        onClick={() => shareLeaderCard(true)}
                      >
                        <i className="bx bx-download" />
                        Download PNG
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}

          {/* TAB 1: ANNOUNCEMENTS */}
          {tab === "announcements" && (
            <>
              <div className="admin-panel">
                <div className="admin-panel-heading">
                  <div className="admin-panel-icon">
                    <i className="bx bx-edit-alt" />
                  </div>
                  <div className="admin-panel-title">
                    <h3>Create New Announcement</h3>
                    <p>Post an update to the church homepage and announcements page.</p>
                  </div>
                </div>
                <form className="admin-form" onSubmit={(e) => submit(e, "/api/announcements")}>
                  <div className="admin-field">
                    <label>
                      <span>Title</span>
                    </label>
                    <input
                      name="title"
                      placeholder="e.g. Sabbath Worship Schedule"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label>
                      <span>Display Date</span>
                      <small>Optional</small>
                    </label>
                    <input name="date" type="date" />
                  </div>
                  <div className="admin-field admin-field-wide">
                    <label>
                      <span>Details &amp; Notes</span>
                      <small>Press Enter to continue lists (1. or -)</small>
                    </label>
                    <textarea
                      name="content"
                      rows="4"
                      placeholder="Write your announcement details here…"
                      onKeyDown={continueListOnEnter}
                      required
                    />
                  </div>
                  <div className="admin-form-actions">
                    <button className="admin-btn-primary" type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <i className="bx bx-loader-alt bx-spin" /> Publishing...
                        </>
                      ) : (
                        <>
                          <i className="bx bx-send" /> Publish Announcement
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="admin-list-section">
                <div className="admin-list-header">
                  <div>
                    <h3>Published Announcements</h3>
                    <p>Updates currently visible to the public</p>
                  </div>
                  <span className="admin-list-count">{filteredAnnouncements.length}</span>
                </div>
                <div className="admin-list">
                  {filteredAnnouncements.length ? (
                    filteredAnnouncements.map((item) => (
                      <article key={item.id} className="admin-list-item">
                        <div className="admin-item-icon">
                          <i className="bx bx-megaphone" />
                        </div>
                        <div className="admin-item-main">
                          {item.date && (
                            <div className="admin-item-meta">
                              <span className="admin-tag is-blue">
                                <i className="bx bx-calendar" /> {item.date}
                              </span>
                            </div>
                          )}
                          <div className="admin-item-title">{item.title}</div>
                          <FormattedContent className="admin-item-content" text={item.content} />
                        </div>
                        <button
                          className="admin-item-action-btn"
                          type="button"
                          aria-label={`Delete announcement: ${item.title}`}
                          disabled={deletingId === `/api/announcements/${item.id}`}
                          onClick={() => remove(`/api/announcements/${item.id}`, "announcement")}
                        >
                          <i
                            className={`bx ${
                              deletingId === `/api/announcements/${item.id}`
                                ? "bx-loader-alt bx-spin"
                                : "bx-trash"
                            }`}
                          />
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="admin-empty-state">
                      <i className="bx bx-inbox" />
                      <h4>No announcements found</h4>
                      <p>
                        {searchQuery
                          ? "No announcements matched your search query."
                          : "Published announcements will appear here."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: PRAYER REQUESTS */}
          {tab === "prayer" && (
            <div className="admin-list-section">
              <div className="admin-list-header">
                <div>
                  <h3>Prayer Requests</h3>
                  <p>Intercessory prayers submitted by our community</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={`admin-mobile-tab-btn ${prayerFilter === "all" ? "is-active" : ""}`}
                    onClick={() => setPrayerFilter("all")}
                    style={{ minHeight: "32px", padding: "0.25rem 0.65rem", fontSize: "0.75rem" }}
                  >
                    All ({prayerRequests.length})
                  </button>
                  <button
                    type="button"
                    className={`admin-mobile-tab-btn ${prayerFilter === "public" ? "is-active" : ""}`}
                    onClick={() => setPrayerFilter("public")}
                    style={{ minHeight: "32px", padding: "0.25rem 0.65rem", fontSize: "0.75rem" }}
                  >
                    Public ({prayerRequests.filter((p) => p.visibility === "public").length})
                  </button>
                  <button
                    type="button"
                    className={`admin-mobile-tab-btn ${prayerFilter === "anonymous" ? "is-active" : ""}`}
                    onClick={() => setPrayerFilter("anonymous")}
                    style={{ minHeight: "32px", padding: "0.25rem 0.65rem", fontSize: "0.75rem" }}
                  >
                    Anonymous ({prayerRequests.filter((p) => p.visibility !== "public").length})
                  </button>
                </div>
              </div>
              <div className="admin-list">
                {filteredPrayerRequests.length ? (
                  filteredPrayerRequests.map((item) => (
                    <article key={item.id} className="admin-list-item">
                      <div className="admin-item-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
                        <i className="bx bx-pray" />
                      </div>
                      <div className="admin-item-main">
                        <div className="admin-item-meta">
                          <span className={`admin-tag ${item.visibility === "public" ? "is-green" : "is-amber"}`}>
                            {item.visibility === "public" ? "Public Request" : "Anonymous"}
                          </span>
                          <span className="admin-item-byline">
                            Submitted by <strong>{item.name || "Anonymous Member"}</strong>
                          </span>
                        </div>
                        <FormattedContent className="admin-item-content" text={item.message} />
                      </div>
                      <button
                        className="admin-item-action-btn"
                        type="button"
                        aria-label="Delete prayer request"
                        disabled={deletingId === `/api/prayer-requests/${item.id}`}
                        onClick={() => remove(`/api/prayer-requests/${item.id}`, "prayer request")}
                      >
                        <i
                          className={`bx ${
                            deletingId === `/api/prayer-requests/${item.id}`
                              ? "bx-loader-alt bx-spin"
                              : "bx-trash"
                          }`}
                        />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="admin-empty-state">
                    <i className="bx bx-pray" />
                    <h4>No prayer requests</h4>
                    <p>When church members submit prayer requests, they will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FEEDBACK */}
          {tab === "feedback" && (
            <div className="admin-list-section">
              <div className="admin-list-header">
                <div>
                  <h3>Congregant Feedback</h3>
                  <p>Inquiries, suggestions, and messages received from the feedback form</p>
                </div>
                <span className="admin-list-count">{filteredFeedback.length}</span>
              </div>
              <div className="admin-list">
                {filteredFeedback.length ? (
                  filteredFeedback.map((item) => (
                    <article key={item.id} className="admin-list-item">
                      <div className="admin-item-icon" style={{ background: "#e0e7ff", color: "#4338ca" }}>
                        <i className="bx bx-message-dots" />
                      </div>
                      <div className="admin-item-main">
                        <div className="admin-item-meta">
                          <span className="admin-tag is-blue">Feedback</span>
                          <span className="admin-item-byline">
                            From <strong>{item.name || "Anonymous Visitor"}</strong>
                          </span>
                        </div>
                        <FormattedContent className="admin-item-content" text={item.message} />
                      </div>
                      <button
                        className="admin-item-action-btn"
                        type="button"
                        aria-label="Delete feedback submission"
                        disabled={deletingId === `/api/feedback/${item.id}`}
                        onClick={() => remove(`/api/feedback/${item.id}`, "feedback")}
                      >
                        <i
                          className={`bx ${
                            deletingId === `/api/feedback/${item.id}`
                              ? "bx-loader-alt bx-spin"
                              : "bx-trash"
                          }`}
                        />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="admin-empty-state">
                    <i className="bx bx-message-dots" />
                    <h4>No feedback submissions</h4>
                    <p>Community feedback and inquiries will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CHURCH PROGRAM */}
          {tab === "program" && (
            <div className="admin-panel">
              <div className="admin-panel-heading">
                <div className="admin-panel-icon" style={{ background: "#ede9fe", color: "#6d28d9" }}>
                  <i className="bx bx-calendar-event" />
                </div>
                <div className="admin-panel-title">
                  <h3>Edit Weekly Church Program</h3>
                  <p>Update the Sabbath order of service displayed online and printed for attendees.</p>
                </div>
              </div>
              <form className="admin-form" onSubmit={saveProgram}>
                <div className="admin-field admin-field-wide">
                  <label>
                    <span>Program Title</span>
                  </label>
                  <input
                    name="title"
                    value={program.title}
                    onChange={(e) => setProgram((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Sabbath School &amp; Divine Service"
                    required
                  />
                </div>
                <div className="admin-field admin-field-wide">
                  <label>
                    <span>Order of Service Body</span>
                    <small>Separate sections with line breaks</small>
                  </label>
                  <textarea
                    name="body"
                    rows="14"
                    value={program.body}
                    onChange={(e) => setProgram((p) => ({ ...p, body: e.target.value }))}
                    placeholder="Enter Sabbath School, Divine Worship, AY Program details..."
                    onKeyDown={continueListOnEnter}
                  />
                </div>
                <div className="admin-form-actions" style={{ flexWrap: "wrap" }}>
                  <button className="admin-btn-primary" type="submit" disabled={programSaving}>
                    {programSaving ? (
                      <>
                        <i className="bx bx-loader-alt bx-spin" /> Saving Program...
                      </>
                    ) : (
                      <>
                        <i className="bx bx-save" /> Save Church Program
                      </>
                    )}
                  </button>
                  <a
                    className="admin-btn-secondary"
                    href="/api/program/pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="bx bx-file-pdf" style={{ color: "#ef4444" }} /> Download PDF Bulletin
                  </a>
                  <a
                    className="admin-btn-secondary"
                    href="/program.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="bx bx-external-link" /> View Public Program Page
                  </a>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: COMMUNITY STORIES */}
          {tab === "posts" && (
            <div className="admin-list-section">
              <div className="admin-list-header">
                <div>
                  <h3>Community Stories &amp; Reflections</h3>
                  <p>Faith reflections, testimonies, and articles written by members</p>
                </div>
                <span className="admin-list-count">{filteredPosts.length}</span>
              </div>
              <div className="admin-list">
                {filteredPosts.length ? (
                  filteredPosts.map((item) => (
                    <article key={item.id} className="admin-list-item">
                      <div className="admin-item-icon" style={{ background: "#dcfce7", color: "#15803d" }}>
                        <i className="bx bx-conversation" />
                      </div>
                      <div className="admin-item-main">
                        <div className="admin-item-meta">
                          <span className="admin-tag is-green">{item.category || "General"}</span>
                          <span className="admin-item-byline">
                            By <strong>{item.author}</strong> • {item.date}
                          </span>
                        </div>
                        <div className="admin-item-title">{item.title}</div>
                        <FormattedContent className="admin-item-content" text={item.content} />
                        <div className="admin-item-stats">
                          <span>
                            <i className="bx bx-heart" style={{ color: "#ef4444" }} /> {item.likes || 0}{" "}
                            {item.likes === 1 ? "like" : "likes"}
                          </span>
                          <span>
                            <i className="bx bx-message-rounded" style={{ color: "#3b82f6" }} />{" "}
                            {item.comments?.length || 0} comments
                          </span>
                        </div>
                      </div>
                      <button
                        className="admin-item-action-btn"
                        type="button"
                        aria-label={`Delete story: ${item.title}`}
                        disabled={deletingId === `/api/community/posts/${item.id}`}
                        onClick={() => remove(`/api/community/posts/${item.id}`, "community post")}
                      >
                        <i
                          className={`bx ${
                            deletingId === `/api/community/posts/${item.id}`
                              ? "bx-loader-alt bx-spin"
                              : "bx-trash"
                          }`}
                        />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="admin-empty-state">
                    <i className="bx bx-conversation" />
                    <h4>No community stories</h4>
                    <p>Members can submit stories from the community page.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SERMONS */}
          {tab === "sermons" && (
            <>
              <div className="admin-panel">
                <div className="admin-panel-heading">
                  <div className="admin-panel-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                    <i className="bx bx-video-plus" />
                  </div>
                  <div className="admin-panel-title">
                    <h3>Add New Sermon Recording</h3>
                    <p>Publish a YouTube sermon for congregation members to watch.</p>
                  </div>
                </div>
                <form className="admin-form" onSubmit={(e) => submit(e, "/api/sermons")}>
                  <div className="admin-field">
                    <label>
                      <span>Sermon Title</span>
                    </label>
                    <input name="title" placeholder="e.g. Walking in Faith and Truth" required />
                  </div>
                  <div className="admin-field">
                    <label>
                      <span>YouTube Video ID</span>
                      <small>e.g. dQw4w9WgXcQ</small>
                    </label>
                    <input name="youtubeId" placeholder="Video ID from YouTube URL" required />
                  </div>
                  <div className="admin-field">
                    <label>
                      <span>Service Date</span>
                      <small>Optional</small>
                    </label>
                    <input name="date" type="date" />
                  </div>
                  <div className="admin-form-actions">
                    <button className="admin-btn-primary" type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <i className="bx bx-loader-alt bx-spin" /> Publishing...
                        </>
                      ) : (
                        <>
                          <i className="bx bx-upload" /> Publish Sermon
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="admin-list-section">
                <div className="admin-list-header">
                  <div>
                    <h3>Published Sermons</h3>
                    <p>Recordings available in the church media library</p>
                  </div>
                  <span className="admin-list-count">{filteredSermons.length}</span>
                </div>
                <div className="admin-list">
                  {filteredSermons.length ? (
                    filteredSermons.map((item) => (
                      <article key={item.id} className="admin-list-item">
                        <div className="admin-item-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                          <i className="bx bx-play-circle" />
                        </div>
                        <div className="admin-item-main">
                          <div className="admin-item-title">{item.title}</div>
                          <div className="admin-item-meta" style={{ marginTop: "0.25rem" }}>
                            <span className="admin-tag is-blue">YouTube ID: {item.youtubeId}</span>
                            {item.date && (
                              <span className="admin-item-byline">Date: {item.date}</span>
                            )}
                          </div>
                          <div style={{ marginTop: "0.4rem" }}>
                            <a
                              href={`https://www.youtube.com/watch?v=${item.youtubeId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "var(--admin-accent)",
                                fontSize: "0.82rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                textDecoration: "none",
                              }}
                            >
                              <i className="bx bx-link-external" /> Watch on YouTube
                            </a>
                          </div>
                        </div>
                        <button
                          className="admin-item-action-btn"
                          type="button"
                          aria-label={`Delete sermon: ${item.title}`}
                          disabled={deletingId === `/api/sermons/${item.id}`}
                          onClick={() => remove(`/api/sermons/${item.id}`, "sermon")}
                        >
                          <i
                            className={`bx ${
                              deletingId === `/api/sermons/${item.id}`
                                ? "bx-loader-alt bx-spin"
                                : "bx-trash"
                            }`}
                          />
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="admin-empty-state">
                      <i className="bx bx-video" />
                      <h4>No sermons uploaded</h4>
                      <p>Add YouTube sermon recordings above to build your church library.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 7: ACTIVE MEMBERS */}
          {tab === "users" && (
            <div className="admin-list-section">
              <div className="admin-list-header">
                <div>
                  <h3>Firebase Member Accounts</h3>
                  <p>Member accounts managed through Firebase Authentication</p>
                </div>
                <span className="admin-list-count">{filteredUsers.length}</span>
              </div>
              <div className="admin-list">
                {filteredUsers.length ? (
                  filteredUsers.map((session) => (
                    <article key={session.sessionId} className="admin-list-item">
                      <div className="admin-item-icon is-success">
                        <i className="bx bx-user-check" />
                      </div>
                      <div className="admin-item-main">
                        <div className="admin-item-meta">
                          <strong style={{ fontSize: "0.95rem" }}>{session.name}</strong>
                          {session.disabled && <span className="admin-tag is-amber">Disabled</span>}
                        </div>
                        <p className="admin-item-byline" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <i className="bx bx-envelope" /> {session.email}
                        </p>
                        <div className="admin-item-stats">
                          <span>
                            <i className="bx bx-time" /> Last sign in:{" "}
                            {session.lastSignInAt ? new Date(session.lastSignInAt).toLocaleString() : "Never"}
                          </span>
                        </div>
                      </div>
                      <button
                        className="admin-item-action-btn"
                        type="button"
                        aria-label={`Revoke sessions for ${session.name}`}
                        title="Revoke Firebase sessions"
                        disabled={deletingId === `/api/admin/users/${session.sessionId}`}
                        onClick={() => remove(`/api/admin/users/${session.sessionId}`, "member sessions")}
                      >
                        <i
                          className={`bx ${
                            deletingId === `/api/admin/users/${session.sessionId}`
                              ? "bx-loader-alt bx-spin"
                              : "bx-log-out-circle"
                          }`}
                        />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="admin-empty-state">
                    <i className="bx bx-user-x" />
                    <h4>No Firebase member accounts</h4>
                    <p>Member accounts will appear here after they register through Firebase Authentication.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: ADMINISTRATORS */}
          {tab === "admins" && (
            <>
              <div className="admin-panel">
                <div className="admin-panel-heading">
                  <div className="admin-panel-icon">
                    <i className="bx bx-user-plus" />
                  </div>
                  <div className="admin-panel-title">
                    <h3>Add Firebase Administrator</h3>
                    <p>Create a Firebase account and grant it access to the church admin portal.</p>
                  </div>
                </div>
                <form className="admin-form" onSubmit={(e) => submit(e, "/api/admins")}>
                  <div className="admin-field">
                    <label htmlFor="admin-name"><span>Administrator name</span></label>
                    <input
                      id="admin-name"
                      name="name"
                      placeholder="e.g. Pastor John"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="admin-account-email"><span>Email address</span></label>
                    <input
                      id="admin-account-email"
                      name="email"
                      type="email"
                      placeholder="admin@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="admin-account-password"><span>Temporary password</span></label>
                    <input
                      id="admin-account-password"
                      name="password"
                      type="password"
                      placeholder="Create secure temporary password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="admin-form-actions">
                    <button className="admin-btn-primary" type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <i className="bx bx-loader-alt bx-spin" /> Adding...
                        </>
                      ) : (
                        <>
                          <i className="bx bx-user-plus" /> Add Administrator
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="admin-list-section">
                <div className="admin-list-header">
                  <div>
                    <h3>Current Administrators</h3>
                    <p>Firebase accounts authorized to manage the church portal</p>
                  </div>
                  <span className="admin-list-count">{filteredAdmins.length}</span>
                </div>
                <div className="admin-list">
                  {filteredAdmins.length ? (
                    filteredAdmins.map((item) => (
                      <article key={item.id} className="admin-list-item">
                        <div className="admin-item-icon">
                          <i className="bx bx-shield-quarter" />
                        </div>
                        <div className="admin-item-main">
                          <div className="admin-item-title">{item.name || item.username}</div>
                          <p className="admin-item-byline">{item.username}</p>
                          <div className="admin-item-meta">
                            <span className="admin-tag is-blue">Church Administrator</span>
                          </div>
                        </div>
                        <button
                          className="admin-item-action-btn"
                          type="button"
                          aria-label={`Remove admin: ${item.username}`}
                          title={item.isBootstrap ? "Bootstrap administrator is configured in environment settings" : item.isSelf ? "You cannot remove your own administrator account" : "Remove administrator"}
                          disabled={item.isBootstrap || item.isSelf || deletingId === `/api/admins/${item.id}`}
                          onClick={() => remove(`/api/admins/${item.id}`, "administrator")}
                        >
                          <i
                            className={`bx ${
                              deletingId === `/api/admins/${item.id}`
                                ? "bx-loader-alt bx-spin"
                                : "bx-trash"
                            }`}
                          />
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="admin-empty-state">
                      <i className="bx bx-user-plus" />
                      <h4>No additional administrators</h4>
                      <p>Add department heads or church clerks to assist with website updates.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 9: ANALYTICS */}
          {tab === "analytics" && (
            <div className="admin-list-section">
              <div className="admin-list-header">
                <div>
                  <h3>Portal Traffic &amp; Analytics</h3>
                  <p>Visit history is stored locally in this browser.</p>
                </div>
                <div className="admin-analytics-header-actions">
                  <span className="admin-list-count">{filteredVisits.length} visits</span>
                  <button
                    className="admin-analytics-clear-btn"
                    type="button"
                    disabled={!visits.length}
                    onClick={clearAnalytics}
                  >
                    <i className="bx bx-trash" />
                    Clear analytics
                  </button>
                </div>
              </div>

              <div style={{ padding: "1.25rem 1.25rem 0" }}>
                <div className="admin-analytics-deck">
                  <div className="admin-analytics-card">
                    <span className="admin-analytics-label">Total Visits</span>
                    <span className="admin-analytics-value">{visits.length}</span>
                  </div>
                  <div className="admin-analytics-card">
                    <span className="admin-analytics-label">Unique Visitors</span>
                    <span className="admin-analytics-value">
                      {new Set(visits.map((v) => v.visitor)).size}
                    </span>
                  </div>
                  <div className="admin-analytics-card">
                    <span className="admin-analytics-label">Most Visited Area</span>
                    <span className="admin-analytics-value" style={{ fontSize: "1.25rem" }}>
                      {topPage().label || "—"}
                    </span>
                  </div>
                  <div className="admin-analytics-card">
                    <span className="admin-analytics-label">Top Administrator</span>
                    <span className="admin-analytics-value" style={{ fontSize: "1.25rem" }}>
                      {topVisitor().label || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-list">
                {filteredVisits.length ? (
                  filteredVisits
                    .slice()
                    .reverse()
                    .map((visit, index) => (
                      <article key={`visit-${index}`} className="admin-list-item">
                        <div className="admin-item-icon" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
                          <i className="bx bx-history" />
                        </div>
                        <div className="admin-item-main">
                          <div className="admin-item-meta">
                            <span className="admin-tag is-purple">{visit.page}</span>
                            <span className="admin-item-byline">
                              By <strong>{visit.visitor}</strong>
                            </span>
                          </div>
                          <p className="admin-item-byline" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <i className="bx bx-time" /> {new Date(visit.at).toLocaleString()}
                          </p>
                        </div>
                      </article>
                    ))
                ) : (
                  <div className="admin-empty-state">
                    <i className="bx bx-bar-chart-alt-2" />
                    <h4>No activity recorded yet</h4>
                    <p>Dashboard interaction logs will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Admin() {
  const [auth, setAuth] = useState("");
  const [username, setUsername] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("adminUser");
    if (!firebaseAuth) {
      setCheckingAuth(false);
      return;
    }
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        setAuth("");
        setUsername("");
        setCheckingAuth(false);
        return;
      }
      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch("/api/auth-check", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setAuth("");
          setUsername("");
        } else {
          setAuth(token);
          setUsername(result.email || firebaseUser.email || "");
        }
      } catch {
        setAuth("");
        setUsername("");
      } finally {
        setCheckingAuth(false);
      }
    });
    return unsubscribe;
  }, []);

  if (checkingAuth) {
    return <div className="admin-login-wrapper">Checking Firebase sign-in…</div>;
  }
  if (!auth)
    return (
      <AdminLogin
        onLogin={(token, email) => {
          setAuth(token);
          setUsername(email);
        }}
      />
    );
  return (
    <AdminDashboard
      auth={auth}
      username={username}
      onLogout={async () => {
        try {
          if (firebaseAuth) await signOut(firebaseAuth);
          setAuth("");
          setUsername("");
        } catch (error) {
          console.error("Could not sign out of Firebase:", error);
        }
      }}
    />
  );
}

export default function App() {
  const route = useRoute();
  useEffect(() => {
    document.body.className =
      route === "/blogs"
        ? "community-page"
        : route === "/login"
          ? "account-page login-screen"
          : route === "/register"
            ? "account-page"
            : "";
    updatePageMetadata(route);
  }, [route]);
  if (route === "/about") return <About />;
  if (route === "/ministries") return <Ministries />;
  if (route === "/sermons") return <Sermons />;
  if (route === "/giving") return <Giving />;
  if (route === "/blogs") return <Community />;
  if (route === "/login") return <Account />;
  if (route === "/register") return <Account register />;
  if (route === "/announcements") return <Announcements />;
  if (responsivePages[route.slice(1)]) {
    return <ResponsivePage page={route.slice(1)} />;
  }
  if (route === "/admin" || route === "/admin-pro") return <Admin />;
  return <Home />;
}
