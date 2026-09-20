export type SourceMessage = {
  sender: string;
  subject: string;
  snippet: string;
  date: string;
};

export type EmailDraft = {
  subject: string;
  body: string;
};

export type EmailSummary = {
  generatedAt: string;
  totalEmails: number;
  urgentCount: number;
  meetingCount: number;
  requestCount: number;
  headline: string;
  actionItems: string[];
  notes: string[];
  items: Array<{
    title: string;
    detail: string;
    type: "urgent" | "meeting" | "request" | "update";
  }>;
};

export type EmailSummaryStatus = {
  connected: boolean;
  emailAddress: string | null;
  summary: EmailSummary | null;
  schedule: string;
};
