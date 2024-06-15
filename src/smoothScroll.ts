import Lenis from "lenis";
import useLucy from "./useLucy";

const lenis = new Lenis({
  lerp: 0.03,
});
const scrollIcon = document.querySelector(".scroll-icon") as HTMLElement;
lenis.on("scroll", (e: any) => {
  const scrollPos = e.animatedScroll;
  useLucy.setState({ scrollPosition: scrollPos });

  if (scrollPos > 100 && scrollIcon.classList.contains("hidden") === false) {
    scrollIcon.classList.add("hidden");
  } else if (scrollPos <= 100 && scrollIcon.classList.contains("hidden")) {
    scrollIcon.classList.remove("hidden");
  }
});

function raf(time: number) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}

requestAnimationFrame(raf);
