import { ApplicationForm } from "../../application-form";

export default async function ResumeApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationForm siteKey={process.env.TURNSTILE_SITE_KEY ?? ""} googleMapsApiKey={process.env.NEXT_GOOGLE_MAPS_API_KEY ?? ""} draftId={id} />;
}
