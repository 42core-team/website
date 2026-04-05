/**
 * Smoothly scrolls a wiki heading into view within the `.main-wiki-content`
 * scroll container. We scroll the container directly (instead of using
 * `scrollIntoView`) so the window / outer page never scrolls.
 */
export function getWikiScrollContainer() {
  return document.querySelector("[data-wiki-scroll-container='true']") as HTMLElement | null;
}

interface ScrollWikiElementOptions {
  block?: "start" | "center";
}

export function scrollWikiElementIntoView(
  element: HTMLElement,
  options: ScrollWikiElementOptions = {},
) {
  const container = getWikiScrollContainer();
  if (!container)
    return;

  const { block = "start" } = options;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const relativeTop = container.scrollTop + (elementRect.top - containerRect.top);

  let targetScroll = relativeTop;

  if (block === "center") {
    targetScroll = relativeTop - ((container.clientHeight - elementRect.height) / 2);
  }

  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const clampedTarget = Math.min(Math.max(0, targetScroll), maxScrollTop);

  container.scrollTo({
    top: clampedTarget,
    behavior: "smooth",
  });
}

export function scrollToWikiHeading(element: HTMLElement) {
  scrollWikiElementIntoView(element);
}
