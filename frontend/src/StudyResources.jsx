import { useEffect, useMemo, useState } from "react";

const hymnAppSearchUrl =
  "https://play.google.com/store/search?q=Songs%20for%20Worship%20Pro&c=apps";

const hymnStories = [
  {
    title: "Amazing Grace",
    author: "John Newton",
    date: "1772",
    background:
      "Newton's hymn grew out of his conversion and later ministry as an Anglican clergyman. He had worked in the Atlantic slave trade before leaving that life; in later years he spoke publicly against the trade. The hymn was first published in Olney Hymns in 1779.",
  },
  {
    title: "It Is Well with My Soul",
    author: "Horatio G. Spafford; music by Philip P. Bliss",
    date: "1870s",
    background:
      "Spafford wrote the words during a period of profound family loss. The hymn is often connected with his 1873 journey across the Atlantic, though popular retellings differ on exactly when and where he wrote it. Bliss later supplied the familiar tune.",
  },
  {
    title: "Nearer, My God, to Thee",
    author: "Sarah Flower Adams",
    date: "1841",
    background:
      "Adams wrote the hymn for a collection prepared with her sister. Its imagery draws on Jacob's dream at Bethel in Genesis 28, turning the biblical story into a prayer for closeness to God through every circumstance.",
  },
  {
    title: "A Mighty Fortress Is Our God",
    author: "Martin Luther",
    date: "c. 1529",
    background:
      "Luther's Reformation hymn is rooted in Psalm 46 and its picture of God as refuge and strength. It became one of the best-known German chorales and has been translated into many languages.",
  },
  {
    title: "Just as I Am",
    author: "Charlotte Elliott",
    date: "1835",
    background:
      "Elliott wrote this hymn after a conversation about faith and acceptance during a difficult period of illness. Its simple language became a widely used invitation to come to Christ without first trying to make oneself worthy.",
  },
  {
    title: "Blessed Assurance",
    author: "Fanny J. Crosby; music by Phoebe P. Knapp",
    date: "1873",
    background:
      "Knapp played a newly composed melody for her friend Crosby and asked what it brought to mind. Crosby responded with words of Christian confidence, and the hymn was published that year.",
  },
  {
    title: "How Great Thou Art",
    author: "Carl Boberg; English translation by Stuart K. Hine",
    date: "1885; English version, 1949",
    background:
      "The hymn began as Boberg's Swedish poem O Store Gud. It was translated into German and Russian before Hine created the English version familiar to many congregations.",
  },
  {
    title: "What a Friend We Have in Jesus",
    author: "Joseph M. Scriven; music by Charles C. Converse",
    date: "1855",
    background:
      "Scriven wrote the poem as a message of comfort for his mother. It was later set to Converse's tune and became a much-loved reminder to bring life's burdens to God in prayer.",
  },
  {
    title: "All Creatures of Our God and King",
    author: "Francis of Assisi; English translation by William H. Draper",
    date: "c. 1225; English version, early 20th century",
    background:
      "The hymn is based on Francis of Assisi's Canticle of the Sun, a poem praising God through the created world. Draper's English adaptation helped introduce it to congregations as a hymn of praise.",
  },
  {
    title: "Silent Night",
    author: "Joseph Mohr; music by Franz Xaver Gruber",
    date: "1818",
    background:
      "Mohr wrote the German words and asked Gruber to compose a melody for a Christmas Eve service in Oberndorf, Austria. It was first performed there in 1818 and later spread around the world.",
  },
];

const bibleBooks = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36],
  ["Deuteronomy", 34], ["Joshua", 24], ["Judges", 21], ["Ruth", 4],
  ["1 Samuel", 31], ["2 Samuel", 24], ["1 Kings", 22], ["2 Kings", 25],
  ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10], ["Nehemiah", 13],
  ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31],
  ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66], ["Jeremiah", 52],
  ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14],
  ["Joel", 3], ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7],
  ["Nahum", 3], ["Habakkuk", 3], ["Zephaniah", 3], ["Haggai", 2],
  ["Zechariah", 14], ["Malachi", 4], ["Matthew", 28], ["Mark", 16],
  ["Luke", 24], ["John", 21], ["Acts", 28], ["Romans", 16],
  ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6],
  ["Ephesians", 6], ["Philippians", 4], ["Colossians", 4],
  ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6],
  ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13],
  ["James", 5], ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5],
  ["2 John", 1], ["3 John", 1], ["Jude", 1], ["Revelation", 22],
].map(([name, chapters]) => ({ name, chapters }));

