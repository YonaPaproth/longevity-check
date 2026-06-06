export const de = {
  locale: 'de' as const,

  nav: {
    home: '/',
    nutrientCheck: { label: 'Ernährungs-Check', href: '/ernaehrungs-check' },
    ingredients:   { label: 'Wirkstoffe',       href: '/wirkstoffe' },
    products:      { label: 'Produkte',          href: '/produkte' },
    claimsCheck:   { label: 'Claims-Check',      href: '/claims' },
    methodology:   { label: 'Methodik',          href: '/methodik' },
    graph:         { label: 'Wissensgraph',      href: '/graph' },
    langSwitch:    { label: 'EN', href: '/en' },
  },

  footer: {
    tagline: 'Evidenzbasierte Supplement-Bewertungen. Kostenlos.',
    claimsCheck: 'Claims-Check',
    methodology: 'Methodik',
    legalNotice: 'Impressum',
    privacy: 'Datenschutz',
    disclaimer:
      'MikroScore ist ein redaktionelles Informationsangebot. Alle Inhalte ersetzen keine medizinische oder pharmazeutische Beratung und stellen keine Diagnose, Therapieempfehlung oder Heilversprechen dar. Die Bewertungen sind redaktionelle Einschätzungen zu Produktqualität und Transparenz — keine Aussagen über gesundheitliche Wirkungen. Individuelle Ergebnisse können stark variieren. Konsultiere vor der Einnahme von Nahrungsergänzungsmitteln — insbesondere bei Erkrankungen, Medikamenteneinnahme oder in der Schwangerschaft — eine Ärztin oder einen Arzt.',
  },

  safety: {
    label: 'Sicherheit',
    safe:               'Sicher',
    'likely-safe':      'Wahrscheinlich sicher',
    caution:            'Mit Vorsicht',
    'insufficient-data':'Datenlage unklar',
  },

  evidence: {
    label: 'Evidenzstufe',
  },

  verdict: {
    // product verdicts
    empfehlenswert:         'Empfehlenswert',
    akzeptabel:             'Akzeptabel',
    'nicht-empfehlenswert': 'Nicht empfehlenswert',
    // claim verdicts
    belegt:      'Belegt',
    uebertrieben:'Übertrieben',
    falsch:      'Falsch',
    'zu-frueh':  'Zu früh',
  },

  form: {
    capsule: 'Kapsel',
    powder:  'Pulver',
    liquid:  'Flüssig',
    gummy:   'Gummi',
    softgel: 'Softgel',
    tablet:  'Tablette',
  },
} as const;

export type Dict = typeof de;
