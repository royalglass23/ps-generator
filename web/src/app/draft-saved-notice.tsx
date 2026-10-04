export function DraftSavedNotice({ resumeUrl, email, emailed = true }: {
  resumeUrl: string;
  email: string;
  emailed?: boolean;
}) {
  return <div className="draft-saved-notice" role="status">
    <strong>{emailed ? `Draft saved and emailed to ${email}` : "Draft saved"}</strong>
    <span>Keep this private link so you can return later. It expires after 24 hours.</span>
    <a href={resumeUrl}>{resumeUrl}</a>
  </div>;
}
