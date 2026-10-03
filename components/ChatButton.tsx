"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Mail, MessageSquareText } from "lucide-react";

type Props = { whatsapp: string; phone: string; email: string; propertyName: string };

const GREETING = "Ready for a little waterfront getaway?";

export function ChatButton({ whatsapp, phone, email, propertyName }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Show the greeting bubble once per visit, a few seconds after landing.
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("er_chat_teaser") === "off";
    } catch {
      /* storage unavailable */
    }
    if (dismissed) return;
    const t = setTimeout(() => setTeaser(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const hideTeaser = () => {
    setTeaser(false);
    try {
      sessionStorage.setItem("er_chat_teaser", "off");
    } catch {
      /* ignore */
    }
  };

  const text = message.trim() || `Hi! I have a question about ${propertyName}.`;
  const digits = (n: string) => n.replace(/[^\d]/g, "");

  return (
    <div className="chat">
      {teaser && !open && (
        <div className="chat-teaser" role="status">
          <button type="button" className="chat-teaser-text" onClick={() => { setOpen(true); hideTeaser(); }}>
            {GREETING} 🌴
          </button>
          <button type="button" className="chat-teaser-close" aria-label="Dismiss" onClick={hideTeaser}>
            <X size={14} />
          </button>
        </div>
      )}

      {open && (
        <div className="chat-panel" role="dialog" aria-label="Contact us">
          <div className="chat-head">
            <strong>{GREETING}</strong>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <p className="chat-sub">Ask us about dates, the dock, pets or local tips. We usually reply within a few hours.</p>
          <label className="chat-label" htmlFor="chat-msg">
            Your message
          </label>
          <textarea
            id="chat-msg"
            rows={3}
            value={message}
            placeholder="Hi! Is the hot tub heated in winter?"
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="chat-actions">
            {whatsapp && (
              <a className="chat-btn whatsapp" href={`https://wa.me/${digits(whatsapp)}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={18} aria-hidden="true" /> WhatsApp
              </a>
            )}
            {phone && (
              <a className="chat-btn" href={`sms:${phone}?&body=${encodeURIComponent(text)}`}>
                <MessageSquareText size={18} aria-hidden="true" /> Text us
              </a>
            )}
            {email && (
              <a className="chat-btn" href={`mailto:${email}?subject=${encodeURIComponent(propertyName)}&body=${encodeURIComponent(text)}`}>
                <Mail size={18} aria-hidden="true" /> Email
              </a>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="chat-fab"
        aria-label={open ? "Close chat" : "Chat with us"}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          hideTeaser();
        }}
      >
        {open ? <X size={26} /> : <MessageCircle size={26} />}
      </button>
    </div>
  );
}
