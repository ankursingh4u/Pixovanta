// Public privacy policy: /privacy
//
// Required for a Shopify App Store listing, and it has to be reachable WITHOUT
// installing or authenticating — so this route deliberately does not call
// authenticate.admin and is not nested under /app.
//
// Everything below describes what the code in this repository actually does.
// If you change what is stored (prisma/schema.prisma), what is sent off-site
// (optimize.server.js, app.alttextsuggestions.jsx, app.pagespeedimpactreports.jsx)
// or what is deleted (webhooks.app.uninstalled.jsx), update this page to match.
import { useLoaderData } from "react-router";
import { MF_NAMESPACE } from "../constants";
import styles from "../styles/legal.module.css";

// The operator's identity and contact route are deployment facts, not code, so
// they come from the environment. PRIVACY_CONTACT_EMAIL has no default on
// purpose — publishing a personal address is the operator's decision, and the
// App Store listing's own support channel is a valid fallback until it is set.
export const loader = () => ({
  entity: process.env.LEGAL_ENTITY_NAME || "SDLC Limited",
  contactEmail: process.env.PRIVACY_CONTACT_EMAIL || null,
  appUrl: process.env.SHOPIFY_APP_URL || "https://pixovanta.onkra.online",
  namespace: MF_NAMESPACE,
});

export const meta = () => [
  { title: "Privacy Policy — Pixovanta" },
  {
    name: "description",
    content:
      "How Pixovanta handles store data: what it accesses, what it stores, who it shares data with, and how to have it deleted.",
  },
];

// Kept as data so the table and the retention column can never drift apart.
const STORED_DATA = [
  {
    what: "Shop domain and Shopify access credentials",
    detail:
      "Access token, refresh token, granted scopes and expiry. When Shopify issues a per-user token this record also includes the staff member's Shopify user ID, first and last name, email address, locale and account-owner/collaborator flags — Shopify supplies these as part of the session.",
    why: "To call the Shopify Admin API on your behalf and keep you signed in.",
    keep: "Deleted when you uninstall the app.",
  },
  {
    what: "App settings",
    detail: "A single on/off flag per shop for “auto-optimize new products”.",
    why: "To remember your preference between visits.",
    keep: "Deleted when you uninstall the app.",
  },
  {
    what: "Monthly usage counter",
    detail:
      "Your shop domain, the calendar month, and the number of images optimized in it.",
    why: "To enforce the image quota included in your plan.",
    keep: "Deleted when you uninstall the app.",
  },
  {
    what: "Measured image sizes",
    detail:
      "A Shopify CDN image URL and the size in bytes we measured for it. No shop identifier is attached.",
    why:
      "A size cache. Without it the product list would re-measure every image on every page load.",
    keep:
      "Retained as a cache. Entries are keyed by URL only, and a changed image always gets a new URL, so a stale entry is never read again.",
  },
];

const THIRD_PARTIES = [
  {
    name: "Shopify",
    sent:
      "All product, image, file and metafield reads and writes happen through the Shopify Admin API, and optimized images are uploaded back to Shopify's CDN.",
    when: "Throughout normal use.",
  },
  {
    name: "OpenAI",
    sent:
      "The product title and the image's public Shopify CDN URL are sent to the gpt-4o-mini model, which fetches the image from that URL to describe it. No shop domain, merchant name or customer data is included.",
    when:
      "Only when alt text is generated — either from the Alt Text Generator, or during optimization for an image that has no usable alt text on a plan that includes the feature.",
  },
  {
    name: "Google PageSpeed Insights",
    sent:
      "The public URL of the storefront product page you select. Nothing else.",
    when: "Only when you press “Run Live PageSpeed Test”.",
  },
];

