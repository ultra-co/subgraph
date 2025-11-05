/**
 * Market questions mapped by marketId
 * These questions are manually set for specific markets
 */
export const MARKET_QUESTIONS: Record<string, string> = {
  "0x11a7b57e001bda319e451764e4feeb8705831bcb55eb9b4a4f9bf6a0b21179a3":
    "Kansas City to win the Super Bowl?",
  "0x88d3a2a9b9583575e19155de4a2007718c303da3d68c515f96b49e038dee807c":
    "Wicked: For Good to have the highest opening weekend box office in 2025?",
  "0x1b9e2df14806f2bbbe20aa3cc1677b68a3f97b7ecc12918713c288aa002e1eb7":
    "Kansas City to win the Super Bowl?",
  "0x172568ead13af37a1bbdd3c6e3397ec018c377ae5b9f1a82fb404f4957617963":
    "Highest Grossing Movie 2025 - A Minecraft Movie",
  "0xa61704cc49e368526b467d41c20d09bebbccf3148993156b964fbceca0b7bb49":
    "Biggest Movie Opening - A Minecraft Movie",
};

export const MARKET_CONTEXT: Record<string, string> = {
  "0x11a7b57e001bda319e451764e4feeb8705831bcb55eb9b4a4f9bf6a0b21179a3":
    "This market resolves YES if the Kansas City Chiefs win Super Bowl LX on February 8, 2026. The Chiefs are currently favored at +500 to +600 odds despite losing Super Bowl LIX 40-22 to Philadelphia. Patrick Mahomes has led Kansas City to five Super Bowls in seven seasons, winning three championships. The team is 5-4 through Week 9 of the 2025 season.",
  "0x88d3a2a9b9583575e19155de4a2007718c303da3d68c515f96b49e038dee807c": `This market resolves YES if "Wicked: For Good" has the highest domestic opening weekend box office of all 2025 releases. The sequel is tracking for $112-155 million opening weekend on November 21, 2025. Current projections show it competing with "A Minecraft Movie" ($162.7M actual opening) and other major 2025 releases. The first Wicked film opened to $112.5 million in November 2024.`,
  "0x1b9e2df14806f2bbbe20aa3cc1677b68a3f97b7ecc12918713c288aa002e1eb7":
    "Kansas City to win the Super Bowl?",
  "0x172568ead13af37a1bbdd3c6e3397ec018c377ae5b9f1a82fb404f4957617963": `This market resolves YES if "A Minecraft Movie" finishes 2025 as the highest-grossing film domestically. The Warner Bros./Legendary video game adaptation opened to $162.7M in April 2025. It competes against major releases including Zootopia 2 (November), Wicked: For Good (November), and Avatar: Fire and Ash (December) for the year's top spot.`,
  "0xa61704cc49e368526b467d41c20d09bebbccf3148993156b964fbceca0b7bb49": `This market resolves YES if "A Minecraft Movie" has the highest domestic opening weekend box office of all 2025 releases. The Warner Bros. film opened April 4-6, 2025 with a record-breaking $162.7 million debut—the largest opening weekend for a video game adaptation ever, surpassing The Super Mario Bros. Movie ($146M). It competed against spring break family audiences with Jack Black and Jason Momoa leading the cast.`,
};

export const MARKET_RESOLUTION: Record<string, string> = {
  "0x11a7b57e001bda319e451764e4feeb8705831bcb55eb9b4a4f9bf6a0b21179a3":
    "Market resolves based on the official NFL announcement of the Super Bowl LX champion. The underlying event occurs February 8, 2026, with Liquid expiring 30 days prior on January 8, 2026.",
  "0x88d3a2a9b9583575e19155de4a2007718c303da3d68c515f96b49e038dee807c":
    "Market resolves based on official Box Office Mojo data for the highest domestic opening weekend of any film released in 2025. Liquid expires November 30, 2025.",
  "0x1b9e2df14806f2bbbe20aa3cc1677b68a3f97b7ecc12918713c288aa002e1eb7":
    "Kansas City to win the Super Bowl?",
  "0x172568ead13af37a1bbdd3c6e3397ec018c377ae5b9f1a82fb404f4957617963":
    "Market resolves based on Box Office Mojo's total domestic gross for 2025 calendar year releases. Liquid expires November 30, 2025.",
  "0xa61704cc49e368526b467d41c20d09bebbccf3148993156b964fbceca0b7bb49":
    "Market resolves based on official Box Office Mojo data for the highest domestic opening weekend of any film released in 2025. Liquid expires November 30, 2025.",
};
