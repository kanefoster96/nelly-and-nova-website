import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RichText } from "@/components/ui/RichText";
import { terms } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms and conditions for using the Nelly & Nova website and dog training services.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h1 className="display-heading text-4xl text-paper sm:text-5xl">
              {terms.heading}
            </h1>
            <p className="mt-3 text-sm text-paper-dim">
              Last Updated: {terms.updated}
            </p>

            <p className="mt-8 text-paper/80">{terms.intro}</p>

            <div className="mt-8 h-px w-16 bg-white/30" />

            <div className="mt-10 space-y-10">
              {terms.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-lg font-bold text-paper">
                    {section.heading}
                  </h2>
                  <div className="mt-3 space-y-4 text-paper/75">
                    {section.blocks.map((block, i) =>
                      "p" in block ? (
                        <p key={i}>
                          <RichText text={block.p} />
                        </p>
                      ) : (
                        <ul
                          key={i}
                          className="list-disc space-y-2 pl-5 marker:text-paper/40"
                        >
                          {block.ul.map((item, j) => (
                            <li key={j} className="pl-1">
                              <RichText text={item} />
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
