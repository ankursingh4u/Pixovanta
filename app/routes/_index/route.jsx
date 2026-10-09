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
        <h1 className={styles.heading}>Faster images, better rankings.</h1>
        <p className={styles.text}>
          Image optimization &amp; SEO suite for Shopify stores. Compress images,
          generate AI alt text, and track the page-speed gains.
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
            <span className={styles.cardIcon}>◉</span>
            <strong className={styles.cardTitle}>Smart image compression</strong>
            <span className={styles.cardBody}>
              Reduce image sizes by up to 70% with automatic WebP conversion — the
              original is replaced safely and the measured saving is recorded.
            </span>
          </li>
          <li className={styles.card}>
            <span className={styles.cardIcon}>✦</span>
            <strong className={styles.cardTitle}>AI alt text generator</strong>
            <span className={styles.cardBody}>
              Generate SEO-optimized alt text for product images with AI vision,
              then bulk-apply it across the catalog in one click.
            </span>
          </li>
          <li className={styles.card}>
            <span className={styles.cardIcon}>◬</span>
            <strong className={styles.cardTitle}>Performance reports</strong>
            <span className={styles.cardBody}>
              Track Core Web Vitals and run live PageSpeed tests to see the
              measured impact on your product pages.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
