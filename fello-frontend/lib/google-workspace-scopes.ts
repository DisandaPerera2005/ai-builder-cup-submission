export const GOOGLE_WORKSPACE_SERVICES = [
  { label: "Google Drive", image: "/google-icons/drive.png", scope: "https://www.googleapis.com/auth/drive.file" },
  { label: "Google Docs", image: "/google-icons/docs.webp", scope: "https://www.googleapis.com/auth/documents" },
  { label: "Google Sheets", image: "/google-icons/sheets.webp", scope: "https://www.googleapis.com/auth/spreadsheets" },
  { label: "Google Slides", image: "/google-icons/slides.webp", scope: "https://www.googleapis.com/auth/presentations" },
  { label: "Google Forms", image: "/google-icons/forms.webp", scope: "https://www.googleapis.com/auth/forms.body" },
  { label: "Gmail", image: "/google-icons/gmail.webp", scope: "https://www.googleapis.com/auth/gmail.send" },
  { label: "Google Contacts", image: "/google-icons/contacts.webp", scope: "https://www.googleapis.com/auth/contacts.readonly" },
  {
    label: "Google Calendar",
    image: "/google-new-icons/google-calander.png",
    scope: "https://www.googleapis.com/auth/calendar.events",
  },
] as const

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  ...GOOGLE_WORKSPACE_SERVICES.map((service) => service.scope),
] as const
