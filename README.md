# just post

an iphone app that's x/twitter without the feed. you can post, reply, read your notifications and dms, search, and visit profiles, but there's no timeline to scroll.

opening it lands on a quiet screen that says "no feed here." with a **write a post** button.

## what it does

- **no home feed.** the timeline, its tabs, and the live/spaces banner are hidden.
- **no explore/trending.** the search tab opens a plain search box instead.
- **no ads**, anywhere.
- **"posted ✓".** a small banner confirms when a post or reply went through, with a link to it.
- **peek, with hoops.** a faint "peek at a few posts" link lets you see 1–5 posts, but first you type out a sentence (no pasting) and wait 20 seconds. a peek lasts 3 minutes, then there's a 15 minute cooldown.

everything else (composer, notifications, dms, grok, profiles, settings) is just x.

## how it works

no x api, no developer account with x, no cost. the app is a web view showing x's own mobile site, plus one script ([`JustPost/feedless.js`](JustPost/feedless.js)) that hides the feed and adds the extra bits. you log in with your normal x account, inside the app.

the app itself has no servers, analytics or tracking of its own. it talks to x the same way x's website does in safari, so x's own tracking still applies.

## put it on your iphone

you need a mac with [xcode](https://apps.apple.com/app/xcode/id497799835) 16 or newer (built with xcode 26), an apple id, and an iphone on ios 17 or newer. it isn't on the app store.

1. download this repo and open `JustPost.xcodeproj` in xcode
2. click **JustPost** in the left sidebar → the **JustPost** target → **signing & capabilities** → pick your apple id under **team** (add it in xcode → settings → accounts if it's not there)
3. plug in your iphone, pick it at the top of the window, press ▶
4. first time only, on the phone: turn on **settings → privacy & security → developer mode**, and if it asks, trust yourself under **settings → general → vpn & device management**

with a free apple id the app stops opening after 7 days. plug in and press ▶ again, and you stay logged in. a paid apple developer account ($99/yr) makes it last a year.

if you'd rather not have your team written into the project file, put it in a `Local.xcconfig` next to `Config.xcconfig` instead (that file is gitignored):

```
DEVELOPMENT_TEAM = ABCDE12345
```

## make it yours

the knobs are at the top of [`JustPost/feedless.js`](JustPost/feedless.js): peek length, cooldown, the wait, and the sentence you have to type. the home screen text is in `idle()`.

x changes its website often. if the feed ever leaks back, the css selectors near the top of that file are what need updating.

## good to know

- sign in with your username or email and password. "continue with google/apple" may not work inside apps like this.
- there are no push notifications. this app can't receive x's alerts.
- links to other websites open in your phone's browser.
- to make it stick, delete the real x app or put it behind screen time.

not affiliated with x corp.

## license

[mit](LICENSE)