export default function PrivacyPolicy() {
  const { entity, contactEmail, appUrl, namespace } = useLoaderData();

  const contact = contactEmail ? (
    <a className={styles.link} href={`mailto:${contactEmail}`}>
      {contactEmail}
    </a>
  ) : (
    "the support contact shown on our Shopify App Store listing"
  );

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>[ Pixovanta ]</p>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.updated}>Last updated: 9 October 2026</p>
        </header>

        <p className={styles.intro}>
          Pixovanta is a Shopify app operated by {entity} that compresses product
          images, generates alt text, and reports the measured effect on page
          speed. This page explains exactly what the app accesses, what it keeps,
          who else sees it, and how to have it erased.
        </p>

        <div className={styles.callout}>
          <p className={styles.calloutTitle}>
            Pixovanta never accesses your customers&apos; data
          </p>
          <p className={styles.calloutBody}>
            The app requests only the{" "}
            <span className={styles.code}>write_products</span> and{" "}
            <span className={styles.code}>write_files</span> permissions. It has
            no technical ability to read customers, orders, checkouts, carts,
            payments or payouts, and it does not request those permissions.
          </p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.h2}>Store data the app works with</h2>
          <p className={styles.p}>
            With the permissions above, Pixovanta reads and writes the following
            in your store:
          </p>
          <ul className={styles.list}>
            <li>
              <span className={styles.term}>Products</span> — title, handle,
              status and online-store URL, used to list what can be optimized.
            </li>
            <li>
              <span className={styles.term}>Product images and media</span> —
              downloaded, re-encoded to WebP, uploaded back to your store, and
              the original image replaced.
            </li>
            <li>
              <span className={styles.term}>Image alt text</span> — read, and
              written when you generate or apply alt text.
            </li>
            <li>
              <span className={styles.term}>Product metafields</span> — in the{" "}
              <span className={styles.code}>{namespace}</span> namespace only, to
              record optimization results (see section 3).
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>What we store on our own servers</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Why</th>
                  <th>Retention</th>
                </tr>
              </thead>
              <tbody>
                {STORED_DATA.map((row) => (
                  <tr key={row.what}>
                    <td>
                      <span className={styles.term}>{row.what}</span>
                      <br />
                      {row.detail}
                    </td>
                    <td>{row.why}</td>
                    <td>{row.keep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.p}>
            This data lives in a PostgreSQL database on dedicated server
            infrastructure that {entity} controls, reachable only over HTTPS. We
            do not sell it, rent it, or use it for advertising, and we do not use
            it to train machine-learning models.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Results stored inside your own store</h2>
          <p className={styles.p}>
            Optimization results are written to <em>your</em> products as
            metafields in the{" "}
            <span className={styles.code}>{namespace}</span> namespace: one record
            per image (status, size before and after, compression percentage, the
            alt text applied, a timestamp and the Shopify media IDs) plus one{" "}
            <span className={styles.code}>optimization_summary</span> per product.
          </p>
          <p className={styles.p}>
            This data belongs to you and stays in your store. It is what lets the
            savings figures survive a reinstall. Uninstalling the app does not
            remove these metafields — delete them from your store if you want them
            gone, or ask us and we will tell you exactly which keys to remove.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>How image files are handled</h2>
          <p className={styles.p}>
            When an image is optimized it is downloaded from Shopify&apos;s CDN
            into the app server&apos;s memory, re-encoded, uploaded back to your
            store, and the original media deleted from the product. The image
            bytes are not written to our disks and are not kept after the request
            that processed them finishes.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Third parties that receive data</h2>
          <p className={styles.p}>
            Pixovanta uses no advertising networks, no analytics trackers and no
            data brokers. Data leaves our server only in these cases:
          </p>
          <ul className={styles.list}>
            {THIRD_PARTIES.map((tp) => (
              <li key={tp.name}>
                <span className={styles.term}>{tp.name}</span> — {tp.sent}{" "}
                <em>{tp.when}</em>
              </li>
            ))}
          </ul>
          <p className={styles.p}>
            The app also contains an optional code path for Anthropic as an
            alternative alt-text provider. It is inactive unless an Anthropic API
            key is configured on the deployment; if we ever enable it, this page
            will be updated before it is used.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Deletion and data requests</h2>
          <ul className={styles.list}>
            <li>
              <span className={styles.term}>When you uninstall</span> — Shopify
              notifies the app and we delete your credentials, your app settings
              and your usage counters.
            </li>
            <li>
              <span className={styles.term}>Shop erasure requests</span> — Shopify
              sends a shop redaction request 48 hours after an uninstall. We
              perform the same deletion again so nothing is left behind.
            </li>
            <li>
              <span className={styles.term}>Customer data requests</span> —
              Shopify may forward a customer access or erasure request. Because
              the app holds no customer data, there is nothing to disclose and
              nothing to erase, and we respond on that basis.
            </li>
            <li>
              <span className={styles.term}>On request, at any time</span> —
              contact us and we will delete your data without waiting for an
              uninstall, and confirm when it is done.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Cookies and session handling</h2>
          <p className={styles.p}>
            Inside the Shopify admin the app authenticates with short-lived
            Shopify session tokens rather than its own tracking cookies. Cookies
            are used only where they are strictly necessary to complete the
            Shopify OAuth installation flow. There are no advertising or
            cross-site tracking cookies.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Your rights</h2>
          <p className={styles.p}>
            Depending on where you are based you may have the right to access,
            correct, export, restrict or erase the data described above, and to
            object to its processing. Contact {contact} and we will respond. If
            you are in the EEA or UK and are not satisfied with our response, you
            may complain to your local data protection authority.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Changes to this policy</h2>
          <p className={styles.p}>
            If the app starts collecting something new, or starts sending data
            somewhere new, we will update this page and change the “last updated”
            date above before that change goes live.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Contact</h2>
          <p className={styles.p}>
            Questions about this policy, or about data Pixovanta holds for your
            store: {contact}.
          </p>
        </section>

        <footer className={styles.footer}>
          <span>
            © {new Date().getFullYear()} {entity}
          </span>
          <a className={styles.link} href={appUrl}>
            Pixovanta home
          </a>
        </footer>
      </div>
    </div>
  );
}
