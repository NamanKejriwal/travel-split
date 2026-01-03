import posthog from 'posthog-js'

// 🔐 Only initialize in browser (not server)
if (typeof window !== 'undefined') {
  // Get your API key from: https://app.posthog.com/project/settings
  const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'
  
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      
      // 🚀 Performance optimizations
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.debug() // See events in console during dev
        }
      },
      
      // 🔒 Privacy settings
      capture_pageview: true, // Auto-track page views
      capture_pageleave: true, // Track when users leave
      autocapture: false, // Don't auto-capture all clicks (too noisy)
      
      // ⚡ Load async (doesn't block page load)
      disable_session_recording: false, // Enable session replay
      session_recording: {
        maskAllInputs: true, // Hide passwords, emails
        maskTextSelector: '.sensitive', // Hide elements with this class
      },
    })
  }
}

// 📊 ANALYTICS FUNCTIONS

export const analytics = {
  // 👤 Identify user when they log in
  identify: (userId: string, traits?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      posthog.identify(userId, traits)
    }
  },

  // 📈 Track custom events
  track: (eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      posthog.capture(eventName, properties)
    }
  },

  // 📄 Track page views
  page: (pageName?: string) => {
    if (typeof window !== 'undefined') {
      posthog.capture('$pageview', { page: pageName })
    }
  },

  // 🚪 Reset on logout
  reset: () => {
    if (typeof window !== 'undefined') {
      posthog.reset()
    }
  },
}

// 🎯 PRE-DEFINED EVENTS (for consistency)

export const trackEvent = {
  // Auth events
  signUp: (method: 'email' | 'google') => 
    analytics.track('User Signed Up', { method }),
  
  signIn: (method: 'email' | 'google') => 
    analytics.track('User Signed In', { method }),
  
  signOut: () => 
    analytics.track('User Signed Out'),

  // Group events
  groupCreated: (groupName: string, memberCount: number) =>
    analytics.track('Group Created', { groupName, memberCount }),
  
  groupSelected: (groupName: string) =>
    analytics.track('Group Selected', { groupName }),

  // Expense events
  expenseAdded: (amount: number, category: string, splitWith: number) =>
    analytics.track('Expense Added', { amount, category, splitWith }),
  
  expenseDeleted: (amount: number) =>
    analytics.track('Expense Deleted', { amount }),
  
  expenseEdited: (amount: number) =>
    analytics.track('Expense Edited', { amount }),

  // Settlement events
  settlementCreated: (amount: number, from: string, to: string) =>
    analytics.track('Settlement Created', { amount, from, to }),

  // Export events
  exportedPDF: (expenseCount: number) =>
    analytics.track('Exported PDF', { expenseCount }),

  // AI events
  aiTipGenerated: (category: string) =>
    analytics.track('AI Tip Generated', { category }),

  // Error tracking
  error: (errorType: string, errorMessage: string, location: string) =>
    analytics.track('Error Occurred', { errorType, errorMessage, location }),
}