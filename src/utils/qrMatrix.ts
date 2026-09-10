import QRCodeImpl from "qr.js/lib/QRCode";
import ErrorCorrectLevel from "qr.js/lib/ErrorCorrectLevel";

export type QrLevel = "L" | "M" | "Q" | "H";

/**
 * The QR module grid for `text`, from the same encoder react-qr-code uses, so the code
 * printed in the PDF is identical to the one on the export preview. `true` = dark module.
 */
export const qrModules = (text: string, level: QrLevel = "M"): boolean[][] => {
  const qr = new QRCodeImpl(-1, ErrorCorrectLevel[level]); // -1 = smallest version that fits
  qr.addData(text);
  qr.make();
  return qr.modules.map((row) => row.map(Boolean));
};

/**
 * One SVG path for the dark modules, in module units (pair it with viewBox="0 0 n n").
 * Each horizontal run of dark modules becomes a single rectangle, which keeps the path
 * short and avoids hairline seams between neighbouring squares in PDF viewers.
 */
export const qrPathData = (modules: boolean[][]): string => {
  const parts: string[] = [];

  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      const width = x - start;
      parts.push(`M${start} ${y}h${width}v1h-${width}z`);
    }
  });

  return parts.join("");
};
