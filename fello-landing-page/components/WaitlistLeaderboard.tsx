"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { RiAccountCircleLine } from "react-icons/ri";

interface WaitlistDomain {
  domain: string;
  count: number;
}

interface WaitlistData {
  topDomains: WaitlistDomain[];
  generalCount: number;
  totalCount: number;
}

// Mirrors the public, unauthenticated Firestore REST read fello-frontend already uses
// for this exact leaderboard — the `waitlists` collection only ever stores a domain
// and an aggregate count, never emails or phone numbers, so this is safe to call
// straight from the browser without a Cloud Function in front of it.
async function fetchWaitlistData(): Promise<WaitlistData> {
  const response = await fetch(
    "https://firestore.googleapis.com/v1/projects/fello-pt/databases/(default)/documents:runQuery",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "waitlists" }],
          orderBy: [{ field: { fieldPath: "count" }, direction: "DESCENDING" }],
          limit: 100,
        },
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) throw new Error(`Firestore REST error: ${response.statusText}`);

  const rawData = await response.json();

  const results: WaitlistDomain[] = rawData
    .map((item: any) => {
      if (!item.document) return null;
      const fields = item.document.fields;
      return {
        domain: fields.domain?.stringValue || "",
        count: fields.count?.integerValue ? parseInt(fields.count.integerValue, 10) : 0,
      };
    })
    .filter(Boolean);

  const generalRecord = results.find((d) => d.domain === "general");
  const generalCount = generalRecord ? generalRecord.count : 0;

  const topDomains = results.filter((d) => d.domain !== "general").slice(0, 5);

  const totalCount = results.reduce((acc, curr) => acc + curr.count, 0);

  return {
    topDomains,
    generalCount,
    totalCount,
  };
}

export default function WaitlistLeaderboard() {
  const [data, setData] = useState<WaitlistData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWaitlistData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        console.error("Failed to fetch waitlist data:", err);
        if (!cancelled) {
          setData({
            topDomains: [],
            generalCount: 0,
            totalCount: 0,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const topDomains = data?.topDomains || [];
  const generalCount = data?.generalCount || 0;
  const showGeneral = topDomains.length < 5 && generalCount > 0;

  // Construct combined list of items to render
  const itemsToRender: Array<
    | { type: "domain"; domain: string; count: number }
    | { type: "general"; count: number }
  > = topDomains.map((d) => ({
    type: "domain",
    domain: d.domain,
    count: d.count,
  }));

  if (showGeneral) {
    itemsToRender.push({
      type: "general",
      count: generalCount,
    });
  }

  const isEmpty = data !== null && itemsToRender.length === 0;

  return (
    <div className="w-full flex flex-col items-center py-6">

      {/* Header */}
      <div className="max-w-lg text-center flex flex-col items-center mb-8">
        <span className="section-kicker mb-2">Early Access</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          Top 5 domains get in first.
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          Only a limited number of domains have access right now. Fello is onboarding institutions in order of demand. Updated in real time. The top 5 domains get the earliest access.
        </p>
      </div>

      {/* Top Requested Domains — mirrors the RoundedList styling on app.fello.live/waitlist */}
      <div className="flex flex-col w-full max-w-md gap-4 text-left">
        <div className="px-2 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[var(--ink)]">Top Requested Domains</h3>
          {data !== null && (
            <span className="text-xs text-[var(--muted)] font-medium">
              {data.totalCount} total requests
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-3 w-full">
          {data === null &&
            Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="h-[52px] w-full animate-pulse rounded-md first:rounded-t-3xl last:rounded-b-3xl overflow-hidden"
                style={{ backgroundColor: "var(--paper)", border: "1px solid var(--line-strong)" }}
              />
            ))}

          {isEmpty && (
            <li
              className="w-full p-6 text-sm text-[var(--muted)] text-center rounded-3xl"
              style={{ border: "1px solid var(--line-strong)", backgroundColor: "#ffffff" }}
            >
              No requests yet, you could be first!
            </li>
          )}

          {data !== null &&
            itemsToRender.map((item, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === itemsToRender.length - 1;
              const roundClass = `${isFirst ? "rounded-t-3xl" : ""} ${isLast ? "rounded-b-3xl" : ""}`.trim();

              if (item.type === "domain") {
                return (
                  <li
                    key={item.domain}
                    className={`group/row w-full p-2 rounded-md overflow-hidden ${roundClass}`}
                    style={{ backgroundColor: "#ffffff", border: "1px solid var(--line-strong)" }}
                  >
                    <div className="flex w-full h-auto p-1 items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-8 min-w-8 h-8 min-h-8 rounded-md overflow-hidden flex items-center justify-center font-bold text-sm"
                          style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
                        >
                          {idx + 1}
                        </div>
                        <span className="font-medium text-sm text-[var(--ink)]">{item.domain}</span>
                      </div>
                      <span className="text-sm font-semibold text-[var(--ink)] pr-2">
                        {item.count} <span className="text-[var(--muted)] font-normal text-xs ml-0.5">requests</span>
                      </span>
                    </div>
                  </li>
                );
              } else {
                return (
                  <li
                    key="general-accounts"
                    className={`group/row w-full p-2 rounded-md overflow-hidden ${roundClass}`}
                    style={{ backgroundColor: "#ffffff", border: "1px solid var(--line-strong)" }}
                  >
                    <div className="flex w-full h-auto p-1 items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-8 min-w-8 h-8 min-h-8 rounded-md overflow-hidden flex items-center justify-center font-bold text-sm"
                          style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
                        >
                          <RiAccountCircleLine className="w-4.5 h-4.5 text-[var(--ink)]" />
                        </div>
                        <span className="font-medium text-sm text-[var(--ink)]">Personal Accounts</span>
                      </div>
                      <span className="text-sm font-semibold text-[var(--ink)] pr-2">
                        {item.count} <span className="text-[var(--muted)] font-normal text-xs ml-0.5">requests</span>
                      </span>
                    </div>
                  </li>
                );
              }
            })}
        </ul>
      </div>

      {/* CTA */}
      <a
        href="https://app.fello.live/sign-in"
        className="mt-8 inline-flex items-center gap-1.5 font-bold text-sm px-5 py-2.5 rounded-full"
        style={{ backgroundColor: "#101012", color: "#fffdf7" }}
      >
        Sign in for waitlist
        <ArrowUpRight className="w-4 h-4" />
      </a>
    </div>
  );
}
