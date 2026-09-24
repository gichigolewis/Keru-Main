import { useEffect, useState } from "react";
import logoImage from "../assets/images/sda logo.png";

const imagePath = logoImage;
const currentUserKey = "keruCurrentUser";
const accountKey = "keruAccounts";
const postsKey = "keruCommunityPosts";
const announcementsKey = "announcements";

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

const seededPostIds = new Set([
  "welcome-story",
  "school-drive",
  "small-table",
]);

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

function PublicHeader() {
  const countdown = useCountdown();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    ["/", "bx-home-alt-2", "Home"],
    ["/about.html", "bx-user", "About"],
    ["/ministries.html", "bx-group", "Ministries"],
    ["/sermons.html", "bx-tv", "Sermons"],
    ["/blogs.html", "bx-conversation", "Community"],
  ];
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
          {links.map(([href, icon, label]) => (
            <li key={href}>
              <Link href={href}>
                <i className={`bx ${icon}`} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
          <li>
            <a href="#">
              <i className="bx bx-donate-heart" />
              <span>Giving</span>
            </a>
          </li>
        </ul>
        <div className="announcements">
          <Link href="/announcements.html">
            <i className="bx bx-bell" />
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
            <i className="bx bx-phone" /> +254 796 563 833
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
            <a href="#">Giving</a>
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
      <Scripture />
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
function Sermons() {
  const [videos, setVideos] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/sermons");
        if (response.ok) {
          setVideos(await response.json());
          return;
        }
      } catch {}
      setVideos([
        [
          "Mq3AE7uncHw",
          "THE MAN WHO CHOPPED THE SCRIPTURES || Bro. DENNIS MURIITHI",
        ],
        [
          "nWpu9D5tE1g",
          "KERUGOYA MAIN SDA CHURCH || GOOD FAITH CHILDRENS HOME",
        ],
        ["G183uFMOWMI", "Ni Mbaya || Sis. Eliza || Kerugoya Main SDA church"],
        ["Dmbi12ChCec", "Who is your Redeemer || Pr. Rei Kesis"],
        ["k1Yg0Lh5DCA", "Tunataka Power By Bro. Edwin Murimi"],
      ]);
    })();
  }, []);
  return (
    <PublicShell>
      <section className="sermons">
        <div className="video-gallery">{videos.map(renderSermon)}</div>
      </section>
    </PublicShell>
  );
}

function Account({ register = false }) {
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = data.get("email").trim().toLowerCase();
    const password = data.get("password");
    const accounts = readJson(accountKey, []);
    if (register) {
      const name = data.get("name").trim();
      if (accounts.some((account) => account.email === email)) {
        setMessage("An account with that email already exists.");
        return;
      }
      accounts.push({ name, email, password });
      localStorage.setItem(accountKey, JSON.stringify(accounts));
      localStorage.setItem(currentUserKey, JSON.stringify({ name, email }));
      navigate("/blogs.html");
    } else {
      const account = accounts.find(
        (item) => item.email === email && item.password === password,
      );
      if (!account) {
        setMessage(
          "We could not match those details. Try again or create an account.",
        );
        return;
      }
      localStorage.setItem(
        currentUserKey,
        JSON.stringify({ name: account.name, email: account.email }),
      );
      navigate("/blogs.html");
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
              ? "Your first name will appear beside your posts."
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
              minLength={register ? 6 : undefined}
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
          <button className="btn form-submit" type="submit">
            {register ? "Create account" : "Sign in"}{" "}
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

function Announcements() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/announcements", {
          cache: "no-store",
        });
        if (response.ok) {
          setItems(await response.json());
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
                <p>{item.content}</p>
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
  return (
    <PublicShell>
      <main className="responsive-page">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.body}</p>
        {isFormPage ? (
          <form className="responsive-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Your name
              <input name="name" required />
            </label>
            <label>
              Your message
              <textarea name="message" rows="5" required />
            </label>
            <button className="btn" type="submit">Send message <i className="bx bx-send" /></button>
          </form>
        ) : (
          <a className="btn" href="tel:+254712345678">Call the church <i className="bx bx-phone" /></a>
        )}
      </main>
    </PublicShell>
  );
}

