import { useEffect, useRef, useState } from "react";
import logoImage from "../assets/images/sda logo.png";

const imagePath = logoImage;
const memberSessionKey = "keruMemberSession";
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

// Splits post content into blocks so lists stay in point form: bullets and
// numbers get their own marker with a hanging indent, everything else is a
// paragraph. Author line breaks and blank lines are preserved.
function parseContentBlocks(ctx, text, maxWidth) {
  const blocks = [];
  const paragraphs = String(text ?? "").split("\n");
  paragraphs.forEach((paragraph, index) => {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      if (index < paragraphs.length - 1) blocks.push({ kind: "blank", lines: [""] });
      return;
    }

    const ordered = paragraph.match(/^(\s*)(\d+)([.)])(\s+)(.*)$/);
    const bullet = paragraph.match(/^(\s*)([-*+•])(\s+)(.*)$/);

    if (ordered || bullet) {
      const indent = ordered ? ordered[1] : bullet[1];
      const marker = ordered ? `${ordered[2]}${ordered[3]}` : "•";
      const content = ordered ? ordered[5] : bullet[4];
      const markerWidth = ctx.measureText(`${marker}  `).width;
      const indentWidth = ctx.measureText(indent).width;
      const textWidth = Math.max(80, maxWidth - indentWidth - markerWidth);
      blocks.push({
        kind: "list",
        indentWidth,
        marker,
        markerWidth,
        lines: wrapText(ctx, content, textWidth, Infinity),
      });
      return;
    }

    blocks.push({
      kind: "text",
      indentWidth: 0,
      marker: "",
      markerWidth: 0,
      lines: wrapText(ctx, trimmed, maxWidth, Infinity),
    });
  });
  return blocks;
}

