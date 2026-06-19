export interface HealthCategory {
  slug: string;
  de: { name: string; title: string; description: string; emoji: string };
  en: { name: string; title: string; description: string; emoji: string };
}

export const healthCategories: HealthCategory[] = [
  {
    slug: 'kognition',
    de: { name: 'Kognition', title: 'Wirkstoffe für Kognition & Gehirngesundheit', description: 'Supplements für Gedächtnis, Konzentration und kognitive Leistungsfähigkeit — evidenzbasiert bewertet.', emoji: '🧠' },
    en: { name: 'Cognition', title: 'Supplements for Cognition & Brain Health', description: 'Supplements for memory, focus, and cognitive performance — evidence-based ratings.', emoji: '🧠' },
  },
  {
    slug: 'herz-kreislauf',
    de: { name: 'Herz-Kreislauf', title: 'Wirkstoffe für Herz & Kreislauf', description: 'Supplements für Herzgesundheit, Blutgefäße und kardiovaskuläre Funktion — nach Evidenz sortiert.', emoji: '❤️' },
    en: { name: 'Cardiovascular', title: 'Supplements for Heart & Cardiovascular Health', description: 'Supplements for heart health, blood vessels, and cardiovascular function — ranked by evidence.', emoji: '❤️' },
  },
  {
    slug: 'schlaf',
    de: { name: 'Schlaf', title: 'Wirkstoffe für besseren Schlaf', description: 'Supplements für Schlafqualität, Einschlafen und erholsame Nachtruhe — evidenzbasiert bewertet.', emoji: '😴' },
    en: { name: 'Sleep', title: 'Supplements for Better Sleep', description: 'Supplements for sleep quality, falling asleep, and restful nights — evidence-based ratings.', emoji: '😴' },
  },
  {
    slug: 'energie',
    de: { name: 'Energie', title: 'Wirkstoffe für mehr Energie & Vitalität', description: 'Supplements für Energiestoffwechsel, Mitochondrien und körperliche Leistungsfähigkeit.', emoji: '⚡' },
    en: { name: 'Energy', title: 'Supplements for Energy & Vitality', description: 'Supplements for energy metabolism, mitochondria, and physical performance.', emoji: '⚡' },
  },
  {
    slug: 'immunsystem',
    de: { name: 'Immunsystem', title: 'Wirkstoffe für das Immunsystem', description: 'Supplements für Immunfunktion, Infektabwehr und Immunregulation — nach Evidenz sortiert.', emoji: '🛡️' },
    en: { name: 'Immune System', title: 'Supplements for Immune Health', description: 'Supplements for immune function, infection defense, and immune regulation — ranked by evidence.', emoji: '🛡️' },
  },
  {
    slug: 'entzuendung',
    de: { name: 'Entzündung', title: 'Wirkstoffe gegen Entzündungen', description: 'Supplements mit entzündungshemmender Wirkung — Curcumin, Omega-3 und mehr, evidenzbasiert bewertet.', emoji: '🔥' },
    en: { name: 'Inflammation', title: 'Anti-Inflammatory Supplements', description: 'Supplements with anti-inflammatory effects — curcumin, omega-3 and more, evidence-based ratings.', emoji: '🔥' },
  },
  {
    slug: 'alterung',
    de: { name: 'Alterung & Longevity', title: 'Wirkstoffe für Longevity & Anti-Aging', description: 'Supplements für gesundes Altern, Zellschutz und Langlebigkeit — NMN, Resveratrol, Spermidine und mehr.', emoji: '⏳' },
    en: { name: 'Aging & Longevity', title: 'Supplements for Longevity & Healthy Aging', description: 'Supplements for healthy aging, cellular protection, and longevity — NMN, resveratrol, spermidine and more.', emoji: '⏳' },
  },
  {
    slug: 'stress',
    de: { name: 'Stress', title: 'Wirkstoffe gegen Stress & Cortisol', description: 'Adaptogene und Supplements für Stressresistenz, Cortisol-Balance und mentale Belastbarkeit.', emoji: '🧘' },
    en: { name: 'Stress', title: 'Supplements for Stress & Cortisol Balance', description: 'Adaptogens and supplements for stress resilience, cortisol balance, and mental well-being.', emoji: '🧘' },
  },
  {
    slug: 'haut',
    de: { name: 'Haut', title: 'Wirkstoffe für Haut & Hautalterung', description: 'Supplements für Hautgesundheit, Kollagenbildung und Schutz vor Hautalterung.', emoji: '✨' },
    en: { name: 'Skin', title: 'Supplements for Skin Health & Anti-Aging', description: 'Supplements for skin health, collagen production, and protection against skin aging.', emoji: '✨' },
  },
  {
    slug: 'muskel',
    de: { name: 'Muskulatur', title: 'Wirkstoffe für Muskeln & Sport', description: 'Supplements für Muskelaufbau, Regeneration und sportliche Leistungsfähigkeit.', emoji: '💪' },
    en: { name: 'Muscle', title: 'Supplements for Muscle & Sports Performance', description: 'Supplements for muscle growth, recovery, and athletic performance.', emoji: '💪' },
  },
  {
    slug: 'verdauung',
    de: { name: 'Verdauung', title: 'Wirkstoffe für Verdauung & Darmgesundheit', description: 'Supplements für Darmflora, Verdauung und Mikrobiom-Gesundheit.', emoji: '🦠' },
    en: { name: 'Digestion', title: 'Supplements for Digestion & Gut Health', description: 'Supplements for gut flora, digestion, and microbiome health.', emoji: '🦠' },
  },
  {
    slug: 'oxidativer-stress',
    de: { name: 'Oxidativer Stress', title: 'Wirkstoffe gegen oxidativen Stress', description: 'Antioxidative Supplements für Zellschutz und freie Radikale — nach Evidenz sortiert.', emoji: '🛡️' },
    en: { name: 'Oxidative Stress', title: 'Antioxidant Supplements', description: 'Antioxidant supplements for cell protection and free radical defense — ranked by evidence.', emoji: '🛡️' },
  },
  {
    slug: 'blutzucker',
    de: { name: 'Blutzucker', title: 'Wirkstoffe für Blutzucker & Insulinsensitivität', description: 'Supplements für Blutzuckerregulation, Insulinsensitivität und metabolische Gesundheit.', emoji: '📊' },
    en: { name: 'Blood Sugar', title: 'Supplements for Blood Sugar & Insulin Sensitivity', description: 'Supplements for blood sugar regulation, insulin sensitivity, and metabolic health.', emoji: '📊' },
  },
  {
    slug: 'blutdruck',
    de: { name: 'Blutdruck', title: 'Wirkstoffe für gesunden Blutdruck', description: 'Supplements die Blutdruck und Gefäßgesundheit unterstützen können — evidenzbasiert bewertet.', emoji: '💓' },
    en: { name: 'Blood Pressure', title: 'Supplements for Healthy Blood Pressure', description: 'Supplements that may support blood pressure and vascular health — evidence-based ratings.', emoji: '💓' },
  },
  {
    slug: 'knochen',
    de: { name: 'Knochen', title: 'Wirkstoffe für Knochen & Gelenke', description: 'Supplements für Knochendichte, Gelenke und Bindegewebe — Calcium, D3, K2 und mehr.', emoji: '🦴' },
    en: { name: 'Bones', title: 'Supplements for Bone & Joint Health', description: 'Supplements for bone density, joints, and connective tissue — calcium, D3, K2 and more.', emoji: '🦴' },
  },
  {
    slug: 'gelenke',
    de: { name: 'Gelenke', title: 'Wirkstoffe für Gelenkgesundheit', description: 'Supplements für Gelenke, Knorpel und Beweglichkeit — Glucosamin, Kollagen und mehr.', emoji: '🦵' },
    en: { name: 'Joints', title: 'Supplements for Joint Health', description: 'Supplements for joints, cartilage, and mobility — glucosamine, collagen and more.', emoji: '🦵' },
  },
  {
    slug: 'leber',
    de: { name: 'Leber', title: 'Wirkstoffe für die Lebergesundheit', description: 'Supplements für Leberfunktion, Entgiftung und Leberschutz.', emoji: '🫁' },
    en: { name: 'Liver', title: 'Supplements for Liver Health', description: 'Supplements for liver function, detoxification, and liver protection.', emoji: '🫁' },
  },
  {
    slug: 'neuroprotektiv',
    de: { name: 'Neuroprotektiv', title: 'Neuroprotektive Wirkstoffe', description: 'Supplements für Nervenschutz und neurodegenerative Prävention.', emoji: '🧬' },
    en: { name: 'Neuroprotective', title: 'Neuroprotective Supplements', description: 'Supplements for nerve protection and neurodegenerative prevention.', emoji: '🧬' },
  },
  {
    slug: 'schilddruese',
    de: { name: 'Schilddrüse', title: 'Wirkstoffe für die Schilddrüse', description: 'Supplements für Schilddrüsenfunktion — Jod, Selen und mehr.', emoji: '🦋' },
    en: { name: 'Thyroid', title: 'Supplements for Thyroid Health', description: 'Supplements for thyroid function — iodine, selenium and more.', emoji: '🦋' },
  },
  {
    slug: 'depression',
    de: { name: 'Stimmung', title: 'Wirkstoffe für Stimmung & mentale Gesundheit', description: 'Supplements die Stimmung und mentales Wohlbefinden unterstützen können.', emoji: '🌤️' },
    en: { name: 'Mood', title: 'Supplements for Mood & Mental Health', description: 'Supplements that may support mood and mental well-being.', emoji: '🌤️' },
  },
  {
    slug: 'fertilitat',
    de: { name: 'Fertilität', title: 'Wirkstoffe für Fertilität & Fruchtbarkeit', description: 'Supplements für Fruchtbarkeit, Hormonstatus und reproduktive Gesundheit.', emoji: '🌱' },
    en: { name: 'Fertility', title: 'Supplements for Fertility & Reproductive Health', description: 'Supplements for fertility, hormonal status, and reproductive health.', emoji: '🌱' },
  },
  {
    slug: 'augen',
    de: { name: 'Augen', title: 'Wirkstoffe für Augengesundheit', description: 'Supplements für Sehkraft, Netzhaut und Augenschutz — Lutein, Zeaxanthin und mehr.', emoji: '👁️' },
    en: { name: 'Eyes', title: 'Supplements for Eye Health', description: 'Supplements for vision, retina, and eye protection — lutein, zeaxanthin and more.', emoji: '👁️' },
  },
  {
    slug: 'migraene',
    de: { name: 'Migräne', title: 'Wirkstoffe bei Migräne & Kopfschmerzen', description: 'Supplements die bei Migräne und Kopfschmerzen unterstützen können — Magnesium, CoQ10 und mehr.', emoji: '🤕' },
    en: { name: 'Migraine', title: 'Supplements for Migraine & Headache', description: 'Supplements that may support migraine and headache relief — magnesium, CoQ10 and more.', emoji: '🤕' },
  },
];

export function getCategoryBySlug(slug: string) {
  return healthCategories.find(c => c.slug === slug);
}
