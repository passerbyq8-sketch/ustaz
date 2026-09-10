// download.js -- ITEM 92 PART B: THE SMART LINK. Loaded by download.html, in the head, as a
// normal same-origin script, so it runs before the body is shown and passes a `script-src 'self'`
// policy. ASCII only, no dependency, no build step.
//
// WHY A USER AGENT IS READ HERE AND NOWHERE ELSE. The app's own shell detection never consults
// navigator.userAgent -- it tests the injected bridge, and guards/share-links-guard.cjs case D
// asserts that. This file is not the app. It is a public web page whose entire job is to send a
// visitor to the store their device can install from, and the user agent is the standard way a
// web page picks a store. Nothing here is shipped into the bundle and nothing here can reach it.
//
// WHY THE APP STORE IS TESTED FIRST, AND WHY `Macintosh` IS IN THE TEST. An iPad asking for the
// desktop site reports `Macintosh` and no iPad at all -- that has been Safari's behaviour since
// iPadOS 13 -- so the only thing left to separate it from a real Mac is that it has a touch
// screen. navigator.maxTouchPoints is 5 on that iPad and 0 on every Mac. A Mac with a drawing
// tablet plugged in is the one case this reads wrong, and it reads wrong towards the App Store,
// which is a store that Mac can actually reach.
//
// AND IT NEVER GUESSES. A device that is neither is not sent anywhere: the page stays, and it
// shows both official badges as links, which is also what a visitor with JavaScript off sees.
(function () {
  'use strict';
  var APP_STORE = 'https://apps.apple.com/gb/app/%D8%B9%D8%B2%D9%83/id6797100518';
  var PLAY_STORE = 'https://play.google.com/store/apps/details?id=app.almurabbi.tutor&hl=ar';
  var nav = (typeof navigator === 'undefined') ? null : navigator;
  var ua = String((nav && nav.userAgent) || '');
  var touch = (nav && typeof nav.maxTouchPoints === 'number') ? nav.maxTouchPoints : 0;
  var ios = ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1 || ua.indexOf('iPod') !== -1
    || (ua.indexOf('Macintosh') !== -1 && touch > 1);
  if (ios) { location.replace(APP_STORE); return; }
  if (ua.indexOf('Android') !== -1) { location.replace(PLAY_STORE); return; }
}());
