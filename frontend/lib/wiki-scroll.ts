/**
 * Scrolls to a wiki heading element, capping the scroll position so the
 * footer never becomes visible when the heading is near the bottom of the page.
 */
export function scrollToWikiHeading(element: HTMLElement) {
  const mainContent = document.querySelector(".main-wiki-content");

  // Compute the sticky offset (navbar + wiki header) by reading the bottom
  // edge of the sticky wiki header – its position is constant while stuck.
  const stickyHeader = mainContent?.previousElementSibling as HTMLElement | null;
  const stickyOffset = stickyHeader
    ? stickyHeader.getBoundingClientRect().bottom
    : 0;

  // Where we'd like to scroll: heading right below the sticky headers
  const elementTop = window.scrollY + element.getBoundingClientRect().top;
  const desiredScroll = elementTop - stickyOffset - 16; // 16px breathing room

  // Cap: don't scroll so far that the footer becomes visible.
  // The furthest we should scroll is when the content bottom meets the viewport bottom.
  const maxScroll = mainContent
    ? window.scrollY
    + mainContent.getBoundingClientRect().bottom
    - window.innerHeight
    : desiredScroll;

  window.scrollTo({
    top: Math.max(0, Math.min(desiredScroll, maxScroll)),
    behavior: "smooth",
  });
}
