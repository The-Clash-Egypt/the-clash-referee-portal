// qr.js ships no types. These are the two deep modules react-qr-code itself imports
// (the package root mishandles error level M, which is 0).
declare module "qr.js/lib/QRCode" {
  export default class QRCode {
    constructor(typeNumber: number, errorCorrectLevel: number);
    addData(data: string): void;
    make(): void;
    modules: (boolean | null)[][];
  }
}

declare module "qr.js/lib/ErrorCorrectLevel" {
  const ErrorCorrectLevel: { L: number; M: number; Q: number; H: number };
  export default ErrorCorrectLevel;
}
