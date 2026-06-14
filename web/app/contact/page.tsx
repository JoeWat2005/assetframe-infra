import type { Metadata } from "next";
import { Mail, Clock, ArrowRight } from "lucide-react";
import { Hero } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SITE } from "@/site.config";

export const metadata: Metadata = { title: "Contact" };

const SOCIAL_LABELS: Record<string, string> = { x: "X", linkedin: "LinkedIn", youtube: "YouTube", reddit: "Reddit", instagram: "Instagram" };

export default function ContactPage() {
  const socials = Object.entries(SITE.socials).filter(([, url]) => url);

  return (
    <>
      <Hero title="Contact" tag="Questions about a report, your subscription, or anything else." />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Card data-animate="up">
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                <Mail className="size-5" />
              </div>
              <div>
                <div className="font-bold text-navy">Email</div>
                <p className="text-sm text-muted-foreground">The fastest way to reach us. We read everything.</p>
                <a href={`mailto:${SITE.contactEmail}`} className="text-sm font-semibold text-navy underline underline-offset-2">
                  {SITE.contactEmail}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-tile text-navy">
                <Clock className="size-5" />
              </div>
              <div>
                <div className="font-bold text-navy">Response time</div>
                <p className="text-sm text-muted-foreground">We aim to reply within 1 to 2 business days.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-5 flex flex-wrap items-center gap-4" data-animate="up">
          <Button asChild>
            <a href={`mailto:${SITE.contactEmail}`}>
              Email us
              <ArrowRight data-icon="inline-end" />
            </a>
          </Button>
          {socials.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Or find us on{" "}
              {socials.map(([key, url], i) => (
                <span key={key}>
                  {i > 0 && ", "}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline">
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                </span>
              ))}
              .
            </span>
          )}
        </div>

        <p className="mt-8 text-xs text-muted-foreground" data-animate="up">
          For account or billing changes, include the email you signed up with. AssetFrame is research only
          and cannot provide personal financial advice.
        </p>
      </div>
    </>
  );
}
