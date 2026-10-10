import React, { useRef } from "react";
import QRCode from "react-qr-code";
import Drawer from "./Drawer";
// The components' own files, not the src/ui barrel: the barrel pulls in react-router-dom, which Jest can't resolve.
import { Button } from "../../../ui/Button";
import { Icon } from "../../../ui/Icon";
import { useToast } from "../../../ui/Toast";
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
  const qrRef = useRef<HTMLDivElement>(null);
  const { show } = useToast();

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
      show("Link copied to clipboard!", { tone: "ok" });
    } catch (copyError) {
      console.error("Failed to copy link:", copyError);
      show("Failed to copy link. Please copy manually.", { tone: "error" });
    }
  };

  // The drawer supplies the header, close button, Escape, backdrop click and scroll lock.
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} size="md" className="qr-drawer">
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
              <Button variant="tint" icon="refresh" onClick={onRetry}>
                Try again
              </Button>
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
              <button
                type="button"
                className="qr-modal__copy-btn"
                onClick={handleCopyLink}
                title="Copy link"
                aria-label="Copy link"
              >
                <Icon name="copy" size={16} />
              </button>
            </div>
          </div>

          <div className="qr-modal__actions">
            <Button size="lg" icon="download" onClick={handleDownloadQR}>
              Download QR Code
            </Button>
            <Button variant="tint" size="lg" icon="link" onClick={handleCopyLink}>
              Copy Link
            </Button>
          </div>
        </>
      ) : null}
    </Drawer>
  );
};

export default QRCodeModal;
