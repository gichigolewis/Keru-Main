import { useEffect, useMemo, useState } from "react";

const hymnalSourceUrl = "https://github.com/rejnac/sdah-hymnal";

const hymnStories = [
  {
    hymnNumber: 108,
    title: "Amazing Grace",
    author: "John Newton",
    date: "1772",
    background:
      "Newton's hymn grew out of his conversion and later ministry as an Anglican clergyman. He had worked in the Atlantic slave trade before leaving that life; in later years he spoke publicly against the trade. The hymn was first published in Olney Hymns in 1779.",
  },
  {
    hymnNumber: 530,
    title: "It Is Well with My Soul",
    author: "Horatio G. Spafford; music by Philip P. Bliss",
    date: "1870s",
    background:
      "Spafford wrote the words during a period of profound family loss. The hymn is often connected with his 1873 journey across the Atlantic, though popular retellings differ on exactly when and where he wrote it. Bliss later supplied the familiar tune.",
  },
  {
    hymnNumber: 473,
    title: "Nearer, My God, to Thee",
    author: "Sarah Flower Adams",
    date: "1841",
    background:
      "Adams wrote the hymn for a collection prepared with her sister. Its imagery draws on Jacob's dream at Bethel in Genesis 28, turning the biblical story into a prayer for closeness to God through every circumstance.",
  },
  {
    hymnNumber: 506,
    title: "A Mighty Fortress Is Our God",
    author: "Martin Luther",
    date: "c. 1529",
    background:
      "Luther's Reformation hymn is rooted in Psalm 46 and its picture of God as refuge and strength. It became one of the best-known German chorales and has been translated into many languages.",
  },
  {
    hymnNumber: 313,
    title: "Just as I Am",
    author: "Charlotte Elliott",
    date: "1835",
    background:
      "Elliott wrote this hymn after a conversation about faith and acceptance during a difficult period of illness. Its simple language became a widely used invitation to come to Christ without first trying to make oneself worthy.",
  },
  {
    hymnNumber: 462,
    title: "Blessed Assurance",
    author: "Fanny J. Crosby; music by Phoebe P. Knapp",
    date: "1873",
    background:
      "Knapp played a newly composed melody for her friend Crosby and asked what it brought to mind. Crosby responded with words of Christian confidence, and the hymn was published that year.",
  },
  {
    hymnNumber: 86,
    title: "How Great Thou Art",
    author: "Carl Boberg; English translation by Stuart K. Hine",
    date: "1885; English version, 1949",
    background:
      "The hymn began as Boberg's Swedish poem O Store Gud. It was translated into German and Russian before Hine created the English version familiar to many congregations.",
  },
  {
    hymnNumber: 499,
    title: "What a Friend We Have in Jesus",
    author: "Joseph M. Scriven; music by Charles C. Converse",
    date: "1855",
    background:
      "Scriven wrote the poem as a message of comfort for his mother. It was later set to Converse's tune and became a much-loved reminder to bring life's burdens to God in prayer.",
  },
  {
    hymnNumber: 2,
    title: "All Creatures of Our God and King",
    author: "Francis of Assisi; English translation by William H. Draper",
    date: "c. 1225; English version, early 20th century",
    background:
      "The hymn is based on Francis of Assisi's Canticle of the Sun, a poem praising God through the created world. Draper's English adaptation helped introduce it to congregations as a hymn of praise.",
  },
  {
    hymnNumber: 143,
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
  const [selectedHymnTab, setSelectedHymnTab] = useState("lyrics");
  const [visibleHymnCount, setVisibleHymnCount] = useState(36);
  const [hymns, setHymns] = useState([]);
  const [selectedHymnId, setSelectedHymnId] = useState(null);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueRetryKey, setCatalogueRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogueLoading(true);
    setCatalogueError("");

    fetch("/data/sdah-hymnal.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("The SDA hymnal catalogue could not be loaded.");
        }
        const catalogue = await response.json();
        if (
          catalogue.Abbreviation !== "SDAH" ||
          !Array.isArray(catalogue.Songs) ||
          catalogue.Songs.length !== 952 ||
          catalogue.Songs.some(
            (song) =>
              !Number.isInteger(song.ID) ||
              song.ID < 1 ||
              song.ID > 952 ||
              typeof song.Text !== "string" ||
              !Array.isArray(song.Verses),
          ) ||
          new Set(catalogue.Songs.map((song) => song.ID)).size !== 952
        ) {
          throw new Error("The SDA hymnal catalogue is incomplete or invalid.");
        }
        setHymns(
          catalogue.Songs.map((song) => ({
            id: song.ID,
            title: song.Text,
            verses: song.Verses.map((verse) =>
              typeof verse === "string" ? verse : verse.Text,
            ).filter((verse) => typeof verse === "string" && verse.trim()),
          })).sort((first, second) => first.id - second.id),
        );
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setCatalogueError(
            error.message || "The SDA hymnal catalogue could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogueLoading(false);
      });

    return () => controller.abort();
  }, [catalogueRetryKey]);

  useEffect(() => {
    setVisibleHymnCount(36);
  }, [query]);

  const filteredStories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return hymnStories;
    return hymnStories.filter((hymn) =>
      `${hymn.hymnNumber} ${hymn.title} ${hymn.author} ${hymn.date} ${hymn.background}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  const filteredHymns = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = hymns.filter((hymn) => {
      if (!normalizedQuery) return true;
      return (
        String(hymn.id).includes(normalizedQuery) ||
        hymn.title.toLocaleLowerCase().includes(normalizedQuery) ||
        hymn.verses.some((verse) =>
          verse.toLocaleLowerCase().includes(normalizedQuery),
        )
      );
    });
    return matches;
  }, [hymns, query]);

  const selectedHymn = hymns.find((hymn) => hymn.id === selectedHymnId);
  const selectedHymnStory = hymnStories.find(
    (story) => story.hymnNumber === selectedHymnId,
  );
  const sheetMusicSearchUrl = selectedHymn
    ? `https://www.google.com/search?q=${encodeURIComponent(`${selectedHymn.title} SDA hymnal sheet music`)}`
    : "";

  const openHymnNumber = (event) => {
    event.preventDefault();
    const number = Number(hymnNumber);
    if (Number.isInteger(number)) {
      const hymn = hymns.find((item) => item.id === number);
      if (hymn) {
        setSelectedHymnId(hymn.id);
        setSelectedHymnTab("lyrics");
        setQuery("");
      }
    }
  };

  return (
    <main className="resource-page hymnal-page">
      {selectedHymn ? (
        <section className="resource-content hymn-focus">
          <button
            type="button"
            className="resource-text-button hymn-back-button"
            onClick={() => setSelectedHymnId(null)}
          >
            <i className="bx bx-left-arrow-alt" aria-hidden="true" /> Back to hymnal
          </button>
          <header className="hymn-focus-heading">
            <span>Hymn {selectedHymn.id}</span>
            <h1>{selectedHymn.title}</h1>
          </header>
          <div className="resource-tabs hymn-detail-tabs" aria-label="Selected hymn sections">
            <button
              type="button"
              className={selectedHymnTab === "lyrics" ? "is-active" : ""}
              aria-pressed={selectedHymnTab === "lyrics"}
              onClick={() => setSelectedHymnTab("lyrics")}
            >
              <i className="bx bx-align-middle" aria-hidden="true" /> Lyrics
            </button>
            <button
              type="button"
              className={selectedHymnTab === "sheet" ? "is-active" : ""}
              aria-pressed={selectedHymnTab === "sheet"}
              onClick={() => setSelectedHymnTab("sheet")}
            >
              <i className="bx bx-music" aria-hidden="true" /> Sheet music
            </button>
            {selectedHymnStory && (
              <button
                type="button"
                className={selectedHymnTab === "story" ? "is-active" : ""}
                aria-pressed={selectedHymnTab === "story"}
                onClick={() => setSelectedHymnTab("story")}
              >
                <i className="bx bx-book-heart" aria-hidden="true" /> Story
              </button>
            )}
          </div>

          {selectedHymnTab === "lyrics" && (
            <div className="hymn-focus-lyrics">
              {selectedHymn.verses.map((verse, index) => (
                <p className="hymn-focus-verse" key={`${selectedHymn.id}-${index}`}>
                  <sup>{index + 1}</sup>
                  {verse}
                </p>
              ))}
            </div>
          )}
          {selectedHymnTab === "sheet" && (
            <section className="hymn-sheet-unavailable">
              <i className="bx bx-music" aria-hidden="true" />
              <h2>Sheet music</h2>
              <p>
                This text-only SDAH collection does not include notation for
                “{selectedHymn.title}”. Search for a score or check a licensed
                hymnal edition.
              </p>
              <div className="hymn-sheet-actions">
                <a
                  className="resource-primary-button"
                  href={sheetMusicSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Search for this sheet music
                  <i className="bx bx-link-external" aria-hidden="true" />
                </a>
                <a
                  className="resource-secondary-button"
                  href="https://hymnary.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Browse Hymnary
                  <i className="bx bx-link-external" aria-hidden="true" />
                </a>
              </div>
            </section>
          )}
          {selectedHymnTab === "story" && selectedHymnStory && (
            <article className="hymn-focus-story">
              <span>{selectedHymnStory.date}</span>
              <h2>{selectedHymnStory.title}</h2>
              <p className="hymn-focus-story-author">{selectedHymnStory.author}</p>
              <p>{selectedHymnStory.background}</p>
            </article>
          )}
          <p className="resource-content-note hymn-focus-attribution">
            Hymn text courtesy of the{" "}
            <a href={hymnalSourceUrl} target="_blank" rel="noreferrer">
              Rejnac Foundation SDAH Hymnal
            </a>{" "}
            under the MIT License.
          </p>
        </section>
      ) : (
        <>
          <header className="resource-hero">
            <span className="resource-eyebrow">Worship resources</span>
            <h1>Seventh-day Adventist Hymnal</h1>
            <p>Search all 952 hymns, read their lyrics, and explore the stories behind familiar songs.</p>
            <div className="resource-stat">
              <i className="bx bx-music" aria-hidden="true" />
              <strong>{catalogueLoading ? "…" : hymns.length}</strong>
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
                  disabled={catalogueLoading || Boolean(catalogueError)}
                  required
                />
                <button
                  className="resource-primary-button"
                  type="submit"
                  disabled={catalogueLoading || Boolean(catalogueError)}
                >
                  Go to hymn
                </button>
              </div>
            </form>

            {catalogueLoading && (
              <p className="resource-status" role="status">
                <i className="bx bx-loader-alt bx-spin" aria-hidden="true" /> Loading
                the SDA hymnal…
              </p>
            )}
            {catalogueError && (
              <div className="resource-error" role="alert">
                <i className="bx bx-error-circle" aria-hidden="true" />
                <span>{catalogueError}</span>
                <button
                  type="button"
                  className="resource-text-button"
                  onClick={() => setCatalogueRetryKey((current) => current + 1)}
                >
                  Retry
                </button>
              </div>
            )}

            <div className="resource-section-heading">
              <div>
                <h2>Browse the hymnal</h2>
                <p>Search by hymn number, title, or words in the lyrics.</p>
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
              Search all 952 hymns
            </label>
            <div className="resource-search-row">
              <input
                id="hymn-search"
                type="search"
                placeholder="Search by number, title, or lyrics"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={catalogueLoading || Boolean(catalogueError)}
              />
              <button
                className="resource-secondary-button"
                type="button"
                onClick={() => setQuery("")}
                disabled={!query || catalogueLoading}
              >
                Clear
              </button>
            </div>
            {!catalogueLoading && !catalogueError && (
              <>
                <p className="hymn-results-count" role="status">
                  Showing {Math.min(visibleHymnCount, filteredHymns.length)} of{" "}
                  {filteredHymns.length} matching hymns
                </p>
                <div className="hymn-card-grid">
                  {filteredHymns.slice(0, visibleHymnCount).map((hymn) => (
                    <button
                      className="hymn-card"
                      key={hymn.id}
                      type="button"
                      aria-pressed={selectedHymnId === hymn.id}
                      onClick={() => {
                        setSelectedHymnId(hymn.id);
                        setSelectedHymnTab("lyrics");
                        setHymnNumber(String(hymn.id));
                      }}
                    >
                      <span className="hymn-card-icon">#{hymn.id}</span>
                      <h3>{hymn.title}</h3>
                      <span className="resource-text-button">
                        Read hymn <i className="bx bx-right-arrow-alt" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                  {!filteredHymns.length && (
                    <p className="resource-empty" role="status">
                      No hymns match that search.
                    </p>
                  )}
                </div>
                {visibleHymnCount < filteredHymns.length && (
                  <button
                    className="resource-secondary-button hymn-show-more"
                    type="button"
                    onClick={() =>
                      setVisibleHymnCount((current) => current + 36)
                    }
                  >
                    Show more hymns
                    <i className="bx bx-chevron-down" aria-hidden="true" />
                  </button>
                )}
              </>
            )}
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
                  <button
                    type="button"
                    className="resource-text-button"
                    onClick={() => {
                      setSelectedHymnId(hymn.hymnNumber);
                      setSelectedHymnTab("lyrics");
                      setHymnNumber(String(hymn.hymnNumber));
                      setActiveTab("browse");
                    }}
                  >
                    Read hymn {hymn.hymnNumber}
                    <i className="bx bx-right-arrow-alt" aria-hidden="true" />
                  </button>
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
          Hymnal catalogue and lyrics are provided by the{" "}
          <a href={hymnalSourceUrl} target="_blank" rel="noreferrer">
            Rejnac Foundation SDAH Hymnal
          </a>{" "}
          under the MIT License.{" "}
          <a href="/data/SDAH-HYMNAL-LICENSE.txt">View license</a>.
        </p>
          </section>
        </>
      )}
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
