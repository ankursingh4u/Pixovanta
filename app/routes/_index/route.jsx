import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>[ Pixovanta ]</p>
        <h1 className={styles.heading}>A tidy file library, kept tidy.</h1>
        <p className={styles.text}>
          Media library manager for Shopify stores. Find duplicate files, clear
          out files no product uses, and rename in bulk — with a preview first.
        </p>

        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span className={styles.labelText}>Shop domain</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="my-shop-domain.myshopify.com"
              />
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}

        <ul className={styles.list}>
          <li className={styles.card}>
            <span className={styles.cardIcon}>⧉</span>
            <strong className={styles.cardTitle}>Duplicate finder</strong>
            <span className={styles.cardBody}>
              Every file is fingerprinted by its actual content, so re-uploads
              and renamed copies are caught too. Review each group and delete
              the copies in bulk — the original stays.
            </span>
          </li>
          <li className={styles.card}>
            <span className={styles.cardIcon}>◌</span>
            <strong className={styles.cardTitle}>Unused-file detection</strong>
            <span className={styles.cardBody}>
              See which images and videos in your library aren&apos;t referenced
              by any product — old banners, replaced photos, abandoned uploads —
              and clean them up with care.
            </span>
          </li>
          <li className={styles.card}>
            <span className={styles.cardIcon}>✎</span>
            <strong className={styles.cardTitle}>Bulk rename</strong>
            <span className={styles.cardBody}>
              Find &amp; replace, prefixes, suffixes and filename clean-up across
              the whole library, with a preview of every change before anything
              is touched.
            </span>
          </li>
        </ul>

        {/* Shopify App Store listings must link a reachable privacy policy, and
            reviewers look for it here before they install anything. */}
        <footer className={styles.footer}>
          <a className={styles.footerLink} href="/privacy">
            Privacy Policy
          </a>
        </footer>
      </div>
    </div>
  );
}
