export const de = {
  locale: 'de' as const,

  nav: {
    home: '/',
    checks: {
      label: 'Checks',
      items: [
        { label: 'Ernährungs-Check', href: '/ernaehrungs-check', desc: 'Allgemeiner Nährstoff-Risikotest' },
        { label: 'Claims-Check', href: '/claims', desc: 'Werbeversprechen auf dem Prüfstand' },
      ],
    },
    ingredients:   { label: 'Wirkstoffe',       href: '/wirkstoffe' },
    products:      { label: 'Produkte',          href: '/produkte' },
    methodology:   { label: 'Methodik',          href: '/methodik' },
    tools: {
      label: 'Tools',
      items: [
        { label: 'Wissensgraph', href: '/graph', desc: 'Interaktiver Knowledge Graph' },
        { label: 'Stack Builder', href: '/stack-builder', desc: 'Supplement-Stack zusammenstellen' },
        { label: 'API', href: '/tools/api', desc: 'Strukturierte Daten für Agenten' },
      ],
    },
    researchReview:{ label: 'Studien',    href: '/research-review' },
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
