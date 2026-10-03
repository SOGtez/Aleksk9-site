"use client";

import { useEffect } from "react";
import "@/resources/stream.css";

/* Twitch player, live badge and the site chat. The markup is the same as the old homepage's, and
   public/embed/stream.js (the old homepage script) drives it, so the chat behaves exactly as before.
   The markup is static HTML so React never re-renders over what the script adds. */
const MARKUP = `
  <div class="stream" id="stream">
    <div class="stream-grid">
      <div class="stream-main">
        <div class="player" id="player"></div>
        <div class="stream-info">
          <a id="live-card" class="live-card" data-state="loading" href="https://twitch.tv/aieksk9" target="_blank" rel="noopener">
            <span class="live-dot" aria-hidden="true"></span>
            <span class="live-text">
              <span class="live-label" data-live-label>Checking stream…</span>
              <span class="live-meta" data-live-meta>twitch.tv/AIeksK9</span>
            </span>
            <span class="live-cta" aria-hidden="true">Open</span>
          </a>
        </div>
      </div>
      <div class="chat">
        <div class="chat-head"><span>Stream chat</span><span class="state" id="chat-state">connecting…</span></div>
        <div class="chat-view">
          <div class="chat-log" id="chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>
          <button class="chat-jump" id="chat-jump" type="button" hidden>New messages ↓</button>
        </div>
        <div class="composer" id="composer"><span class="hint">Loading chat…</span></div>
      </div>
    </div>
  </div>
  <div class="modal" id="app-modal" hidden role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
    <div class="modal-card">
      <img src="/assets/ak9-logo-halloween-hero.png" alt="">
      <h2 id="app-modal-title">Enjoying the stream?</h2>
      <p>You're chatting like a regular. Watch on the Twitch app for the full experience: better quality, emotes, and no missed messages.</p>
      <div class="actions">
        <a class="btn btn-primary" id="app-modal-go" href="https://twitch.tv/aieksk9" target="_blank" rel="noopener">Watch on Twitch</a>
        <button class="later" id="app-modal-later" type="button">Keep watching here</button>
      </div>
    </div>
  </div>`;

export const StreamSection = () => {
  useEffect(() => {
    const w = window as unknown as { ak9StreamInit?: () => void };
    if (document.getElementById("ak9-stream-js")) { w.ak9StreamInit?.(); return; }
    const s = document.createElement("script");
    s.id = "ak9-stream-js";
    s.src = "/embed/stream.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);
  return <div className="ak9-stream" aria-label="Live stream" dangerouslySetInnerHTML={{ __html: MARKUP }} />;
};
