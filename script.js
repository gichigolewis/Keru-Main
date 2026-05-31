const button = document.querySelector(".btn");
const menu = document.querySelector(".menu");
const nav = document.querySelector(".nav");
const navLinks = document.querySelectorAll(".nav a");
const footerDate = document.getElementById("current-year");
const aside = document.querySelector("aside");
const joinBtn = document.querySelector(".join");
// Set the current year in the footer
footerDate.textContent = new Date().getFullYear();

// 1. Define modular open and close functions
const openMenu = () => {
    aside.style.display = "block";
    aside.offsetHeight; // Force browser reflow to guarantee CSS animation plays
    aside.classList.remove("slide-out");
    aside.classList.add("slide-in");
    joinBtn.style.display = "block"; // Show the Join Us button when menu opens
};

const closeMenu = () => {
    // Guard clause: Only run close logic if the menu is actually open
    if (!aside.classList.contains("slide-in")) return;

    aside.classList.remove("slide-in");
    aside.classList.add("slide-out");
    
    // Hide display after CSS transition completes (match your transition duration, e.g., 300ms)
    setTimeout(() => {
        if (aside.classList.contains("slide-out")) {
            aside.style.display = "none";
        }
    }, 300); 
};

// 2. Toggle menu when clicking the menu button
menu.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevents this click from immediately triggering the document listener
    const isOpen = aside.classList.contains("slide-in");
    
    if (isOpen) {
        closeMenu();
    } else {
        openMenu();
    }
});

// 3. Auto-close when clicking outside the aside section
document.addEventListener("click", (e) => {
    // If the click happened OUTSIDE the aside AND OUTSIDE the menu button, close it
    if (!aside.contains(e.target) && !menu.contains(e.target)) {
        closeMenu();
    }
});



// 4. Auto-close when the user scrolls
// window.addEventListener("scroll", () => {
//     closeMenu();
// }, { passive: true }); // Optimizes scroll performance


// button.addEventListener('click', () => {
//     alert("Feature coming soon")
// })
  
  // Sabbath Countdown Logic
        function updateSabbathCountdown() {
            const now = new Date();
            
            // Calculate time until next Friday at 18:00 (Sunset Proxy)
            const dayOfWeek = now.getDay(); 
            let daysUntilFriday = 5 - dayOfWeek;
            
            // If it's past Friday 6 PM or it's Saturday, aim for next week's Friday
            if (daysUntilFriday < 0 || (daysUntilFriday === 0 && now.getHours() >= 18)) {
                daysUntilFriday += 7; 
            }
            
            const nextFriday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFriday);
            nextFriday.setHours(18, 0, 0, 0);

            const diff = nextFriday - now;

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);

            // Determine if it's currently Sabbath
            if (dayOfWeek === 6 || (dayOfWeek === 5 && now.getHours() >= 18)) {
                document.getElementById("sabbath-countdown").innerText = "It's Sabbath! Welcome.";
                document.getElementById("sabbath-countdown").style.color = "#fff";
            } else {
                document.getElementById("sabbath-countdown").innerText = `${days}d ${hours}h ${minutes}m`;
            }
        }

        // Initialize and set interval
        updateSabbathCountdown();
        setInterval(updateSabbathCountdown, 60000); // Refresh every minute