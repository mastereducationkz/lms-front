/**
 * The invitation's own motion, as plain CSS: slow rays and two floodlight beams behind Kasatik, a
 * gentle bob, a soft pulse on the last hours. All of it stops for `prefers-reduced-motion`.
 */
export const INVITATION_CSS = `
.mli-rays{position:absolute;left:50%;top:34%;width:190%;aspect-ratio:1;transform:translate(-50%,-50%);
  background:repeating-conic-gradient(from 0deg,rgba(247,201,72,.17) 0 6deg,transparent 6deg 16deg);
  -webkit-mask-image:radial-gradient(circle,#000 0,transparent 58%);mask-image:radial-gradient(circle,#000 0,transparent 58%);
  animation:mli-spin 70s linear infinite}
.mli-beam{position:absolute;top:-30px;width:46%;height:120%;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,224,122,.28),rgba(255,224,122,0) 70%);
  clip-path:polygon(44% 0,56% 0,100% 100%,0 100%);filter:blur(2px);animation:mli-flicker 7s ease-in-out infinite}
.mli-beam-l{left:-8%;transform:rotate(-14deg);transform-origin:50% 0}
.mli-beam-r{right:-8%;transform:rotate(14deg);transform-origin:50% 0;animation-delay:-3.5s}
.mli-bob{animation:mli-bob 4s ease-in-out infinite}
@keyframes mli-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes mli-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes mli-flicker{0%,100%{opacity:.85}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.mli-rays,.mli-beam,.mli-bob{animation:none}}
`;
