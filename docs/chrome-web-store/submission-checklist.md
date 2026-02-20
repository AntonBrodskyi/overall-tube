# Chrome Web Store Submission Checklist

## 1) Functional checks

- [ ] Extension loads via `chrome://extensions` without errors
- [ ] AI panel appears on `https://www.youtube.com/watch*`
- [ ] Summary mode returns response
- [ ] Critical Review mode returns response
- [ ] Ask mode supports follow-up question
- [ ] Language selector changes output language

## 2) Policy and privacy checks

- [ ] Privacy policy is hosted on a public URL
- [ ] Support contact email is ready
- [ ] Data usage answers in Web Store form match actual behavior
- [ ] No remote code execution, no obfuscated/minified hidden logic
- [ ] Only required permissions are declared

## 3) Store listing assets

- [ ] Short description
- [ ] Detailed description
- [ ] At least one screenshot (required)
- [ ] Optional promo images prepared

## 4) Release artifact

- [ ] `bash scripts/release-chrome.sh` executed
- [ ] Upload zip from `release/`
- [ ] Uploaded package passes Chrome Web Store validation

## 5) Post-submit

- [ ] Review status monitored in Developer Dashboard
- [ ] If rejected, address policy notes and resubmit with version bump