function Community() {
  const [user, setUser] = useState(() => readJson(currentUserKey, null));
  const [posts, setPosts] = useState(() => {
    const saved = readJson(postsKey, []);
    const memberPosts = saved.filter((post) => !seededPostIds.has(post.id));
    if (memberPosts.length !== saved.length) {
      localStorage.setItem(postsKey, JSON.stringify(memberPosts));
    }
    return memberPosts;
  });
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("recent");
  const [openComments, setOpenComments] = useState(null);
  const save = (next) => {
    setPosts(next);
    localStorage.setItem(postsKey, JSON.stringify(next));
  };
  const visible = posts
    .filter((post) => category === "All" || post.category === category)
    .sort((a, b) =>
      sort === "liked"
        ? b.likes - a.likes
        : new Date(b.date) - new Date(a.date),
    );
  const like = (post) => {
    if (!user) {
      navigate("/login.html");
      return;
    }
    save(
      posts.map((item) =>
        item.id === post.id
          ? {
              ...item,
              likes: item.likedBy.includes(user.email)
                ? item.likes - 1
                : item.likes + 1,
              likedBy: item.likedBy.includes(user.email)
                ? item.likedBy.filter((email) => email !== user.email)
                : [...item.likedBy, user.email],
            }
          : item,
      ),
    );
  };
  const addComment = (event, post) => {
    event.preventDefault();
    if (!user) {
      navigate("/login.html");
      return;
    }
    const value = new FormData(event.currentTarget).get("comment").trim();
    if (!value) return;
    save(
      posts.map((item) =>
        item.id === post.id
          ? {
              ...item,
              comments: [
                ...item.comments,
                { author: user.name, content: value },
              ],
            }
          : item,
      ),
    );
    event.currentTarget.reset();
    setOpenComments(post.id);
  };
  const publish = (event) => {
    event.preventDefault();
    if (!user) {
      navigate("/login.html");
      return;
    }
    const data = new FormData(event.currentTarget);
    save([
      {
        id: `post-${Date.now()}`,
        title: data.get("title").trim(),
        content: data.get("content").trim(),
        category: data.get("category"),
        author: user.name,
        date: new Date().toISOString().slice(0, 10),
        likes: 0,
        likedBy: [],
        comments: [],
      },
      ...posts,
    ]);
    event.currentTarget.reset();
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
            </Link>
            <span className="member-name">
              {user ? `Hi, ${user.name.split(" ")[0]}` : "Guest reader"}
            </span>
            {user ? (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  localStorage.removeItem(currentUserKey);
                  setUser(null);
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
            <span className="eyebrow">The church beyond Sunday</span>
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
                    key={item}
                    onClick={() => setCategory(item)}
                  >
                    {item === "All" ? "All stories" : item}
                  </button>
                ))}
              </div>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Sort posts"
              >
                <option value="recent">Most recent</option>
                <option value="liked">Most loved</option>
              </select>
            </div>
            <div className="posts-list">
              {visible.length ? (
                visible.map((post) => (
                  <article
                    className={`post-card ${openComments === post.id ? "comments-open" : ""}`}
                    key={post.id}
                  >
                    <div className="post-meta">
                      <span className="post-category">{post.category}</span>
                      <time>
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(`${post.date}T12:00:00`))}
                      </time>
                    </div>
                    <h2>{post.title}</h2>
                    <p>{post.content}</p>
                    <div className="post-footer">
                      <span className="post-author">
                        <i className="bx bx-user-circle" /> {post.author}
                      </span>
                      <button
                        className={`like-button ${user && post.likedBy.includes(user.email) ? "is-liked" : ""}`}
                        data-action="like"
                        type="button"
                        onClick={() => like(post)}
                      >
                        <i
                          className={`bx ${user && post.likedBy.includes(user.email) ? "bx-heart" : "bx-heart"}`}
                        />{" "}
                        {post.likes}
                      </button>
                      <button
                        className="comment-toggle"
                        type="button"
                        onClick={() =>
                          setOpenComments(
                            openComments === post.id ? null : post.id,
                          )
                        }
                      >
                        <i className="bx bx-message-rounded" />{" "}
                        {post.comments.length}
                      </button>
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
                <p className="empty-state">
                  No stories in this category yet. Be the first to share one.
                </p>
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
                    maxLength="700"
                    required
                  />
                  <button className="btn" type="submit">
                    Publish story <i className="bx bx-send" />
                  </button>
                </form>
              ) : (
                <div className="member-submit-prompt">
                  <p>Sign in as a member to share your story with the church family.</p>
                  <Link className="btn" href="/login.html">
                    Sign in to submit <i className="bx bx-log-in" />
                  </Link>
                </div>
              )}
            </section>
            <section className="community-aside-note">
              <i className="bx bx-quote-alt-left" />
              <p>“Encourage one another and build each other up.”</p>
              <span>1 Thessalonians 5:11</span>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const header = `Basic ${window.btoa(`${data.username}:${data.password}`)}`;
    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Invalid admin credentials");
      const result = await response.json();
      sessionStorage.setItem("adminAuth", header);
      sessionStorage.setItem("adminUser", result.username);
      onLogin(header, result.username);
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <main className="admin-page account-shell">
      <Link className="account-brand" href="/">
        <img src={imagePath} alt="" /> Kerugoya Main SDA
      </Link>
      <section className="admin-login-panel">
        <span className="eyebrow">Staff access</span>
        <h1>Welcome to the dashboard.</h1>
        <p>
          Manage church updates, sermons, and the people who help keep this
          space alive.
        </p>
        <form className="account-form" onSubmit={submit}>
          <label htmlFor="admin-username">Username</label>
          <input
            id="admin-username"
            name="username"
            required
            autoComplete="username"
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <button className="btn form-submit" type="submit">
            Sign in <i className="bx bx-arrow-up-right" />
          </button>
          <p className="form-message is-error" role="status">
            {message}
          </p>
        </form>
      </section>
    </main>
  );
}

