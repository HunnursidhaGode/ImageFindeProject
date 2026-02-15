import React from "react";
import { QRCodeCanvas } from "qrcode.react";
import { X } from "lucide-react";

const QRCodeModal = ({ onClose }) => {
  // IMPROVEMENT: Use window.location.origin to automatically get your current 
  // Ngrok or Localhost address so you don't have to change it every time.
  const currentOrigin = window.location.origin;
  const guestUrl = `${currentOrigin}/?mode=guest`;

  // CHECK: If you are NOT on HTTPS, the camera will fail on the phone.
  const isSecure = window.isSecureContext;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="bg-white p-8 rounded-3xl relative max-w-sm w-full text-center">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-black">
          <X size={24} />
        </button>

        <h3 className="text-xl font-bold mb-4">Scan to Join</h3>

        {/* The QR Code */}
        <div className="bg-white p-2 inline-block rounded-xl border-2 border-gray-100">
          <QRCodeCanvas value={guestUrl} size={220} />
        </div>

        <div className="text-xs text-gray-500 break-all mt-4 p-2 bg-gray-50 rounded">
          {guestUrl}
        </div>

        {/* WARNING MESSAGE: This tells you if your network setup is wrong before you even scan */}
        {!isSecure && (
          <div className="mt-4 p-2 bg-red-100 text-red-700 text-xs rounded-lg">
            <strong>Warning:</strong> You are on an insecure connection (HTTP). 
            Camera scanning will be blocked on mobile. Use an <strong>HTTPS</strong> Ngrok link.
          </div>
        )}

      </div>
    </div>
  );
};

export default QRCodeModal;