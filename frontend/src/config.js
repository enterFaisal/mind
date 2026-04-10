// Use the VITE_API_URL environment variable if provided,
// otherwise determine automatically based on the environment (local vs production).
// Change PROD_API_URL to your actual production backend URL when deploying.

const PROD_API_URL = "https://167.172.182.170.nip.io";
const LOCAL_API_URL = `http://${window.location.hostname}:5000`;

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "production" ? PROD_API_URL : LOCAL_API_URL);
