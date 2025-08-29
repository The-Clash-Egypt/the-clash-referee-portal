import React, { useState, useEffect } from "react";
import "./ShareRefereeLinkModal.scss";

interface ShareRefereeLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShareRefereeLinkModal: React.FC<ShareRefereeLinkModalProps> = ({ isOpen, onClose }) => {
  const [signupLink, setSignupLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState<string>("");

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Generate the signup link
      const baseUrl = window.location.origin;
      setSignupLink(`${baseUrl}/signup/referee`);
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(signupLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = signupLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    const message = customMessage || "Join us as a referee! Click the link below to sign up:";
    const encodedMessage = encodeURIComponent(`${message}\n\n${signupLink}`);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleShareTelegram = () => {
    const message = customMessage || "Join us as a referee! Click the link below to sign up:";
    const encodedMessage = encodeURIComponent(`${message}\n\n${signupLink}`);
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(signupLink)}&text=${encodeURIComponent(
      message
    )}`;
    window.open(telegramUrl, "_blank");
  };

  const handleShareEmail = () => {
    const subject = "Join The Clash as a Referee";
    const message =
      customMessage ||
      "Hi! I'd like to invite you to join The Clash as a referee. Please use the link below to sign up:";
    const emailBody = `${message}\n\n${signupLink}\n\nBest regards,\nThe Clash Team`;

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl);
  };

  const handleClose = () => {
    setCopied(false);
    setCustomMessage("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="share-referee-link-modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share Referee Signup Link</h3>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="link-section">
            <h4>Signup Link</h4>
            <p className="link-description">
              Share this link with potential referees to allow them to sign up for the platform.
            </p>

            <div className="link-container">
              <input type="text" value={signupLink} readOnly className="link-input" placeholder="Generating link..." />
              <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={handleCopyLink}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="message-section">
            <h4>Custom Message (Optional)</h4>
            <p className="message-description">Add a personal message to include when sharing the link.</p>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Enter your custom message here..."
              className="message-input"
              rows={3}
            />
          </div>

          <div className="share-section">
            <h4>Share Via</h4>
            <div className="share-buttons">
              <button className="share-btn whatsapp" onClick={handleShareWhatsApp}>
                <span className="share-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                  </svg>
                </span>
                WhatsApp
              </button>

              <button className="share-btn telegram" onClick={handleShareTelegram}>
                <span className="share-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </span>
                Telegram
              </button>

              <button className="share-btn email" onClick={handleShareEmail}>
                <span className="share-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                </span>
                Email
              </button>
            </div>
          </div>

          <div className="info-section">
            <h4>How it works</h4>
            <ul className="info-list">
              <li>When someone clicks the link, they'll be directed to the signup page</li>
              <li>The referee role will be pre-selected for them</li>
              <li>They can complete their registration and start refereeing matches</li>
              <li>You'll be notified when new referees join through your link</li>
            </ul>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareRefereeLinkModal;
