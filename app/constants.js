// Shared, environment-free constants.
//
// The optimizer stores its results on PRODUCT METAFIELDS rather than in our own
// database: one record per image plus a per-product summary. That makes the
// numbers the merchant sees survive a reinstall and stay attached to the product
// they describe.
//
// The namespace is app-specific on purpose. It used to be a generic
// "image_optimization", which meant two image apps installed on the same store
// would read and overwrite each other's records — each one counting the other's
// work as its own. Keying it to this app makes the records unambiguously ours.
export const MF_NAMESPACE = "pixovanta_opt";

// Per-product totals, recomputed from the per-image records after every run.
export const MF_SUMMARY_KEY = "optimization_summary";

// Per-image records are stored as `image_<short media id>`.
export const MF_IMAGE_PREFIX = "image_";

/** Metafield key holding the record for a MediaImage gid. */
export const imageKeyFor = (mediaId) =>
  `${MF_IMAGE_PREFIX}${String(mediaId).split("/").pop()}`;
