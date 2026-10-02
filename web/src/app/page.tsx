import { ApplicationForm } from "./application-form";

export default function HomePage() {
  return <ApplicationForm siteKey={process.env.TURNSTILE_SITE_KEY ?? ""} />;
}
