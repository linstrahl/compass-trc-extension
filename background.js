// Background event page for TRC Auto Sender
// Keeps the extension alive and handles cross-context messaging

browser.runtime.onInstalled.addListener(() => {
  console.log("[TRC Auto Sender] Extension installed successfully.")
  // Clear any stale state from a previous session
  browser.storage.local.set({ running: false, batchCounter: 0, sessionStart: null })
})
