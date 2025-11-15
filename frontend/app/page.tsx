import HomePageClient from "@/components/HomePageClient";
import { getGlobalStats } from "@/app/actions/stats";
import { getCurrentLiveEvent } from "@/app/actions/event";
import { isActionError } from "@/app/actions/errors";

export default async function HomePage() {
  const globalStats = await getGlobalStats();
  const currentLiveEvent = await getCurrentLiveEvent();
  if (isActionError(currentLiveEvent)) {
    console.log(currentLiveEvent);
    throw new Error("Failed to load current live event");
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://coregame.de";

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CORE Game",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/wiki?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CORE Game",
    url: baseUrl,
    logo: `${baseUrl}/CORE-LOGO.svg`,
    sameAs: ["https://github.com/42core-team"],
  };

  const eventJsonLd = currentLiveEvent
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: currentLiveEvent.name,
        startDate: currentLiveEvent.startDate,
        endDate: currentLiveEvent.endDate,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        url: `${baseUrl}/events/${currentLiveEvent.id}`,
        organizer: {
          "@type": "Organization",
          name: "CORE Game",
          url: baseUrl,
        },
      }
    : null;

  return (
    <>
      <HomePageClient
        initialStats={globalStats}
        currentLiveEvent={currentLiveEvent}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {eventJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
        />
      )}
    </>
  );
}
