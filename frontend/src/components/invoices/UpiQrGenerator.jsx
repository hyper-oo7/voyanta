import { useMemo, useState } from 'react';
import { generateQrSvg } from '../../lib/qrEngine.js';

export function formatCurrency(amount, currency = 'INR') {
  const num = Number(amount || 0);
  try {
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0
    }).format(num);
  } catch {
    const sym = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
    return `${sym}${num.toLocaleString()}`;
  }
}

export function UpiQrGenerator({
  upiId = 'voyantatravel@okaxis',
  payeeName = 'Voyanta Luxury Travel',
  amount = 0,
  currency = 'INR',
  invoiceNumber = 'INV-000001',
  size = 140,
  showPayButtons = true,
  className = ''
}) {
  const [copied, setCopied] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);

  const upiUri = useMemo(() => {
    const cleanId = (upiId || 'voyantatravel@okaxis').trim();
    const cleanName = (payeeName || 'Voyanta Travel').trim();
    const cleanAmt = Number(amount || 0).toFixed(2);
    const note = encodeURIComponent(`Invoice ${invoiceNumber}`);
    return `upi://pay?pa=${encodeURIComponent(cleanId)}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmt}&cu=INR&tn=${note}`;
  }, [upiId, payeeName, amount, invoiceNumber]);

  const qrSvgHtml = useMemo(() => {
    return generateQrSvg(upiUri, size, '#0f172a', '#ffffff');
  }, [upiUri, size]);

  const customQrImage = useMemo(() => {
    try {
      return localStorage.getItem('voyanta_payment_qr_code') || null;
    } catch { return null; }
  }, []);

  const handleCopyId = () => {
    try {
      navigator.clipboard.writeText(upiId || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleAppLaunch = (appPrefix) => {
    if (appPrefix === 'gpay') {
      window.location.href = upiUri.replace('upi://pay', 'tez://upi/pay');
    } else if (appPrefix === 'phonepe') {
      window.location.href = upiUri.replace('upi://pay', 'phonepe://pay');
    } else if (appPrefix === 'paytm') {
      window.location.href = upiUri.replace('upi://pay', 'paytmmp://pay');
    } else {
      window.location.href = upiUri;
    }
  };

  return (
    <div className={`flex flex-col items-center p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 shadow-sm ${className}`}>
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-[15px] text-primary">qr_code_scanner</span>
          Instant UPI Payment
        </span>
        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {formatCurrency(amount, currency)}
        </span>
      </div>

      {/* QR Display */}
      <div className="p-3 bg-white rounded-xl border border-outline-variant shadow-inner my-2 flex items-center justify-center transition-transform hover:scale-105 duration-300">
        {customQrImage ? (
          <img src={customQrImage} alt="Authentic Payment QR Code" style={{ width: size, height: size }} className="object-contain" />
        ) : (
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvgHtml)}`} alt="UPI Payment QR Code" style={{ width: size, height: size }} className="object-contain" />
        )}
      </div>

      <div className="text-center w-full mt-1">
        <div className="flex items-center justify-center gap-1 text-xs font-bold text-on-surface">
          <span>{payeeName}</span>
        </div>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className="text-[11px] font-mono text-on-surface-variant">{upiId}</span>
          <button
            onClick={handleCopyId}
            type="button"
            className="text-on-surface-variant hover:text-primary transition-colors p-0.5"
            title="Copy UPI ID"
          >
            <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
          </button>
        </div>
        {copied && <span className="text-[10px] text-emerald-600 font-bold block">UPI ID Copied!</span>}
      </div>

      {/* Pay Now Button & App Choices */}
      {showPayButtons && (
        <div className="w-full mt-3 pt-3 border-t border-outline-variant/50 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowAppModal(!showAppModal)}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-on-primary font-bold text-xs uppercase tracking-wider shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Pay Now with UPI App
          </button>

          {showAppModal && (
            <div className="grid grid-cols-2 gap-1.5 pt-1 animate-fade-in">
              <button
                type="button"
                onClick={() => handleAppLaunch('gpay')}
                className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                GPay
              </button>
              <button
                type="button"
                onClick={() => handleAppLaunch('phonepe')}
                className="py-1.5 px-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                PhonePe
              </button>
              <button
                type="button"
                onClick={() => handleAppLaunch('paytm')}
                className="py-1.5 px-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                Paytm
              </button>
              <button
                type="button"
                onClick={() => handleAppLaunch('bhim')}
                className="py-1.5 px-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                BHIM / Any
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
