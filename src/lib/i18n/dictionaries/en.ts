// English is the SHAPE of every dictionary: `Dictionary = typeof en`, so a missing
// key in any other language is a TypeScript error rather than a blank space that
// only a speaker of that language would ever notice.
//
// `public.*` covers the three surfaces a stranger reaches with no session — the
// landing, /discover and /u/<handle>. Those are server-rendered, so they are also
// what a crawler and a link preview see; leaving them English-only made the front
// door unreadable for most of Pi's communities.
export const en = {
  common: {
    appName:  'TEC',
    tagline:  'The Elite Consortium',
    login:    'Sign in with Pi',
    logout:   'Logout',
    loading:  'Loading...',
    comingSoon: 'Coming Soon',
    live:     'Live',
    language: 'Language',
  },
  dashboard: {
    greeting:   'Welcome,',
    welcomeNew: '🎉 Welcome to TEC — Your account is ready',
    stats: {
      piBalance:     'Pi Balance',
      tecWallet:     'TEC Wallet',
      availableApps: 'Available Apps',
      activeApp:     'Active',
      subscription:  'Subscription',
      upgradePro:    'Upgrade to Pro',
    },
    appsTitle: 'TEC Ecosystem',
    appsCount: '24 Apps',
  },
  connection: {
    brand:       'TEC Connection · Your network',
    welcome:     'Welcome',
    welcomeName: 'Welcome, {name}',
    subtitle:    'Your relationship graph in the TEC ecosystem. Your connections are yours — you control who you trust and who can see it.',
    nav: { home: 'Home', discover: 'Discover', trust: 'Trust', settings: 'Settings' },
    footer:      'Connection is where your trusted relationships live — who you follow, connect with, and build trust with across TEC. You are always in control of your own network.',
    settings: {
      profile: 'Profile', planFree: 'Free', planPro: 'Pro',
      connectedPi: 'Connected to Pi', notSignedIn: 'Not signed in', member: 'TEC Member',
      appearance: 'Appearance', language: 'Language', languageDesc: 'Display language',
      about: 'About', version: 'Version', domain: 'Domain', ecosystem: 'Ecosystem',
      builtOn: 'Built on', builtOnPi: 'Pi Network', logout: 'Logout',
    },
  },
  public: {
    brand:        'TEC · Connection',
    headline:     'The people of the Pi economy.',
    lede:         'Find builders and merchants who actually accept Pi — and see who is trusted, from real completed payments rather than claims.',
    alreadyOn:    'already on TEC',
    cta:          'Continue with Pi',
    browseFree:   'Or browse without signing in →',
    peopleOnTec:  'People on TEC',
    seeAll:       'See all →',
    howTrust:     'How trust works here',
    step1Title:   'Publish',
    step1Body:    'Put up a handle and one line about what you do. Opt-in — you are listed only if you choose to be.',
    step2Title:   'Connect',
    step2Body:    'Follow the builders and merchants you actually deal with. Your graph belongs to you.',
    step3Title:   'Be trusted',
    step3Body:    'Trust here is computed from completed Pi payments — not from followers, reviews, or anything you can write about yourself.',
    disclaimer:   'Verification is presented from Zone / KYC — never minted by Connection. Featured is a Pro placement: reach only, not trust.',

    discoverTitle: 'Discover people on Pi',
    discoverLede:  'Builders, merchants, creators and investors. Verification comes from Zone / KYC — Connection presents it, never mints it.',
    searchLabel:   'Search by handle or headline',
    searchHint:    'Search people…',
    searchAction:  'Search',
    all:           'all',
    emptyFiltered: 'Nobody matches that yet',
    emptyAll:      'The directory is still filling up',
    emptyBody:     'Listing is opt-in — people appear here only after publishing their profile. Sign in and publish yours to be found.',
    clearFilters:  'Clear filters',
    findableTitle: 'Be findable in the Pi economy',
    findableBody:  'Publish your profile, follow the people you deal with, and let trust build from real completed payments.',

    back:          'Discover',
    verified:      'Verified',
    verifiedHint:  'Verified — presented from Zone / KYC, never minted by Connection',
    featured:      'Featured',
    featuredHint:  'Featured — a Connection Pro placement. Reach only; not verification.',
    follower:      'follower',
    followers:     'followers',
    since:         'On TEC since {date}',
    follow:        'Follow @{name}',
    browseMore:    'Browse more people →',
    profileNote:   'Verification is presented from Zone / KYC — never minted by Connection. Featured is a Connection Pro placement: reach only, never trust. Trust is earned, never bought.',
    notFound:      'Profile not found',

    cat: {
      builder:  'builder',
      merchant: 'merchant',
      creator:  'creator',
      investor: 'investor',
      mentor:   'mentor',
      other:    'other',
    },

    privacy: 'Privacy',
    terms:   'Terms',
  },
};

export type Dictionary = typeof en;
