import type { Dict } from './de';

export const en: Dict = {
  locale: 'en',

  nav: {
    home: '/en',
    checks: {
      label: 'Checks',
      items: [
        { label: 'Nutrient Check', href: '/en/nutrient-check', desc: 'General nutrient risk assessment' },
        { label: 'Vegan Check', href: '/en/vegan-supplement-check', desc: 'Tailored for plant-based diets' },
        { label: 'Claims Check', href: '/en/claims', desc: 'Marketing claims put to the test' },
      ],
    },
    ingredients:   { label: 'Ingredients',     href: '/en/ingredients' },
    products:      { label: 'Products',         href: '/en/products' },
    methodology:   { label: 'Methodology',      href: '/en/methodology' },
    tools: {
      label: 'Tools',
      items: [
        { label: 'Knowledge Graph', href: '/en/graph', desc: 'Interactive knowledge graph' },
        { label: 'Stack Builder', href: '/en/stack-builder', desc: 'Build your supplement stack' },
      ],
    },
    researchReview:{ label: 'Research',  href: '/en/research-review' },
    langSwitch:    { label: 'DE', href: '/' },
  },

  footer: {
    tagline: 'Evidence-based supplement ratings. Free.',
    claimsCheck: 'Claims Check',
    methodology: 'Methodology',
    legalNotice: 'Legal Notice',
    privacy: 'Privacy',
    disclaimer:
      'MikroScore is an editorial information service. All content is for informational purposes only and does not constitute medical or pharmaceutical advice, diagnosis, or treatment recommendations. Ratings are editorial assessments of product quality and transparency — not statements about health effects. Individual results may vary. Consult a doctor before taking supplements, especially if you have a medical condition, take medication, or are pregnant.',
  },

  safety: {
    label: 'Safety',
    safe:               'Safe',
    'likely-safe':      'Likely safe',
    caution:            'Use with caution',
    'insufficient-data':'Insufficient data',
  },

  evidence: {
    label: 'Evidence level',
  },

  verdict: {
    // product verdicts
    empfehlenswert:         'Recommended',
    akzeptabel:             'Acceptable',
    'nicht-empfehlenswert': 'Not recommended',
    // claim verdicts
    belegt:      'Supported',
    uebertrieben:'Exaggerated',
    falsch:      'False',
    'zu-frueh':  'Too early to say',
  },

  form: {
    capsule: 'Capsule',
    powder:  'Powder',
    liquid:  'Liquid',
    gummy:   'Gummy',
    softgel: 'Softgel',
    tablet:  'Tablet',
  },
} as const;
