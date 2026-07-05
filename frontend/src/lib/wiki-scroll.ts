/**
 * Smoothly scrolls a wiki heading into view within the `.main-wiki-content`
 * scroll container. We scroll the container directly (instead of using
 * `scrollIntoView`) so the window / outer page never scrolls.
 */
export function scrollToWikiHeading(element: HTMLElement) {
  const container = document.querySelector(".main-wiki-content");
  if (!(container instanceof HTMLElement))
    return;

  // element.offsetTop is relative to its offsetParent, which may not be the
  // scroll container.  Use getBoundingClientRect for both and derive the
  // position within the container's scrollable area.
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const targetScroll
    = container.scrollTop + (elementRect.top - containerRect.top);
  const maxScroll = container.scrollHeight - container.clientHeight;

  container.scrollTo({
    top: Math.max(0, Math.min(targetScroll, maxScroll)),
    behavior: "smooth",
  });
}
