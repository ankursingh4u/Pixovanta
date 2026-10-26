// Public privacy policy: /privacy
//
// Required for a Shopify App Store listing, and it has to be reachable WITHOUT
// installing or authenticating — so this route deliberately does not call
// authenticate.admin and is not nested under /app.
//
// Everything below describes what the code in this repository actually does.
// If you change what is stored (prisma/schema.prisma), what is sent off-site
// (media.server.js) or what is deleted (webhooks.app.uninstalled.jsx), update
// this page to match.
import { useLoaderData } from "react-router";
import styles from "../styles/legal.module.css";

// The operator's identity and contact route are deployment facts, not code, so
// they come from the environment. PRIVACY_CONTACT_EMAIL has no default on
// purpose — publishing a personal address is the operator's decision, and the
// App Store listing's own support channel is a valid fallback until it is set.
export const loader = () => ({
  entity: process.env.LEGAL_ENTITY_NAME || "SDLC Limited",
  contactEmail: process.env.PRIVACY_CONTACT_EMAIL || null,
  appUrl: process.env.SHOPIFY_APP_URL || "https://pixovanta.onkra.online",
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
    what: "Monthly usage counter",
    detail:
      "Your shop domain, the calendar month, and the number of metered file operations (duplicate-scan fingerprints and renames) run in it.",
    why: "To enforce the file-operation quota included in your plan.",
    keep: "Deleted when you uninstall the app.",
  },
  {
    what: "File content fingerprints",
    detail:
      "A Shopify CDN file URL, the file's size in bytes, and a SHA-256 fingerprint of its content. No shop identifier is attached, and the fingerprint cannot be turned back into the file.",
    why:
      "A scan cache. Without it every duplicate scan would re-download every file; with it a re-scan only downloads files that changed.",
    keep:
      "Retained as a cache. Entries are keyed by URL only, and a changed file always gets a new URL, so a stale entry is never read again.",
  },
];

export default function PrivacyPolicy() {
  const { entity, contactEmail, appUrl } = useLoaderData();

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
          <p className={styles.updated}>Last updated: 26 October 2026</p>
        </header>

        <p className={styles.intro}>
          Pixovanta is a Shopify app operated by {entity} that helps merchants
          manage their store&apos;s file library: finding duplicate files,
          surfacing files no product uses, and renaming files in bulk. This page
          explains exactly what the app accesses, what it keeps, who else sees
          it, and how to have it erased.
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
              <span className={styles.term}>Files</span> — the file library
              (Content → Files) is listed with each file&apos;s name, type, size,
              dimensions and upload date. Files are renamed or deleted only when
              you explicitly apply a rename or a cleanup.
            </li>
            <li>
              <span className={styles.term}>Product media references</span> —
              which media each product uses, read to determine whether a file in
              the library is referenced by any product. Products themselves are
              never modified.
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
          <h2 className={styles.h2}>How file contents are handled</h2>
          <p className={styles.p}>
            To detect duplicates the app downloads each file once from
            Shopify&apos;s CDN into the app server&apos;s memory, computes a
            SHA-256 fingerprint, and discards the bytes. The file contents are
            not written to our disks and are not kept after the request that
            processed them finishes — only the fingerprint described in the table
            above is retained.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Third parties that receive data</h2>
          <p className={styles.p}>
            Pixovanta uses no advertising networks, no analytics trackers, no AI
            providers and no data brokers. All reads and writes happen through
            the Shopify Admin API, and file downloads for fingerprinting come
            from Shopify&apos;s own CDN — data never leaves the app&apos;s
            infrastructure for any other destination.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Deletion and data requests</h2>
          <ul className={styles.list}>
            <li>
              <span className={styles.term}>When you uninstall</span> — Shopify
              notifies the app and we delete your credentials and your usage
              counters.
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