async function renderPostImage(post) {
  const width = 1200;
  const minHeight = 630;
  const maxHeight = 4000;
  const padding = 72;
  const contentWidth = width - padding * 2;
  const top = 104;
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
    ctx.font = `400 ${bodySize}px 'Inter', system-ui, sans-serif`;
    bodyBlocks = parseContentBlocks(ctx, post.content || "", contentWidth);

    // A little breathing room after a list so it reads as its own block.
    bodyBlocks.forEach((block, index) => {
      const next = bodyBlocks[index + 1];
      block.gapAfter =
        block.kind === "list" && next && next.kind !== "blank"
          ? Math.round(bodyLineH * 0.4)
          : 0;
    });

    bodyHeight = bodyBlocks.reduce(
      (sum, block) => sum + block.lines.length * bodyLineH + (block.gapAfter || 0),
      0,
    );

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

  // The complete post — lists stay in point form
  ctx.font = `400 ${bodySize}px 'Inter', system-ui, sans-serif`;
  bodyBlocks.forEach((block) => {
    if (block.kind === "blank") {
      y += bodyLineH;
      return;
    }
    if (block.kind === "list") {
      const markerX = padding + block.indentWidth;
      const textX = markerX + block.markerWidth;
      ctx.fillStyle = "#2563eb";
      ctx.fillText(block.marker, markerX, y + bodyLineH / 2);
      ctx.fillStyle = "#475569";
      block.lines.forEach((line) => {
        ctx.fillText(line, textX, y + bodyLineH / 2);
        y += bodyLineH;
      });
    } else {
      ctx.fillStyle = "#475569";
      block.lines.forEach((line) => {
        ctx.fillText(line, padding, y + bodyLineH / 2);
        y += bodyLineH;
      });
    }
    y += block.gapAfter || 0;
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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      email: data.get("email").trim().toLowerCase(),
      password: data.get("password"),
    };
    if (register) payload.name = data.get("name").trim();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/members/${register ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error || "We could not sign you in. Please try again.");
        return;
      }
      localStorage.setItem(memberSessionKey, JSON.stringify({ token: result.token, user: result.member }));
      navigate("/blogs.html");
    } catch {
      setMessage("We could not connect to the member service. Please try again shortly.");
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
          <p className="form-message is-error" role="status">
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

function FormattedContent({ text, className }) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = String(text).split(urlRegex);
  return (
    <p className={className} style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }}>
      {parts.map((part, i) => {
        if (part && part.match(urlRegex)) {
          const href = part.startsWith("http://") || part.startsWith("https://") ? part : `https://${part}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="content-link"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </p>
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
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState("anonymous");
  const [program, setProgram] = useState(null);
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
      <main className="responsive-page">
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

function Community() {
  const [session, setSession] = useState(() => readJson(memberSessionKey, null));
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
      const file = new File([blob], filename, { type: "image/png" });
      const title = post.title || "Community Story";

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: `${title} — a community story from Kerugoya Main SDA Church.`,
        });
      } else {
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(href), 2000);
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
    const storedSession = readJson(memberSessionKey, null);
    const token = storedSession?.token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (!token) {
      localStorage.removeItem(memberSessionKey);
      setSession(null);
    }

    (async () => {
      if (token) {
        try {
          const response = await fetch("/api/members/me", { headers });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error("Session expired");
          if (active) {
            const nextSession = { token, user: result.member };
            setSession(nextSession);
            localStorage.setItem(memberSessionKey, JSON.stringify(nextSession));
          }
        } catch {
          localStorage.removeItem(memberSessionKey);
          if (active) setSession(null);
        }
      }

      try {
        const response = await fetch("/api/community/posts", { headers });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Unable to load stories.");
        if (active) setPosts(Array.isArray(result) ? result : []);
      } catch {
        if (active) setCommunityMessage("Stories could not be loaded. Check your connection and try again.");
      } finally {
        if (active) setFeedLoading(false);
      }
    })();

    return () => {
      active = false;
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
    if (!session?.token) {
      navigate("/login.html");
      return;
    }
    setCommunityMessage("");
    try {
      const response = await fetch(`/api/community/posts/${post.id}/like`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${session.token}` },
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
    if (!session?.token) {
      navigate("/login.html");
      return;
    }
    const form = event.currentTarget;
    const content = new FormData(form).get("comment").trim();
    if (!content) return;
    try {
      const response = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
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
        headers: { Authorization: `Bearer ${session.token}` },
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
    if (!session?.token) {
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
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
                  const token = session?.token;
                  if (token) {
                    fetch("/api/members/session", {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    }).catch(() => {});
                  }
                  localStorage.removeItem(memberSessionKey);
                  setSession(null);
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
                    <FormattedContent text={post.content} />
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
                          aria-label={`Share ${post.title} as an image`}
                          title="Share this story as an image"
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
                  <textarea
                    name="content"
                    rows="5"
                    placeholder="Start writing..."
                    onKeyDown={continueListOnEnter}
                    onInput={(event) => {
                      const field = event.currentTarget;
                      field.style.height = 'auto';
                      field.style.height = `${field.scrollHeight}px`;
                    }}
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const header = `Basic ${window.btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`;
    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("Invalid admin credentials. Please verify your username and password.");
      const result = await response.json();
      sessionStorage.setItem("adminAuth", header);
      sessionStorage.setItem("adminUser", result.username);
      onLogin(header, result.username);
    } catch (error) {
      setMessage(error.message || "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
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
          <div className="admin-alert is-error" role="alert">
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
            <label htmlFor="admin-username">Username</label>
            <div className="admin-login-input-wrap">
              <i className="bx bx-user" />
              <input
                id="admin-username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
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
            className="admin-btn-primary"
            type="submit"
            disabled={loading}
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
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState(null);

  const tabListRef = useRef(null);
  const headers = { "Content-Type": "application/json", Authorization: auth };

  const TABS = [
    { id: "announcements", label: "Announcements", icon: "bx-megaphone", count: announcements.length },
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
        sermonRes,
        adminRes,
        postsRes,
        usersRes,
        prayerRes,
        feedbackRes,
        programRes,
      ] = await Promise.all([
        fetch("/api/announcements", { cache: "no-store" }),
        fetch("/api/sermons", { cache: "no-store" }),
        fetch("/api/admins", { headers: { Authorization: auth }, cache: "no-store" }),
        fetch("/api/community/posts", { cache: "no-store" }),
        fetch("/api/admin/users", { headers: { Authorization: auth }, cache: "no-store" }).catch(() => ({ ok: false })),
        fetch("/api/prayer-requests", { headers: { Authorization: auth }, cache: "no-store" }).catch(() => ({ ok: false })),
        fetch("/api/feedback", { headers: { Authorization: auth }, cache: "no-store" }).catch(() => ({ ok: false })),
        fetch("/api/program", { cache: "no-store" }).catch(() => ({ ok: false })),
      ]);

      if (adminRes.status === 401) {
        setMessage({ type: "error", text: "Admin session expired. Please sign out and sign in again." });
      }

      setAnnouncements(announcementRes.ok ? await announcementRes.json() : []);
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

  const remove = async (endpoint, label = "item") => {
    if (!window.confirm(`Are you sure you want to delete this ${label}?`)) return;
    setDeletingId(endpoint);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: auth },
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
                  <h3>Logged In Members</h3>
                  <p>Church members currently holding active signed-in sessions</p>
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
                          <span className="online-badge">
                            <span className="online-dot" /> Online Now
                          </span>
                        </div>
                        <p className="admin-item-byline" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <i className="bx bx-envelope" /> {session.email}
                        </p>
                        <div className="admin-item-stats">
                          <span>
                            <i className="bx bx-time" /> Signed in:{" "}
                            {new Date(session.loggedInAt).toLocaleString()}
                          </span>
                          <span>
                            <i className="bx bx-calendar-check" /> Expires:{" "}
                            {new Date(session.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        className="admin-item-action-btn"
                        type="button"
                        aria-label={`Disconnect session for ${session.name}`}
                        title="Disconnect session"
                        disabled={deletingId === `/api/admin/users/${session.sessionId}`}
                        onClick={() => remove(`/api/admin/users/${session.sessionId}`, "user session")}
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
                    <h4>No active member sessions</h4>
                    <p>Signed in members will appear here with live session information.</p>
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
                    <h3>Add New Administrator</h3>
                    <p>Grant staff access to trusted leaders and department heads.</p>
                  </div>
                </div>
                <form className="admin-form" onSubmit={(e) => submit(e, "/api/admins")}>
                  <div className="admin-field">
                    <label>
                      <span>Admin Username</span>
                    </label>
                    <input
                      name="username"
                      placeholder="e.g. pastor_john"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label>
                      <span>Temporary Password</span>
                    </label>
                    <input
                      name="password"
                      type="password"
                      placeholder="Create secure temporary password"
                      autoComplete="new-password"
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
                    <p>Team members authorized to manage the church portal</p>
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
                          <div className="admin-item-title">{item.username}</div>
                          <div className="admin-item-meta">
                            <span className="admin-tag is-blue">Church Administrator</span>
                          </div>
                        </div>
                        <button
                          className="admin-item-action-btn"
                          type="button"
                          aria-label={`Remove admin: ${item.username}`}
                          disabled={deletingId === `/api/admins/${item.id}`}
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
                  <p>Overview of dashboard usage and frequent visitors</p>
                </div>
                <span className="admin-list-count">{filteredVisits.length} visits</span>
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
  const [auth, setAuth] = useState(
    () => sessionStorage.getItem("adminAuth") || "",
  );
  const [username, setUsername] = useState(
    () => sessionStorage.getItem("adminUser") || "",
  );
  if (!auth)
    return (
      <AdminLogin
        onLogin={(nextAuth, nextUsername) => {
          setAuth(nextAuth);
          setUsername(nextUsername);
        }}
      />
    );
  return (
    <AdminDashboard
      auth={auth}
      username={username}
      onLogout={() => {
        sessionStorage.removeItem("adminAuth");
        sessionStorage.removeItem("adminUser");
        setAuth("");
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
    document.title =
      route === "/blogs"
        ? "Community stories | Kerugoya Main SDA"
        : route === "/giving"
          ? "Giving | Kerugoya Main SDA Church"
          : "Kerugoya Main SDA Church";
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