export function Hymnal() {
  const [activeTab, setActiveTab] = useState("browse");
  const [query, setQuery] = useState("");
  const [hymnNumber, setHymnNumber] = useState("");
  const [openedNumber, setOpenedNumber] = useState("");

  const filteredStories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return hymnStories;
    return hymnStories.filter((hymn) =>
      `${hymn.title} ${hymn.author} ${hymn.date} ${hymn.background}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  const openHymnNumber = (event) => {
    event.preventDefault();
    const number = Number(hymnNumber);
    if (Number.isInteger(number) && number >= 1 && number <= 952) {
      setOpenedNumber(String(number));
    }
  };

  return (
    <main className="resource-page hymnal-page">
      <header className="resource-hero">
        <span className="resource-eyebrow">Worship resources</span>
        <h1>Seventh-day Adventist Hymnal</h1>
        <p>
          Browse hymn numbers or explore the stories behind selected
          public-domain hymns.
        </p>
        <div className="resource-stat">
          <i className="bx bx-music" aria-hidden="true" />
          <strong>952</strong>
          <span>hymn numbers</span>
        </div>
      </header>

      <section className="resource-content">
        <div className="resource-tabs" aria-label="Hymnal sections">
          <button
            type="button"
            className={activeTab === "browse" ? "is-active" : ""}
            aria-pressed={activeTab === "browse"}
            onClick={() => setActiveTab("browse")}
          >
            <i className="bx bx-list-ol" aria-hidden="true" /> Browse hymns
          </button>
          <button
            type="button"
            className={activeTab === "stories" ? "is-active" : ""}
            aria-pressed={activeTab === "stories"}
            onClick={() => setActiveTab("stories")}
          >
            <i className="bx bx-book-heart" aria-hidden="true" /> Hymn stories
          </button>
        </div>

        {activeTab === "browse" ? (
          <>
            <form className="hymn-number-form" onSubmit={openHymnNumber}>
              <label htmlFor="hymn-number">Go to a hymn number</label>
              <div className="resource-search-row">
                <input
                  id="hymn-number"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="952"
                  step="1"
                  placeholder="Enter 1–952"
                  value={hymnNumber}
                  onChange={(event) => setHymnNumber(event.target.value)}
                  required
                />
                <button className="resource-primary-button" type="submit">
                  Go to hymn
                </button>
              </div>
            </form>

            {openedNumber && (
              <article className="hymn-source-card" aria-live="polite">
                <div className="hymn-source-number">Hymn {openedNumber}</div>
                <div>
                  <h2>Open this hymn in your hymnal app</h2>
                  <p>
                    The selected number is within the 952-hymn collection. The
                    app does not reproduce licensed titles or lyrics.
                  </p>
                  <a href={hymnAppSearchUrl} target="_blank" rel="noreferrer">
                    Find Songs for Worship Pro
                    <i className="bx bx-link-external" aria-hidden="true" />
                  </a>
                </div>
              </article>
            )}

            <div className="resource-section-heading">
              <div>
                <h2>Featured public-domain hymns</h2>
                <p>Read historical notes without reproducing licensed lyrics.</p>
              </div>
              <button
                type="button"
                className="resource-text-button"
                onClick={() => setActiveTab("stories")}
              >
                Explore stories <i className="bx bx-right-arrow-alt" aria-hidden="true" />
              </button>
            </div>
            <label className="resource-search-label" htmlFor="hymn-search">
              Search featured hymns
            </label>
            <div className="resource-search-row">
              <input
                id="hymn-search"
                type="search"
                placeholder="Search title, author, or background"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                className="resource-secondary-button"
                type="button"
                onClick={() => setQuery("")}
                disabled={!query}
              >
                Clear
              </button>
            </div>
            <div className="hymn-card-grid">
              {filteredStories.map((hymn) => (
                <article className="hymn-card" key={hymn.title}>
                  <span className="hymn-card-icon">
                    <i className="bx bx-music" aria-hidden="true" />
                  </span>
                  <h3>{hymn.title}</h3>
                  <p>{hymn.author}</p>
                  <button
                    type="button"
                    className="resource-text-button"
                    onClick={() => {
                      setQuery(hymn.title);
                      setActiveTab("stories");
                    }}
                  >
                    Learn the story <i className="bx bx-right-arrow-alt" aria-hidden="true" />
                  </button>
                </article>
              ))}
              {!filteredStories.length && (
                <p className="resource-empty" role="status">
                  No featured public-domain hymns match that search.
                </p>
              )}
            </div>
          </>
        ) : (
          <section className="hymn-stories-section">
            <div className="resource-section-heading">
              <div>
                <h2>Stories behind the hymns</h2>
                <p>
                  Discover the people, scripture, and circumstances behind
                  familiar songs.
                </p>
              </div>
            </div>
            <label className="resource-search-label" htmlFor="story-search">
              Search hymn stories
            </label>
            <input
              id="story-search"
              type="search"
              placeholder="Search title, author, or background"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="hymn-story-list">
              {filteredStories.map((hymn) => (
                <article className="hymn-story" key={hymn.title}>
                  <div className="hymn-story-heading">
                    <div>
                      <span>{hymn.date}</span>
                      <h3>{hymn.title}</h3>
                      <p>{hymn.author}</p>
                    </div>
                    <i className="bx bx-book-heart" aria-hidden="true" />
                  </div>
                  <p className="hymn-story-background">{hymn.background}</p>
                </article>
              ))}
              {!filteredStories.length && (
                <p className="resource-empty" role="status">
                  No hymn stories match that search.
                </p>
              )}
            </div>
          </section>
        )}
        <p className="resource-content-note">
          Full hymn titles and lyrics from third-party collections are not
          reproduced here. Use the original hymnal or licensed app for that
          content.
        </p>
      </section>
    </main>
  );
}

export function BibleReader() {
  const [bookName, setBookName] = useState("Genesis");
  const [chapter, setChapter] = useState(1);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const book = bibleBooks.find((item) => item.name === bookName) || bibleBooks[0];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setVerses([]);

    const reference = encodeURIComponent(`${bookName} ${chapter}`);
    fetch(`https://bible-api.com/${reference}?translation=kjv`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "The Bible chapter could not be loaded.");
        }
        if (!Array.isArray(result.verses)) {
          throw new Error("The Bible service returned an unexpected response.");
        }
        setVerses(result.verses);
      })
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message || "The Bible chapter could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [bookName, chapter, retryKey]);

  const changeChapter = (direction) => {
    const nextChapter = chapter + direction;
    if (nextChapter >= 1 && nextChapter <= book.chapters) {
      setChapter(nextChapter);
    }
  };

  return (
    <main className="resource-page bible-page">
      <header className="resource-hero">
        <span className="resource-eyebrow">Worship resources</span>
        <h1>Read the Bible</h1>
        <p>Browse all 66 books in the King James Version.</p>
        <div className="resource-stat">
          <i className="bx bx-book-open" aria-hidden="true" />
          <strong>66</strong>
          <span>books</span>
        </div>
      </header>

      <section className="resource-content bible-content">
        <div className="bible-controls">
          <label>
            <span>Book</span>
            <select
              value={bookName}
              onChange={(event) => {
                setBookName(event.target.value);
                setChapter(1);
              }}
            >
              {bibleBooks.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Chapter</span>
            <select
              value={chapter}
              onChange={(event) => setChapter(Number(event.target.value))}
            >
              {Array.from({ length: book.chapters }, (_, index) => index + 1).map(
                (number) => (
                  <option key={number} value={number}>{number}</option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className="bible-reading-heading">
          <div>
            <span>King James Version</span>
            <h2>{bookName} {chapter}</h2>
          </div>
          <div className="bible-chapter-actions">
            <button
              type="button"
              className="resource-secondary-button"
              onClick={() => changeChapter(-1)}
              disabled={chapter === 1 || loading}
              aria-label="Previous chapter"
            >
              <i className="bx bx-chevron-left" aria-hidden="true" /> Previous
            </button>
            <button
              type="button"
              className="resource-secondary-button"
              onClick={() => changeChapter(1)}
              disabled={chapter === book.chapters || loading}
              aria-label="Next chapter"
            >
              Next <i className="bx bx-chevron-right" aria-hidden="true" />
            </button>
          </div>
        </div>

        {loading && (
          <p className="resource-status" role="status">
            <i className="bx bx-loader-alt bx-spin" aria-hidden="true" /> Loading
            {` ${bookName} ${chapter}…`}
          </p>
        )}
        {error && (
          <div className="resource-error" role="alert">
            <i className="bx bx-error-circle" aria-hidden="true" />
            <span>{error} Check your connection and try again.</span>
            <button
              type="button"
              className="resource-text-button"
              onClick={() => setRetryKey((current) => current + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <article className="bible-verses" aria-label={`${bookName} chapter ${chapter}`}>
            {verses.map((verse) => (
              <p className="bible-verse" key={`${verse.chapter}-${verse.verse}`}>
                <sup>{verse.verse}</sup>
                {verse.text.trim()}
              </p>
            ))}
          </article>
        )}
        <p className="resource-content-note">
          King James Version text is public domain. Chapter text is provided
          online by Bible API.
        </p>
      </section>
    </main>
  );
}
