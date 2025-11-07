import React, { useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import "./VenueQRCodeModal.scss";

interface VenueQRCodeModalProps {
  isOpen: boolean;
  venueName: string;
  shareUrl: string;
  onClose: () => void;
}

const VenueQRCodeModal: React.FC<VenueQRCodeModalProps> = ({ isOpen, venueName, shareUrl, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
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
    const svg = document.getElementById("venue-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `${venueName.replace(/\s+/g, "-")}-QR-Code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy link:", error);
      alert("Failed to copy link. Please copy manually.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="venue-qr-modal-overlay">
      <div className="venue-qr-modal" ref={modalRef}>
        <div className="venue-qr-modal__header">
          <h2>QR Code for {venueName}</h2>
          <button className="venue-qr-modal__close-btn" onClick={onClose} title="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
            </svg>
          </button>
        </div>

        <div className="venue-qr-modal__content">
          <p className="venue-qr-modal__description">
            Scan this QR code to access the venue page with matches and scoring capabilities.
          </p>

          <div className="venue-qr-modal__qr-container">
            <QRCode
              id="venue-qr-code"
              value={shareUrl}
              size={256}
              level="H"
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>

          <div className="venue-qr-modal__url">
            <span className="venue-qr-modal__url-label">Share URL:</span>
            <div className="venue-qr-modal__url-box">
              <span className="venue-qr-modal__url-text">{shareUrl}</span>
              <button className="venue-qr-modal__copy-btn" onClick={handleCopyLink} title="Copy link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="venue-qr-modal__actions">
            <button className="venue-qr-modal__download-btn" onClick={handleDownloadQR}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
              </svg>
              Download QR Code
            </button>
            <button className="venue-qr-modal__share-btn" onClick={handleCopyLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19A2.92,2.92 0 0,0 18,16.08Z" />
              </svg>
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueQRCodeModal;

