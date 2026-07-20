"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
export function QrCode({ value }: { value: string }) { const [src, setSrc] = useState(""); useEffect(() => { QRCode.toDataURL(value, { width: 420, margin: 1, errorCorrectionLevel: "M" }).then(setSrc); }, [value]); return src ? <img src={src} alt="Card QR code" className="h-32 w-32" /> : <div className="h-32 w-32 animate-pulse bg-black/10" />; }
