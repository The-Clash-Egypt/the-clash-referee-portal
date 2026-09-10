import React, { useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import "./QRCodeModal.scss";

export type QRCodeLevel = "L" | "M" | "Q" | "H";

interface QRCodeModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  /** Null while the link is being generated, or when generating it failed. */
  shareUrl: string | null;
  /** Download file name, without the extension. */
  downloadName: string;
  details?: React.ReactNode;
  footnote?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  level?: QRCodeLevel;
  onClose: () => void;
}

/** Download size in pixels, with a white quiet zone so the PNG scans even when pasted edge-to-edge. */
const DOWNLOAD_SIZE = 1024;
const DOWNLOAD_PADDING = 80;

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  title,
  description,
  shareUrl,
  downloadName,
  details,
  footnote,
  loading = false,
  error = null,
  onRetry,
  level = "M",
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = DOWNLOAD_SIZE;
      canvas.height = DOWNLOAD_SIZE;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, DOWNLOAD_SIZE, DOWNLOAD_SIZE);
        ctx.imageSmoothingEnabled = false;
        const inner = DOWNLOAD_SIZE - 2 * DOWNLOAD_PADDING;
        ctx.drawImage(img, DOWNLOAD_PADDING, DOWNLOAD_PADDING, inner, inner);
      }
      const downloadLink = document.createElement("a");
      downloadLink.download = `${downloadName}.png`;
      downloadLink.href = canvas.toDataURL("image/png");
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    } catch (copyError) {
      console.error("Failed to copy link:", copyError);
      alert("Failed to copy link. Please copy manually.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="qr-modal-overlay">
      <div className="qr-modal" ref={modalRef} role="dialog" aria-modal="true" aria-label={title}>
        <div className="qr-modal__header">
          <h2>{title}</h2>
          <button className="qr-modal__close-btn" onClick={onClose} title="Close" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
            </svg>
          </button>
        </div>

        <div className="qr-modal__content">
          {details ? <div className="qr-modal__details">{details}</div> : null}
          <p className="qr-modal__description">{description}</p>

          <div className="qr-modal__qr-container" ref={qrRef}>
            {shareUrl ? (
              <QRCode value={shareUrl} size={256} level={level} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
            ) : loading ? (
              <div className="qr-modal__status" role="status">
                <div className="qr-modal__spinner" />
                Generating QR code…
              </div>
            ) : (
              <div className="qr-modal__status qr-modal__status--error" role="alert">
                <span>{error || "No QR code is available."}</span>
                {onRetry ? (
                  <button type="button" className="qr-modal__retry-btn" onClick={onRetry}>
                    Try again
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {shareUrl && footnote ? <p className="qr-modal__footnote">{footnote}</p> : null}

          {shareUrl ? (
            <>
              <div className="qr-modal__url">
                <span className="qr-modal__url-label">Share URL:</span>
                <div className="qr-modal__url-box">
                  <span className="qr-modal__url-text">{shareUrl}</span>
                  <button className="qr-modal__copy-btn" onClick={handleCopyLink} title="Copy link" aria-label="Copy link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="qr-modal__actions">
                <button className="qr-modal__download-btn" onClick={handleDownloadQR}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
                  </svg>
                  Download QR Code
                </button>
                <button className="qr-modal__share-btn" onClick={handleCopyLink}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19A2.92,2.92 0 0,0 18,16.08Z" />
                  </svg>
                  Copy Link
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
