const BLOG_KEY = "keruCommunityPosts";
const USER_KEY = "keruCurrentUser";

const starterPosts = [
    {
        id: "welcome-story",
        title: "The quiet miracle of showing up",
        content: "Some weeks, faith looks less like a grand answer and more like making it to church, sitting beside someone, and choosing hope again. I am grateful for the people who keep showing up.",
        category: "Faith",
        author: "Miriam Njeri",
        date: "2026-09-06",
        likes: 18,
        likedBy: [],
        comments: [{ author: "Daniel K.", content: "This met me exactly where I am. Thank you." }]
    },
    {
        id: "school-drive",
        title: "A Saturday of practical love",
        content: "Our youth team packed learning kits for forty students this weekend. The best part was hearing everyone share what they hope to become. Thank you to every hand that helped.",
        category: "Service",
        author: "Joel Mwangi",
        date: "2026-09-04",
        likes: 12,
        likedBy: [],
        comments: [{ author: "Grace W.", content: "Proud of this team. Count me in for the next one." }]
    },
    {
        id: "small-table",
        title: "What I learned around a small table",
        content: "Our home fellowship was only six people, but the conversation stayed with me all week. There is something powerful about being known by name and prayed for specifically.",
        category: "Life",
        author: "Faith Wambui",
        date: "2026-09-01",
        likes: 9,
        likedBy: [],
        comments: []
    }
];

let activeCategory = "All";
let currentUser = readCurrentUser();

function readCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (error) {
        return null;
    }
}

function readPosts() {
    try {
        const saved = JSON.parse(localStorage.getItem(BLOG_KEY));
        if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {
        // Fall back to the starter stories below.
    }
    localStorage.setItem(BLOG_KEY, JSON.stringify(starterPosts));
    return starterPosts;
}

function savePosts(posts) {
    localStorage.setItem(BLOG_KEY, JSON.stringify(posts));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
}

function formatDate(date) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function renderPosts() {
    const postsList = document.getElementById("posts-list");
    const sort = document.getElementById("sort-posts").value;
    let posts = readPosts().filter((post) => activeCategory === "All" || post.category === activeCategory);
    posts.sort((first, second) => sort === "liked" ? second.likes - first.likes : new Date(second.date) - new Date(first.date));
    document.getElementById("post-count").textContent = readPosts().length;

    postsList.innerHTML = posts.length ? posts.map((post) => `
        <article class="post-card" data-post-id="${escapeHtml(post.id)}">
            <div class="post-meta"><span class="post-category">${escapeHtml(post.category)}</span><time>${formatDate(post.date)}</time></div>
            <h2>${escapeHtml(post.title)}</h2>
            <p>${escapeHtml(post.content)}</p>
            <div class="post-footer"><span class="post-author"><i class="bx bxs-user-circle"></i> ${escapeHtml(post.author)}</span><button class="like-button ${post.likedBy.includes(currentUser?.email) ? "is-liked" : ""}" data-action="like" type="button"><i class="bx ${post.likedBy.includes(currentUser?.email) ? "bxs-heart" : "bx-heart"}"></i> <span>${post.likes}</span></button><button class="comment-toggle" data-action="comments" type="button"><i class="bx bx-message-rounded"></i> ${post.comments.length}</button></div>
            <div class="comments" data-comments-for="${escapeHtml(post.id)}">${post.comments.map((comment) => `<div class="comment"><strong>${escapeHtml(comment.author)}</strong><span>${escapeHtml(comment.content)}</span></div>`).join("")}<form class="comment-form" data-action="comment-form"><input name="comment" type="text" maxlength="240" placeholder="Add to the conversation..." required><button type="submit" aria-label="Post comment"><i class="bx bx-send"></i></button></form></div>
        </article>
    `).join("") : '<p class="empty-state">No stories in this category yet. Be the first to share one.</p>';
}

document.getElementById("posts-list").addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const posts = readPosts();
    const post = posts.find((item) => item.id === actionTarget.closest(".post-card").dataset.postId);
    if (!post) return;

    if (actionTarget.dataset.action === "like") {
        if (!currentUser) {
            window.location.href = "login.html";
            return;
        }
        const userIndex = post.likedBy.indexOf(currentUser.email);
        if (userIndex >= 0) {
            post.likedBy.splice(userIndex, 1);
            post.likes -= 1;
        } else {
            post.likedBy.push(currentUser.email);
            post.likes += 1;
        }
        savePosts(posts);
        renderPosts();
    }

    if (actionTarget.dataset.action === "comments") {
        actionTarget.closest(".post-card").classList.toggle("comments-open");
    }
});

document.getElementById("posts-list").addEventListener("submit", (event) => {
    if (!event.target.matches(".comment-form")) return;
    event.preventDefault();
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }
    const card = event.target.closest(".post-card");
    const posts = readPosts();
    const post = posts.find((item) => item.id === card.dataset.postId);
    const value = new FormData(event.target).get("comment").trim();
    if (!value) return;
    post.comments.push({ author: currentUser.name, content: value });
    savePosts(posts);
    renderPosts();
    document.querySelector(`[data-post-id="${card.dataset.postId}"]`).classList.add("comments-open");
});

document.getElementById("post-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }
    const posts = readPosts();
    posts.unshift({
        id: `post-${Date.now()}`,
        title: document.getElementById("post-title").value.trim(),
        content: document.getElementById("post-content").value.trim(),
        category: document.getElementById("post-category").value,
        author: currentUser.name,
        date: new Date().toISOString().slice(0, 10),
        likes: 0,
        likedBy: [],
        comments: []
    });
    savePosts(posts);
    event.target.reset();
    document.getElementById("compose-message").textContent = "Your story is live. Thank you for sharing.";
    renderPosts();
});

document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(".filter-tab.is-active").classList.remove("is-active");
    button.classList.add("is-active");
    activeCategory = button.dataset.category;
    renderPosts();
}));

document.getElementById("sort-posts").addEventListener("change", renderPosts);
document.getElementById("logout-button").addEventListener("click", () => {
    localStorage.removeItem(USER_KEY);
    window.location.href = "index.html";
});

document.getElementById("member-name").textContent = currentUser ? `Hi, ${currentUser.name.split(" ")[0]}` : "Guest reader";
renderPosts();