function AdminDashboard({ auth, username, onLogout }) {
  const [tab, setTab] = useState("announcements");
  const [announcements, setAnnouncements] = useState([]);
  const [sermons, setSermons] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [message, setMessage] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: auth };
  const load = async () => {
    const [announcementResponse, sermonResponse, adminResponse] =
      await Promise.all([
        fetch("/api/announcements"),
        fetch("/api/sermons"),
        fetch("/api/admins", { headers: { Authorization: auth } }),
      ]);
    setAnnouncements(
      announcementResponse.ok ? await announcementResponse.json() : [],
    );
    setSermons(sermonResponse.ok ? await sermonResponse.json() : []);
    setAdmins(adminResponse.ok ? await adminResponse.json() : []);
  };
  useEffect(() => {
    load().catch(() => setMessage("Could not load dashboard data."));
  }, []);
  const submit = async (event, endpoint, method = "POST") => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      setMessage((await response.json()).error || "Request failed.");
      return;
    }
    form.reset();
    setMessage("Saved successfully.");
    await load();
  };
  const remove = async (endpoint) => {
    if (!window.confirm("Delete this item?")) return;
    await fetch(endpoint, {
      method: "DELETE",
      headers: { Authorization: auth },
    });
    await load();
  };
  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="logo" href="/">
          <img src={imagePath} alt="" />
          <span>Kerugoya Main SDA</span>
        </Link>
        <div>
          <span className="admin-welcome">Hi, {username}</span>
          <button className="text-button" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <span className="eyebrow">Control room</span>
          <h1>Dashboard</h1>
          <div className="admin-tab-list">
            {[
              ["announcements", "Announcements"],
              ["sermons", "Sermons"],
              ["admins", "Admins"],
            ].map(([value, label]) => (
              <button
                className={tab === value ? "admin-tab is-active" : "admin-tab"}
                type="button"
                key={value}
                onClick={() => setTab(value)}
              >
                <i
                  className={`bx ${value === "announcements" ? "bx-megaphone" : value === "sermons" ? "bx-video" : "bx-user-plus"}`}
                />
                {label}
              </button>
            ))}
          </div>
        </aside>
        <section className="admin-content">
          <p className="form-message" role="status">
            {message}
          </p>
          {tab === "announcements" && (
            <>
              <h2>Create announcement</h2>
              <form
                className="admin-form"
                onSubmit={(event) => submit(event, "/api/announcements")}
              >
                <input name="title" placeholder="Title" required />
                <input name="date" type="date" />
                <textarea
                  name="content"
                  rows="5"
                  placeholder="Announcement details"
                  required
                />
                <button className="btn" type="submit">
                  Publish announcement
                </button>
              </form>
              <div className="admin-list">
                {announcements.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.content}</p>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Delete announcement"
                      onClick={() => remove(`/api/announcements/${item.id}`)}
                    >
                      <i className="bx bx-trash" />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "sermons" && (
            <>
              <h2>Post sermon</h2>
              <form
                className="admin-form"
                onSubmit={(event) => submit(event, "/api/sermons")}
              >
                <input name="title" placeholder="Sermon title" required />
                <input
                  name="youtubeId"
                  placeholder="YouTube video ID"
                  required
                />
                <input name="date" type="date" />
                <button className="btn" type="submit">
                  Publish sermon
                </button>
              </form>
              <div className="admin-list">
                {sermons.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.youtubeId}</p>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Delete sermon"
                      onClick={() => remove(`/api/sermons/${item.id}`)}
                    >
                      <i className="bx bx-trash" />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "admins" && (
            <>
              <h2>Add another admin</h2>
              <form
                className="admin-form"
                onSubmit={(event) => submit(event, "/api/admins")}
              >
                <input name="username" placeholder="Username" required />
                <input
                  name="password"
                  type="password"
                  placeholder="Temporary password"
                  required
                />
                <button className="btn" type="submit">
                  Add admin
                </button>
              </form>
              <div className="admin-list">
                {admins.map((item) => (
                  <article key={item.id}>
                    <strong>{item.username}</strong>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Remove admin"
                      onClick={() => remove(`/api/admins/${item.id}`)}
                    >
                      <i className="bx bx-trash" />
                    </button>
                  </article>
                ))}
              </div>
            </>
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
        : "Kerugoya Main SDA Church";
  }, [route]);
  if (route === "/about") return <About />;
  if (route === "/ministries") return <Ministries />;
  if (route === "/sermons") return <Sermons />;
  if (route === "/blogs") return <Community />;
  if (route === "/login") return <Account />;
  if (route === "/register") return <Account register />;
  if (route === "/announcements") return <Announcements />;
  if (responsivePages[route.slice(1)]) {
    return <ResponsivePage page={route.slice(1)} />;
  }
  if (route === "/admin") return <Admin />;
  return <Home />;
}
