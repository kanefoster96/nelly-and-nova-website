import type { LegalDoc } from "@/components/LegalPage";

/**
 * Community guidelines for the members' community feed and chat. Apps where
 * people post (Apple guideline 1.2) need rules, a way to report and block,
 * and a promise to act on reports — the app has report/block on every post.
 */
export const communityGuidelines: LegalDoc = {
  heading: "Community Guidelines.",
  updated: "4 Nov 2026",
  intro:
    "The Nelly & Nova community is a friendly place for our dog owners to share progress, wins and the odd muddy walk. By posting, commenting or messaging in the app or on the website, you agree to these guidelines.",
  sections: [
    {
      heading: "1. Be kind",
      blocks: [
        { ul: [
          "Celebrate each other's dogs — every dog learns at their own pace.",
          "No bullying, harassment, hate speech, threats or discrimination of any kind.",
          "Disagree politely. Training advice for your dog comes from our trainers, so please don't criticise other owners' methods.",
        ] },
      ],
    },
    {
      heading: "2. Keep it safe and appropriate",
      blocks: [
        { ul: [
          "Only share photos and videos you have the right to share, and only of dogs and people who are happy to be included.",
          "No violent, graphic, sexual or otherwise inappropriate content, and nothing that shows a dog being harmed or treated cruelly.",
          "Don't share other people's personal details (addresses, phone numbers, where they walk).",
          "No spam, advertising or selling.",
        ] },
      ],
    },
    {
      heading: "3. Reporting and blocking",
      blocks: [
        { p: "If you see something that breaks these guidelines, tap ••• on the post or comment and choose Report. You can also block someone so you no longer see their posts." },
        { p: "Our trainers review reports within 24 hours and will remove content and, where needed, remove access to the community for anyone who breaks these guidelines." },
      ],
    },
    {
      heading: "4. Contact us",
      blocks: [
        { p: "Worried about something you've seen? Message us in the app, or email charlotte@nellyandnova.co.uk." },
      ],
    },
  ],
};
