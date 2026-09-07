import { UIMessage as Message } from "ai";

export function getMessageText(message: Message | undefined) {
  if (!message) return "";
  return (message as any).content;
}

class ChatBuilder {
  private messages: Message[] = [];
  private currentId = 1;

  user(content: string) {
    this.messages.push({
      id: `msg-${this.currentId++}`,
      role: "user",
      content: content,
    } as any);
    return this;
  }

  assistant(content: string) {
    this.messages.push({
      id: `msg-${this.currentId++}`,
      role: "assistant",
      content: content,
    } as any);
    return this;
  }

  sleep(_ms: number) {
    return this;
  }

  get({ count }: { count?: number } = {}) {
    return count !== undefined && count === 0 ? [] : [...this.messages];
  }

  next({ after }: { after: Message[] }): Message | undefined {
    return this.messages[after.length];
  }

  transport({ chunkDelayMs }: { chunkDelayMs?: number } = {}) {
    return async (messages: Message[]) => {
      const userMessage = messages[messages.length - 1];
      if (!userMessage) return new Response("");

      const content = (userMessage as any).content as string;
      const lower = content.toLowerCase();
      const isFirst = messages.filter((m: any) => m.role === "user").length === 1;

      let replyText: string;

      if (isFirst) {
        // Treat first message as org name
        const orgName = content.trim();
        replyText = `I've created the workspace for **${orgName}**. Here's what I can help you set up next:\n\n• Drop a CSV of your members and I'll send WhatsApp invitations to all of them\n• Share your logo and I'll update the organization's branding\n• Tell me about an upcoming event and I'll create a coordination group\n\nWhat would you like to do first?`;
      } else if (lower.includes("csv") || lower.includes("member") || lower.includes("invite") || lower.includes("list")) {
        const count = Math.floor(Math.random() * 30) + 15;
        replyText = `Done. I've added ${count} members to your directory and sent WhatsApp join links to all of them. They'll receive a message from your organization's number with a one-tap link to join.\n\nYou can view and manage the full member list from the Members tab.`;
      } else if (lower.includes("logo") || lower.includes("branding") || lower.includes("brand") || lower.includes("color")) {
        replyText = `Branding updated. I've extracted your primary color from the logo and applied it across the dashboard. Your organization will now appear with the updated look in all WhatsApp messages and invitations sent by Fello.`;
      } else if (lower.includes("event") || lower.includes("pti") || lower.includes("meeting") || lower.includes("workshop") || lower.includes("friday") || lower.includes("saturday") || lower.includes("week")) {
        replyText = `Event created. I've set up a dedicated coordination WhatsApp group and added all coordinators as admins. I'll monitor the group — any task or assignment that comes up in conversation will be automatically tracked in the Tasks tab.\n\nShould I send an announcement to all members now?`;
      } else if (lower.includes("whatsapp") || lower.includes("number") || lower.includes("connect") || lower.includes("phone")) {
        replyText = `To connect WhatsApp, I'll need a dedicated number for your organization — this is the number members will see messages from. Once you add it, I'll handle the QR scan and session setup.\n\nDo you have a number ready, or would you like to set this up later?`;
      } else if (lower.includes("yes") || lower.includes("sure") || lower.includes("ok") || lower.includes("okay") || lower.includes("go ahead")) {
        replyText = `Done. I've sent the announcement to all members. Anything else you'd like to configure before your first event?`;
      } else if (lower.includes("task") || lower.includes("assign") || lower.includes("todo")) {
        replyText = `Tasks are tracked automatically from WhatsApp conversations — when someone is assigned something in the group chat, I pick it up and add it to the task list. You can also create tasks manually from the Events tab.\n\nWould you like me to create a few starter tasks for your upcoming event?`;
      } else if (lower.includes("setting") || lower.includes("config") || lower.includes("timezone") || lower.includes("language")) {
        replyText = `You can configure timezone, language, and notification preferences from the Settings tab. Your organization is currently set to the system default — want me to update anything now?`;
      } else {
        replyText = `Got it. I've noted that for the organization. Is there anything specific you'd like to set up — members, an upcoming event, or your WhatsApp connection?`;
      }

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const words = replyText.split(" ");
          for (const word of words) {
            controller.enqueue(encoder.encode(word + " "));
            if (chunkDelayMs) {
              await new Promise(r => setTimeout(r, chunkDelayMs));
            }
          }
          controller.close();
        },
      });

      return new Response(stream, { headers: { "Content-Type": "text/plain" } });
    };
  }
}

export function createChat() {
  return new ChatBuilder();
}
