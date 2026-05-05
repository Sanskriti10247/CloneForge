document.addEventListener("DOMContentLoaded", () => {
  // 1. Smooth scroll for all anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // 2. Sticky header
  const header = document.querySelector("header");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  // 3. Mobile hamburger menu toggle
  const hamburger = document.querySelector(".hamburger");
  if (hamburger && header) {
    hamburger.addEventListener("click", () => {
      header.classList.toggle("nav-open");
    });
  }

  // 4. Scroll reveal animations
  const sectionsToReveal = document.querySelectorAll("header, section, footer");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    },
  );

  sectionsToReveal.forEach((section) => {
    revealObserver.observe(section);
  });

  // 5. Active navigation link highlighting
  const navLinks = document.querySelectorAll("header nav a");
  const sectionIds = ["hero", "features", "companies", "stats"];

  window.addEventListener("scroll", () => {
    let current = "";

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) {
        const sectionTop = section.offsetTop;
        // Using a 150px offset to trigger active state before reaching the section
        if (window.scrollY >= sectionTop - 150) {
          current = id;
        }
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${current}`) {
        link.classList.add("active");
      }
    });
  });

  // 6. Scroll-to-top button
  const scrollTopBtn = document.getElementById("scroll-to-top");
  if (scrollTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 500) {
        scrollTopBtn.style.display = "block";
        // Adding a small delay or class for a fade-in effect if CSS handles it
        setTimeout(() => scrollTopBtn.classList.add("visible"), 10);
      } else {
        scrollTopBtn.classList.remove("visible");
        setTimeout(() => (scrollTopBtn.style.display = "none"), 300);
      }
    });

    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }
});
