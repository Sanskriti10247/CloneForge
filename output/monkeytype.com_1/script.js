document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector("header");
  const hamburger = document.querySelector(".hamburger");
  const scrollTopBtn = document.querySelector("#scrollTopBtn");
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section");

  // 1. Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
        // Close mobile menu if open
        header.classList.remove("nav-open");
      }
    });
  });

  // 2, 5 & 6. Combined Scroll Event Listener
  window.addEventListener("scroll", () => {
    const scrollY = window.scrollY;

    // Sticky header class
    header.classList.toggle("scrolled", scrollY > 50);

    // Scroll-to-top button visibility
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle("visible", scrollY > 500);
    }

    // Active nav link highlighting
    let current = "";
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (scrollY >= sectionTop - 100) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href").includes(current)) {
        link.classList.add("active");
      }
    });
  });

  // 3. Mobile hamburger menu toggle
  if (hamburger) {
    hamburger.addEventListener("click", () => {
      header.classList.toggle("nav-open");
    });
  }

  // 4. Scroll reveal with IntersectionObserver
  const revealOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target); // Trigger only once
      }
    });
  }, revealOptions);

  document.querySelectorAll(".reveal-section").forEach((el) => revealObserver.observe(el));

  // 6. Scroll-to-top click functionality
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});
