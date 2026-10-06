import { ApplicationForm } from "./application-form";
import { getApplicationConfig } from "@/lib/config";

export default function HomePage() {
  const { WORDPRESS_EMBED_ORIGIN } = getApplicationConfig();
  return <ApplicationForm siteKey={process.env.TURNSTILE_SITE_KEY ?? ""} googleMapsApiKey={process.env.NEXT_GOOGLE_MAPS_API_KEY ?? ""} parentOrigin={WORDPRESS_EMBED_ORIGIN ?? ""} />;
}
