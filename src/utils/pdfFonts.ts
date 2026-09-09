import { Font } from "@react-pdf/renderer";

/**
 * The built-in PDF fonts (Helvetica and friends) are WinAnsi encoded, so they
 * carry no Cyrillic or Arabic glyphs at all. Registering real TrueType faces is
 * the only way to print Russian and Arabic names.
 *
 * IBM Plex Sans covers Latin, Greek and Cyrillic; IBM Plex Sans Arabic covers
 * Arabic and ships the same Latin design, so a line mixing scripts stays in one
 * typeface. @react-pdf/renderer accepts an array of families and substitutes per
 * glyph; Arabic letter joining and right-to-left ordering come from its own
 * shaping and bidi passes once a font with the glyphs is available.
 *
 * Two constraints are load-bearing, both verified by rendering:
 *
 *  - The Arabic family MUST come first. With a Latin family first, the renderer
 *    assigns the space between Arabic words to the Latin font, splitting the
 *    Arabic into separately shaped runs and emitting a stray Latin glyph.
 *
 *  - The Arabic face MUST build dots into its letter outlines rather than
 *    decompose them into mark glyphs. @react-pdf/renderer 4.3.0 silently drops
 *    shaped glyphs that carry no source codepoint, which deletes those dots and
 *    whole letters with them (Noto Sans Arabic fails this way: "حسن" prints as
 *    "حس"). IBM Plex Sans Arabic produces no such glyphs.
 */
const fontsBase = `${process.env.PUBLIC_URL || ""}/fonts`;

export const PDF_FONT_ARABIC = "IBMPlexSansArabic";
export const PDF_FONT_LATIN = "IBMPlexSans";

/** Pass to `fontFamily`. Arabic first: see the note above. */
export const PDF_FONT_FAMILY = [PDF_FONT_ARABIC, PDF_FONT_LATIN];

let registered = false;

export const registerPdfFonts = (): void => {
  if (registered) return;

  Font.register({
    family: PDF_FONT_ARABIC,
    fonts: [
      { src: `${fontsBase}/IBMPlexSansArabic-Regular.ttf`, fontWeight: "normal" },
      { src: `${fontsBase}/IBMPlexSansArabic-Bold.ttf`, fontWeight: "bold" },
    ],
  });

  Font.register({
    family: PDF_FONT_LATIN,
    fonts: [
      { src: `${fontsBase}/IBMPlexSans-Regular.ttf`, fontWeight: "normal" },
      { src: `${fontsBase}/IBMPlexSans-Bold.ttf`, fontWeight: "bold" },
    ],
  });

  // The default hyphenation splits words on any character boundary, which
  // mangles Cyrillic names and breaks Arabic letter joining mid-word.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
};
