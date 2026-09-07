"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  GlobeIcon,
  ImageIcon,
  MessageCircleDashedIcon,
  PaperclipIcon,
  PlusIcon,
  RotateCwIcon,
  TelescopeIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { createChat } from "@/lib/ai"
import { useAuth } from "@/hooks/use-auth"
import { MessageAnimated } from "@/components/message-animated"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const chat = createChat()
const initialMessages = chat.get({ count: 0 })
const transport = chat.transport({ chunkDelayMs: 20 })

export function MessageScrollerDemo() {
  const router = useRouter()
  const { user } = useAuth()
  const [input, setInput] = React.useState("")
  const { messages, sendMessage, status, setMessages } = useChat({
    messages: initialMessages,
    transport: transport as any,
  })
  const isBusy = status === "submitted" || status === "streaming"

  const handleSend = () => {
    if (!input.trim() || isBusy) return
    void sendMessage({ role: "user", content: input } as any)
    setInput("")
  }

  return (
    <MessageScrollerProvider>
      <div className="relative flex flex-col gap-4">
        <Card className="mx-auto h-140 w-full max-w-sm gap-0">
          <CardHeader className="gap-1 border-b">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go back"
                onClick={() => router.back()}
                className="-ml-2 shrink-0"
              >
                <ArrowLeftIcon />
              </Button>
              <div className="min-w-0 flex-1">
                <CardTitle>New Organization</CardTitle>
                <CardDescription>Let&apos;s get you set up</CardDescription>
              </div>
            </div>
            <CardAction>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Reset conversation"
                    onClick={() => setMessages(initialMessages)}
                    disabled={isBusy}
                  >
                    <RotateCwIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset</p>
                </TooltipContent>
              </Tooltip>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {messages.length === 0 ? (
              <Empty className="h-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircleDashedIcon />
                  </EmptyMedia>
                  <EmptyTitle>Let&apos;s set up your organization</EmptyTitle>
                  <EmptyDescription>
                    What&apos;s it called? Type below to get started.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent
                    aria-busy={isBusy}
                    className="p-(--card-spacing)"
                  >
                    {messages.map((message) => (
                      <MessageAnimated
                        key={message.id}
                        message={message}
                        scrollAnchor={message.role === "user"}
                        userPhotoURL={user?.photoURL}
                        userDisplayName={user?.displayName}
                      />
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <InputGroup className="rounded-xl border-border bg-input/30">
              <InputGroupTextarea
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={isBusy}
                rows={2}
                className="w-full min-h-[4.5rem] max-h-52 [field-sizing:fixed] px-4 py-3"
              />
              <InputGroupAddon align="block-end" className="pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <InputGroupButton
                      aria-label="Add files"
                      type="button"
                      size="icon-sm"
                      variant="outline"
                    >
                      <PlusIcon />
                    </InputGroupButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="top"
                    className="w-44"
                  >
                    <DropdownMenuItem>
                      <PaperclipIcon />
                      Add Photos & Files
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <ImageIcon />
                      Upload Logo
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <TelescopeIcon />
                      Import Members CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <GlobeIcon />
                      Connect WhatsApp
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <InputGroupButton
                  type="button"
                  variant="default"
                  size="icon-sm"
                  disabled={!input.trim() || isBusy}
                  onClick={handleSend}
                  className="ml-auto"
                >
                  <ArrowUpIcon />
                  <span className="sr-only">Send</span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </CardFooter>
        </Card>
      </div>
    </MessageScrollerProvider>
  )
}
