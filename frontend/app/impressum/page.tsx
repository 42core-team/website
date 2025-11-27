import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum for CORE Game",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ImpressumPage() {
  return (
    <div className="container mx-auto max-w-4xl px-8 py-12">
      <div className="prose prose-lg dark:prose-invert max-w-none prose">
        <h1>Impressum</h1>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          Paul Großmann
          <br />
          Dammstraße 5/1
          <br />
          74076 Heilbronn <br />
        </p>
        <p>
          {" "}
          <strong>Vertreten durch: </strong>
          <br />
          Paul Großmann
          <br />
        </p>
        <p>
          <strong>Kontakt:</strong> <br />
          Telefon:{" "}
          <span>
            +49
            <span className="hidden">phone.</span>
            175
            <span className="hidden">-obf-</span>
            9954144
          </span>
          <br />
          E-Mail:{" "}
          <span>
            core@
            <span className="hidden">email.</span>
            paulgrossmann.
            <span className="hidden">example.</span>
            de
          </span>
          <br />
        </p>
        <p>
          <strong>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:</strong>
          <br />
          Paul Großmann <br />
          Dammstraße 5/1
          <br />
          74076 Heilbronn <br />
        </p>
        <div>
          <h2>Haftungsausschluss: </h2>

          <h3>Haftung für Inhalte</h3>
          <p>
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für
            die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können
            wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir
            gemäß § 7 Abs.1 DDG für eigene Inhalte auf diesen Seiten nach den
            allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir
            als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
            gespeicherte fremde Informationen zu überwachen oder nach Umständen
            zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
            Informationen nach den allgemeinen Gesetzen bleiben hiervon
            unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem
            Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
            Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese
            Inhalte umgehend entfernen.
          </p>
          <h3>Haftung für Links</h3>
          <p>
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren
            Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
            fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
            verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
            der Seiten verantwortlich. Die verlinkten Seiten wurden zum
            Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
            Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht
            erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten
            Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung
            nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir
            derartige Links umgehend entfernen.
          </p>
          <h3>Urheberrecht</h3>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
            diesen Seiten unterliegen dem deutschen Urheberrecht. Die
            Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
            schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            Downloads und Kopien dieser Seite sind nur für den privaten, nicht
            kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser
            Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte
            Dritter beachtet. Insbesondere werden Inhalte Dritter als solche
            gekennzeichnet. Sollten Sie trotzdem auf eine
            Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
            entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen
            werden wir derartige Inhalte umgehend entfernen.
          </p>
        </div>
        <p>
          Impressum von{" "}
          <a href="https://websitewissen.com" rel="dofollow" target="_blank">
            WebsiteWissen.com
          </a>
          , dem Ratgeber für{" "}
          <a
            href="https://websitewissen.com/wordpress-website-erstellen"
            rel="dofollow"
            target="_blank"
          >
            WordPress-Websites
          </a>
          ,{" "}
          <a
            href="https://websitewissen.com/wordpress-hosting-vergleich"
            rel="dofollow"
            target="_blank"
          >
            WordPress-Hosting
          </a>{" "}
          und{" "}
          <a
            href="https://websitewissen.com/website-kosten"
            rel="dofollow"
            target="_blank"
          >
            Website-Kosten
          </a>{" "}
          nach einem Muster von{" "}
          <a
            href="https://www.kanzlei-hasselbach.de/"
            rel="dofollow"
            target="_blank"
          >
            Kanzlei Hasselbach Rechtsanwälte
          </a>
          .
        </p>
      </div>
    </div>
  );
}
