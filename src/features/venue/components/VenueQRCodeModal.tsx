import React from "react";
import QRCodeModal from "../../shared/components/QRCodeModal";

interface VenueQRCodeModalProps {
  isOpen: boolean;
  venueName: string;
  shareUrl: string;
  onClose: () => void;
}

const VenueQRCodeModal: React.FC<VenueQRCodeModalProps> = ({ isOpen, venueName, shareUrl, onClose }) => (
  <QRCodeModal
    isOpen={isOpen}
    title={`QR Code for ${venueName}`}
    description="Scan this QR code to access the venue page with matches and scoring capabilities."
    shareUrl={shareUrl}
    downloadName={`${venueName.replace(/\s+/g, "-")}-QR-Code`}
    level="H"
    onClose={onClose}
  />
);

export default VenueQRCodeModal;
